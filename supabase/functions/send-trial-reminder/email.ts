// The words and layout of the trial reminder emails, kept apart from the
// sending so they can be previewed without Supabase or Resend.
//
// Prices are never written here. They come from plan_entitlements -- the same
// rows Settings → Billing shows and Stripe charges -- because the first version
// of this email said "Plans start at £29 a month" for weeks after the plans
// became £49.99, £59.99 and £69.99. A price typed into an email goes stale the
// day pricing changes; a price read at send time cannot.

export type Plan = { label: string; monthlyPence: number; annualPence: number | null; childLimit: number | null }

// src/lib/charityDiscount.js and api/create-checkout-session.js hold the same
// figure. Change all three together.
export const CHARITY_DISCOUNT_PERCENT = 20

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// £49.99, and £29 rather than £29.00.
export const pounds = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`

export function copyFor(kind: string, orgName: string, days: number) {
  if (kind === 'ended') {
    return {
      subject: 'Your LaunchSession trial has ended — your data is safe',
      heading: 'Your free trial has ended',
      // "Open", not "open and export": export exists for cases, HR and
      // reports only, so promising it for everything would be untrue.
      body: `${orgName} is now read-only. Every register, concern, risk assessment and record is exactly where you left it — nothing has been deleted, and you can still open and read all of it. Choose a plan to start making changes again.`,
      cta: 'Choose a plan',
    }
  }
  const when = days === 1 ? 'tomorrow' : `in ${days} days`
  return {
    subject: `Your LaunchSession trial ends ${when}`,
    heading: `Your free trial ends ${when}`,
    body: `${orgName} has full access until then. If you choose a plan before it runs out, nothing changes — you keep working and your remaining trial days are not charged for. If the trial does run out, your workspace goes read-only rather than away: nothing is ever deleted.`,
    cta: 'Choose a plan',
  }
}

// Same promise as send-charity-verified-email: the coupon lasts as long as
// the subscription does.
const charityLine = `Registered charity? Add your charity number in Billing and every plan is ${CHARITY_DISCOUNT_PERCENT}% off, for as long as you subscribe.`

export function renderEmail(opts: { kind: string; orgName: string; days: number; link: string; plans: Plan[] }) {
  const { kind, orgName, days, link, plans } = opts
  const BRAND = '#1B9AAA'
  const { subject, heading, body, cta } = copyFor(kind, orgName, days)

  // "Unlimited young people" is said only while it is true of every plan on sale.
  const noCap = plans.length > 0 && plans.every(p => p.childLimit == null)
  const planRows = plans.map((p, i) => `<tr>
<td style="padding:12px 14px 12px 0;${i ? 'border-top:1px solid #E2E8F0;' : ''}font-size:14px;font-weight:700;color:#0F172A;">${esc(p.label)}</td>
<td align="right" style="padding:12px 0;${i ? 'border-top:1px solid #E2E8F0;' : ''}white-space:nowrap;">
<div style="font-size:15px;font-weight:800;color:#0F172A;">${pounds(p.monthlyPence)}<span style="font-size:12px;font-weight:600;color:#64748B;"> a month</span></div>
${p.annualPence ? `<div style="font-size:12px;color:#64748B;margin-top:2px;">or ${pounds(p.annualPence)} a month, paid yearly</div>` : ''}
</td></tr>`).join('\n')

  // No plans means the price lookup failed. The email still goes, without a
  // price list, rather than with a guessed one.
  const plansBlock = plans.length ? `<div style="margin:26px 0 0;padding:4px 18px 6px;border:1px solid #E2E8F0;border-radius:10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${planRows}
</table>
</div>
${noCap ? '<p style="margin:10px 0 0;font-size:12.5px;line-height:1.6;color:#64748B;">Every plan includes unlimited young people.</p>' : ''}` : ''

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:#0F172A;padding:24px 32px;border-top:4px solid ${BRAND};">
<div style="font-size:18px;font-weight:900;color:#ffffff;">LaunchSession</div>
</td></tr>
<tr><td style="padding:28px 32px;">
<h1 style="margin:0 0 14px;font-size:20px;font-weight:800;color:#0F172A;">${esc(heading)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#334155;">${esc(body)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND};">
<a href="${esc(link)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;">${esc(cta)}</a>
</td></tr></table>
${plansBlock}
<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#334155;"><strong>${esc(charityLine.split('?')[0])}?</strong>${esc(charityLine.slice(charityLine.indexOf('?') + 1))}</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;">
You are receiving this because you administer ${esc(orgName)} on LaunchSession.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`

  const planText = plans.map(p => `- ${p.label}: ${pounds(p.monthlyPence)} a month${p.annualPence ? ` (or ${pounds(p.annualPence)} a month, paid yearly)` : ''}`).join('\n')
  const text = [
    heading, body, `${cta}: ${link}`,
    plans.length ? `Plans\n${planText}${noCap ? '\nEvery plan includes unlimited young people.' : ''}` : '',
    charityLine,
  ].filter(Boolean).join('\n\n')

  return { subject, html, text }
}
