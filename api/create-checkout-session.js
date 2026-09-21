import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Price IDs are found by convention rather than a lookup table, so that
// stripe-webhook.js can invert the same rule to turn a price back into a plan
// without the two files sharing a module. api/ is capped at 12 serverless
// functions on the Hobby plan, so a shared file here is not free.
//
//   starter  + monthly -> STRIPE_PRICE_STARTER_MONTHLY
//   pro_plus + annual  -> STRIPE_PRICE_PRO_PLUS_ANNUAL
const priceEnvName = (plan, cycle) => `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`

const CYCLES = ['monthly', 'annual']

// Stripe refuses a trial_end less than 48 hours out. Below that we just start
// billing immediately rather than failing the checkout.
const MIN_TRIAL_SECONDS = 48 * 60 * 60

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const {
      REACT_APP_SUPABASE_URL,
      REACT_APP_SUPABASE_ANON_KEY,
      REACT_APP_SUPABASE_SERVICE_KEY,
      STRIPE_SECRET_KEY,
    } = process.env

    if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_ANON_KEY || !REACT_APP_SUPABASE_SERVICE_KEY || !STRIPE_SECRET_KEY) {
      console.error('create-checkout-session: missing required env vars', {
        hasUrl: !!REACT_APP_SUPABASE_URL,
        hasAnonKey: !!REACT_APP_SUPABASE_ANON_KEY,
        hasServiceKey: !!REACT_APP_SUPABASE_SERVICE_KEY,
        hasStripeKey: !!STRIPE_SECRET_KEY,
      })
      return res.status(500).json({ error: 'Server misconfiguration: missing required credentials' })
    }

    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

    const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

    const { org_id, plan, cycle = 'monthly', success_url, cancel_url } = req.body || {}
    if (!org_id || !plan) return res.status(400).json({ error: 'Missing org_id or plan' })
    if (!CYCLES.includes(cycle)) return res.status(400).json({ error: `Unknown billing cycle: ${cycle}` })

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    // The catalogue is the authority on what may be bought, so a plan that is
    // not self-serve (trial, expired) can't be reached by posting its key.
    const { data: entitlement, error: planErr } = await adminClient
      .from('plan_entitlements')
      .select('plan, label, self_serve')
      .eq('plan', plan)
      .maybeSingle()
    if (planErr) {
      console.error('create-checkout-session: could not read plan catalogue', planErr)
      return res.status(500).json({ error: 'Could not read the plan catalogue' })
    }
    if (!entitlement || !entitlement.self_serve) return res.status(400).json({ error: `Unknown plan: ${plan}` })

    const priceId = process.env[priceEnvName(plan, cycle)]
    if (!priceId) {
      console.error(`create-checkout-session: missing env var ${priceEnvName(plan, cycle)}`)
      return res.status(500).json({ error: `Billing is not configured for the ${entitlement.label} plan yet` })
    }

    // Confirm the calling user belongs to this org and can manage billing.
    // Owners were locked out of their own billing before this check included
    // them -- 'admin' alone is not the set of people who run an organisation.
    const { data: profile, error: profileErr } = await adminClient
      .from('user_profiles')
      .select('org_id, role, email')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile) return res.status(403).json({ error: 'No profile found for this user' })
    if (profile.org_id !== org_id) return res.status(403).json({ error: 'You do not have access to this organisation' })
    if (!['owner', 'admin'].includes(profile.role)) return res.status(403).json({ error: 'Only owners and administrators can manage billing' })

    const { data: org, error: orgErr } = await adminClient
      .from('organisations')
      .select('id, name, stripe_customer_id, stripe_subscription_id, contact_email, plan, trial_expires_at')
      .eq('id', org_id)
      .single()
    if (orgErr || !org) return res.status(404).json({ error: 'Organisation not found' })

    const stripe = new Stripe(STRIPE_SECRET_KEY)
    const origin = req.headers.origin || 'https://app.launchsession.co.uk'

    // Already subscribed? Change the price on the existing subscription rather
    // than sending them through Checkout again -- a second Checkout would
    // create a second subscription and bill them twice.
    if (org.stripe_subscription_id) {
      let existing = null
      try {
        existing = await stripe.subscriptions.retrieve(org.stripe_subscription_id)
      } catch (err) {
        // A subscription id that Stripe no longer knows (test data wiped, or
        // deleted in the dashboard) should not block a fresh checkout.
        console.warn('create-checkout-session: stored subscription not found in Stripe', org.stripe_subscription_id, err?.message)
      }

      if (existing && !['canceled', 'incomplete_expired'].includes(existing.status)) {
        const item = existing.items.data[0]
        if (item.price.id === priceId) {
          return res.status(400).json({ error: `This organisation is already on ${entitlement.label}.` })
        }
        const updated = await stripe.subscriptions.update(existing.id, {
          items: [{ id: item.id, price: priceId }],
          // Bill the difference now rather than at the next renewal, so an
          // upgrade takes effect immediately and is paid for immediately.
          proration_behavior: 'always_invoice',
          metadata: { org_id, plan, cycle },
        })
        // The subscription.updated webhook writes the plan; returning it here
        // only lets the UI show the right thing before that round trip lands.
        return res.status(200).json({ updated: true, plan, cycle, status: updated.status })
      }
    }

    // Reuse an existing Stripe customer for this org, or create one
    let customerId = org.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.contact_email || profile.email,
        name: org.name,
        metadata: { org_id },
      })
      customerId = customer.id
      await adminClient.from('organisations').update({ stripe_customer_id: customerId }).eq('id', org_id)
    }

    // An organisation that subscribes on day 3 of its 14 keeps the other 11.
    // The trial was sold as 14 days free; taking money on day 3 because they
    // made up their mind early would not be that.
    const subscriptionData = { metadata: { org_id, plan, cycle } }
    if (org.plan === 'trial' && org.trial_expires_at) {
      const trialEnd = Math.floor(new Date(org.trial_expires_at).getTime() / 1000)
      const now = Math.floor(Date.now() / 1000)
      if (Number.isFinite(trialEnd) && trialEnd - now >= MIN_TRIAL_SECONDS) {
        subscriptionData.trial_end = trialEnd
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: org_id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
      success_url: success_url || `${origin}/settings?section=billing&checkout=success`,
      cancel_url: cancel_url || `${origin}/settings?section=billing&checkout=cancelled`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('create-checkout-session: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
