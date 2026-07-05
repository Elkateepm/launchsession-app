import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const PLAN_PRICE_ENV = {
  starter: 'STRIPE_PRICE_STARTER',
  pro: 'STRIPE_PRICE_PRO',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
}

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

    const { org_id, plan, success_url, cancel_url } = req.body || {}
    if (!org_id || !plan) return res.status(400).json({ error: 'Missing org_id or plan' })
    if (!PLAN_PRICE_ENV[plan]) return res.status(400).json({ error: `Unknown plan: ${plan}` })

    const priceId = process.env[PLAN_PRICE_ENV[plan]]
    if (!priceId) {
      console.error(`create-checkout-session: missing env var ${PLAN_PRICE_ENV[plan]} for plan ${plan}`)
      return res.status(500).json({ error: `Billing is not configured for the ${plan} plan yet` })
    }

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    // Confirm the calling user belongs to this org and is an admin
    const { data: profile, error: profileErr } = await adminClient
      .from('user_profiles')
      .select('org_id, role, email')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile) return res.status(403).json({ error: 'No profile found for this user' })
    if (profile.org_id !== org_id) return res.status(403).json({ error: 'You do not have access to this organisation' })
    if (profile.role !== 'admin') return res.status(403).json({ error: 'Only admins can manage billing' })

    const { data: org, error: orgErr } = await adminClient
      .from('organisations')
      .select('id, name, stripe_customer_id, contact_email')
      .eq('id', org_id)
      .single()
    if (orgErr || !org) return res.status(404).json({ error: 'Organisation not found' })

    const stripe = new Stripe(STRIPE_SECRET_KEY)

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

    const origin = req.headers.origin || 'https://app.launchsession.co.uk'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: org_id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { org_id, plan } },
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
