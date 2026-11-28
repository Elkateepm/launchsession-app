import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { renderEmail, type Plan } from './email.ts'

// Trial reminder emails. Called once a day by the trial-reminders-daily
// pg_cron job (via api/send-form-email.js), never from a browser.
//
// This is LaunchSession writing to its own customer about their bill, so it is
// deliberately LaunchSession-branded -- org primary_color and logo belong on
// mail the organisation sends to its own families, not on this.
//
// Lived only in Supabase until 28 Nov 2026; this is the source of what is
// deployed. Deploy with verify_jwt on.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const APP_URL = 'https://app.launchsession.co.uk'

// verify_jwt only proves the caller holds *some* valid project key -- the anon
// key qualifies, and that is every visitor. Supabase has already checked the
// signature by the time we get here, so the role claim can be trusted; require
// it to be service_role so a signed-in member cannot post another org's id and
// make us email them.
function isServiceRole(authHeader: string | null): boolean {
  if (!authHeader) return false
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch (_) {
    return false
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  if (!isServiceRole(req.headers.get('Authorization'))) return json({ error: 'Forbidden' }, 403)

  if (!RESEND_API_KEY) {
    console.error('send-trial-reminder: RESEND_API_KEY is not set')
    return json({ error: 'Mail is not configured' }, 500)
  }

  try {
    const { org_id, kind } = await req.json()
    if (!org_id || !['ending_soon', 'ended'].includes(kind)) {
      return json({ error: 'org_id and a valid kind are required' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: org, error: orgErr } = await admin
      .from('organisations')
      .select('id, name, slug, contact_email, trial_expires_at, plan')
      .eq('id', org_id)
      .maybeSingle()
    if (orgErr || !org) return json({ error: 'Organisation not found' }, 404)

    // Whoever can actually act on this: only owners and admins can reach
    // Billing, so telling anyone else would be asking them to do something the
    // app will not let them do.
    const { data: staff } = await admin
      .from('user_profiles')
      .select('email, role')
      .eq('org_id', org_id)
      .in('role', ['owner', 'admin'])

    const recipients = Array.from(new Set(
      [...(staff || []).map((s: { email?: string }) => s.email), org.contact_email]
        .filter((e): e is string => typeof e === 'string' && e.includes('@'))
        .map((e) => e.toLowerCase()),
    ))

    if (recipients.length === 0) {
      console.error('send-trial-reminder: no reachable admin for org', org_id)
      return json({ sent: 0, reason: 'no recipients' })
    }

    // The plans an organisation can buy for itself today, as Settings →
    // Billing lists them. Legacy plans (Starter, Advanced, Pro+) are not
    // self-serve and must never be quoted.
    const { data: planRows, error: planErr } = await admin
      .from('plan_entitlements')
      .select('label, price_monthly_pence, price_annual_pence, child_limit, sort')
      .eq('self_serve', true)
      .not('price_monthly_pence', 'is', null)
      .order('sort')
    if (planErr) console.error('send-trial-reminder: could not read plans', planErr.message)
    const plans: Plan[] = (planRows || []).map((p: { label: string; price_monthly_pence: number; price_annual_pence: number | null; child_limit: number | null }) => ({
      label: p.label,
      monthlyPence: p.price_monthly_pence,
      annualPence: p.price_annual_pence,
      childLimit: p.child_limit,
    }))

    const expiry = org.trial_expires_at ? new Date(org.trial_expires_at) : null
    const days = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : 0
    const link = `${APP_URL}/?org=${encodeURIComponent(org.slug)}&tab=settings&section=billing`
    const { subject, html, text } = renderEmail({ kind, orgName: org.name, days, link, plans })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LaunchSession <hello@launchsession.co.uk>',
        to: recipients,
        reply_to: 'hello@launchsession.co.uk',
        subject,
        text,
        html,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('send-trial-reminder: resend rejected', JSON.stringify(data))
      return json({ error: data }, 500)
    }

    return json({ sent: recipients.length, kind, id: data?.id, plans: plans.length })
  } catch (error) {
    console.error('send-trial-reminder: unhandled', error)
    return json({ error: String((error as Error)?.message || error) }, 500)
  }
})
