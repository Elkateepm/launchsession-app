import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Raw body is required to verify the Stripe signature — don't let Vercel parse it as JSON.
export const config = {
  api: { bodyParser: false },
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// The inverse of priceEnvName() in create-checkout-session.js: scan the
// STRIPE_PRICE_<PLAN>_<CYCLE> variables for the one holding this price id.
// Keeping the mapping in the variable names means there is no second list to
// fall out of step with the first.
function planForPrice(priceId) {
  if (!priceId) return null
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== priceId) continue
    const match = /^STRIPE_PRICE_(.+)_(MONTHLY|ANNUAL)$/.exec(key)
    if (match) return { plan: match[1].toLowerCase(), cycle: match[2].toLowerCase() }
  }
  return null
}

const toIso = (unixSeconds) =>
  Number.isFinite(unixSeconds) ? new Date(unixSeconds * 1000).toISOString() : null

// current_period_end sits on the subscription today, and on the subscription
// item from Stripe API version 2025-03-31 onwards. Read both so bumping the
// stripe package can't quietly stop renewal dates updating.
function periodEnd(subscription) {
  return subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end ?? null
}

// Everything a subscription tells us about an organisation's entitlement, in
// the shape organisations expects. Resolving the modules from the catalogue
// here is what makes a downgrade actually remove modules -- before this, a
// plan change moved the label and left the access untouched.
async function subscriptionUpdate(adminClient, subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id || null
  const mapped = planForPrice(priceId)

  const update = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    current_period_end: toIso(periodEnd(subscription)),
    stripe_price_id: priceId,
  }

  if (mapped) {
    update.plan = mapped.plan
    update.billing_cycle = mapped.cycle

    const { data: entitlement, error } = await adminClient
      .from('plan_entitlements')
      .select('modules')
      .eq('plan', mapped.plan)
      .maybeSingle()
    if (error) {
      console.error('stripe-webhook: could not read plan catalogue for', mapped.plan, error)
    } else if (entitlement) {
      update.modules = entitlement.modules
    }
  } else if (priceId) {
    // A price nobody has mapped to a plan. Record the subscription but leave
    // the entitlement alone rather than guessing -- a wrong guess either bills
    // for access they don't have or gives away access they haven't bought.
    console.error('stripe-webhook: no STRIPE_PRICE_* variable matches price', priceId)
  }

  // A live subscription ends the trial, whatever the clock said. Clearing the
  // expiry is what stops org_write_locked() holding a paying customer
  // read-only once their original 14 days elapse.
  if (['active', 'trialing'].includes(subscription.status)) {
    update.trial_expires_at = null
  }

  return update
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env
  if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('stripe-webhook: missing required env vars', {
      hasUrl: !!REACT_APP_SUPABASE_URL,
      hasServiceKey: !!REACT_APP_SUPABASE_SERVICE_KEY,
      hasStripeKey: !!STRIPE_SECRET_KEY,
      hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
    })
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

  let event
  try {
    const rawBody = await readRawBody(req)
    const sig = req.headers['stripe-signature']
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err.message)
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` })
  }

  // Every branch below resolves the organisation the same way: the id Stripe
  // was given at checkout if we have it, otherwise the customer we stored.
  const applyToOrg = async (orgId, customerId, update, what) => {
    const query = orgId
      ? adminClient.from('organisations').update(update).eq('id', orgId)
      : adminClient.from('organisations').update(update).eq('stripe_customer_id', customerId)
    const { error } = await query
    if (error) console.error(`stripe-webhook: failed to ${what}`, error)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const orgId = session.client_reference_id || session.metadata?.org_id
        if (!orgId) {
          console.error('stripe-webhook: checkout.session.completed missing org_id', session.id)
          break
        }
        if (!session.subscription) {
          console.error('stripe-webhook: checkout.session.completed without a subscription', session.id)
          break
        }
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        const update = {
          ...(await subscriptionUpdate(adminClient, subscription)),
          stripe_customer_id: session.customer,
        }
        await applyToOrg(orgId, session.customer, update, 'update org after checkout')
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object
        const update = await subscriptionUpdate(adminClient, subscription)
        await applyToOrg(subscription.metadata?.org_id, subscription.customer, update, 'update org on subscription change')
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        // This used to set plan = 'starter', which handed a cancelled
        // organisation a paid tier for free. A cancelled subscription buys
        // nothing: 'expired' is read-only until they choose a plan again.
        const update = {
          subscription_status: 'canceled',
          plan: 'expired',
          modules: [],
          stripe_subscription_id: null,
          stripe_price_id: null,
        }
        await applyToOrg(subscription.metadata?.org_id, subscription.customer, update, 'update org on subscription cancellation')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        // past_due only. Stripe keeps retrying for about two weeks and emits
        // subscription.updated/deleted when it gives up -- org_write_locked()
        // deliberately does not lock on past_due.
        await applyToOrg(null, invoice.customer, { subscription_status: 'past_due' }, 'mark org past_due')
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
          const update = await subscriptionUpdate(adminClient, subscription)
          await applyToOrg(subscription.metadata?.org_id, invoice.customer, update, 'record successful payment')
        }
        break
      }

      default:
        // Ignore other event types
        break
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('stripe-webhook: unhandled exception processing event', event?.type, err)
    // Return 200 even on internal processing errors so Stripe doesn't hammer retries
    // for a bug on our side; the error above is what we'll see in Vercel logs.
    return res.status(200).json({ received: true, warning: 'processed with errors' })
  }
}
