import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// "Your charity discount is confirmed". Sent once, when LaunchSession marks an
// organisation's charity number verified in Command Centre. The
// organisations_charity_verified trigger posts to api/send-form-email
// (charity_discount_sync), which puts the 20% coupon on any live Stripe
// subscription and then calls this with what it found, so the email can say
// exactly where the discount stands. Never called from a browser.
//
// LaunchSession writing to its own customer about their bill, so it is
// LaunchSession-branded, like send-trial-reminder.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const APP_URL = 'https://app.launchsession.co.uk'
const BRAND = '#1B9AAA'

const REGULATORS: Record<string, string> = {
  ccew: 'Charity Commission for England and Wales',
  oscr: 'Scottish Charity Regulator (OSCR)',
  ccni: 'Charity Commission for Northern Ireland',
}

// verify_jwt only proves the caller holds some project key; the anon key
// qualifies. Require the service role so nobody else can make us send this.
function isServiceRole(authHeader: string | null): boolean {
  if (!authHeader) return false
  const parts = authHeader.replace(/^Bearer\s+/i, '').split('.')
  if (parts.length !== 3) return false
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))?.role === 'service_role'
  } catch (_) {
    return false
  }
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// What the discount means for them right now, from the Stripe check.
function discountLine(result: string): { line: string; cta: string } {
  switch (result) {
    case 'applied':
      return { line: 'The 20% charity discount is now on your subscription. It comes off from your next invoice, for as long as you subscribe.', cta: 'View your billing' }
    case 'already_applied':
      return { line: 'Your subscription already has the 20% charity discount, and it stays for as long as you subscribe.', cta: 'View your billing' }
    case 'other_discount':
      return { line: 'Your subscription already has another discount on it, so we have left your pricing as it is. If you would rather have the 20% charity discount instead, reply to this email and we will switch it.', cta: 'View your billing' }
    default:
      return { line: 'When you choose a plan, 20% comes off automatically, for as long as you subscribe. There is nothing else you need to do.', cta: 'See plans' }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (!isServiceRole(req.headers.get('Authorization'))) return json({ error: 'Forbidden' }, 403)
  if (!RESEND_API_KEY) {
    console.error('send-charity-verified-email: RESEND_API_KEY is not set')
    return json({ error: 'Mail is not configured' }, 500)
  }

  try {
    const { org_id, discount_result } = await req.json()
    if (!org_id) return json({ error: 'org_id is required' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: org, error: orgErr } = await admin
      .from('organisations')
      .select('id, name, slug, contact_email, charity_number, charity_regulator, charity_status')
      .eq('id', org_id)
      .maybeSingle()
    if (orgErr || !org) return json({ error: 'Organisation not found' }, 404)
    // Only ever confirms a verification that is still in place.
    if (org.charity_status !== 'verified') return json({ sent: 0, reason: 'not verified' })

    // Owners and admins run billing; the contact may be someone else again.
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
    if (!recipients.length) {
      console.error('send-charity-verified-email: no reachable admin for org', org_id)
      return json({ sent: 0, reason: 'no recipients' })
    }

    const regulator = REGULATORS[org.charity_regulator] || 'the charity register'
    const { line, cta } = discountLine(String(discount_result || ''))
    const subject = `Your charity discount is confirmed: 20% off LaunchSession`
    const heading = 'Your charity discount is confirmed'
    const intro = `We have checked charity number ${org.charity_number} with the ${regulator} and confirmed ${org.name} as a registered charity.`
    const link = `${APP_URL}/?org=${encodeURIComponent(org.slug)}&tab=settings&section=billing`

    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:#0F172A;padding:24px 32px;border-top:4px solid ${BRAND};">
<div style="font-size:18px;font-weight:900;color:#ffffff;">LaunchSession</div>
</td></tr>
<tr><td style="padding:28px 32px;">
<div style="display:inline-block;margin:0 0 14px;padding:5px 12px;border-radius:999px;background:#E6F6F4;color:#0F766E;font-size:12px;font-weight:800;">Registered charity · 20% off</div>
<h1 style="margin:0 0 14px;font-size:20px;font-weight:800;color:#0F172A;">${esc(heading)}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">${esc(intro)}</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#334155;">${esc(line)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND};">
<a href="${esc(link)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;">${esc(cta)}</a>
</td></tr></table>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748B;">Thank you for the work you do. Questions about your bill? Reply to this email.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;">
You are receiving this because you administer ${esc(org.name)} on LaunchSession.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`

    const text = `${heading}\n\n${intro}\n\n${line}\n\n${cta}: ${link}\n\nQuestions about your bill? Reply to this email.`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LaunchSession <hello@launchsession.co.uk>',
        to: recipients,
        reply_to: 'hello@launchsession.co.uk',
        subject,
        text,
        html,
        headers: { 'X-Entity-Ref-ID': `charity-verified-${org.id}` },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('send-charity-verified-email: resend rejected', JSON.stringify(data))
      return json({ error: data }, 500)
    }
    return json({ sent: recipients.length, id: data?.id })
  } catch (error) {
    console.error('send-charity-verified-email: unhandled', error)
    return json({ error: String((error as Error)?.message || error) }, 500)
  }
})
