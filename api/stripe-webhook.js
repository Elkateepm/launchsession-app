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

const PRICE_TO_PLAN = () => ({
  [process.env.STRIPE_PRICE_STARTER]: 'starter',
  [process.env.STRIPE_PRICE_PRO]: 'pro',
  [process.env.STRIPE_PRICE_ENTERPRISE]: 'enterprise',
})

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const orgId = session.client_reference_id || session.metadata?.org_id
        if (!orgId) {
          console.error('stripe-webhook: checkout.session.completed missing org_id', session.id)
          break
        }
        const subscription = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription)
          : null
        const priceId = subscription?.items?.data?.[0]?.price?.id
        const plan = PRICE_TO_PLAN()[priceId] || null

        const update = {
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_status: subscription?.status || 'active',
        }
        if (plan) update.plan = plan
        if (subscription?.current_period_end) {
          update.current_period_end = new Date(subscription.current_period_end * 1000).toISOString()
        }

        const { error } = await adminClient.from('organisations').update(update).eq('id', orgId)
        if (error) console.error('stripe-webhook: failed to update org after checkout', error)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object
        const orgId = subscription.metadata?.org_id
        const priceId = subscription.items?.data?.[0]?.price?.id
        const plan = PRICE_TO_PLAN()[priceId] || null

        const update = {
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }
        if (plan) update.plan = plan

        const query = orgId
          ? adminClient.from('organisations').update(update).eq('id', orgId)
          : adminClient.from('organisations').update(update).eq('stripe_customer_id', subscription.customer)

        const { error } = await query
        if (error) console.error('stripe-webhook: failed to update org on subscription change', error)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const orgId = subscription.metadata?.org_id

        const update = {
          subscription_status: 'canceled',
          plan: 'starter',
        }

        const query = orgId
          ? adminClient.from('organisations').update(update).eq('id', orgId)
          : adminClient.from('organisations').update(update).eq('stripe_customer_id', subscription.customer)

        const { error } = await query
        if (error) console.error('stripe-webhook: failed to update org on subscription cancellation', error)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const { error } = await adminClient
          .from('organisations')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer)
        if (error) console.error('stripe-webhook: failed to mark org past_due', error)
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
