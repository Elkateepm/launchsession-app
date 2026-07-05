import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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
      console.error('create-portal-session: missing required env vars', {
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

    const { org_id, return_url } = req.body || {}
    if (!org_id) return res.status(400).json({ error: 'Missing org_id' })

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    const { data: profile, error: profileErr } = await adminClient
      .from('user_profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()
    if (profileErr || !profile) return res.status(403).json({ error: 'No profile found for this user' })
    if (profile.org_id !== org_id) return res.status(403).json({ error: 'You do not have access to this organisation' })
    if (profile.role !== 'admin') return res.status(403).json({ error: 'Only admins can manage billing' })

    const { data: org, error: orgErr } = await adminClient
      .from('organisations')
      .select('stripe_customer_id')
      .eq('id', org_id)
      .single()
    if (orgErr || !org) return res.status(404).json({ error: 'Organisation not found' })
    if (!org.stripe_customer_id) return res.status(400).json({ error: 'This organisation has no billing account yet. Upgrade a plan first.' })

    const stripe = new Stripe(STRIPE_SECRET_KEY)
    const origin = req.headers.origin || 'https://app.launchsession.co.uk'

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: return_url || `${origin}/settings?section=billing`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('create-portal-session: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
