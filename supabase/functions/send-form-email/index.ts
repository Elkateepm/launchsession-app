import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// Same fallback mark used app-wide (favicons, OrgLookup) whenever an org hasn't
// uploaded their own logo yet — a real hosted asset, so it's safe to reference
// from an email (unlike the app's local /logo.png, which only exists client-side).
const LAUNCHSESSION_FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

// The form icon and LaunchSession wordmark used to be inline base64 images.
// Gmail and most Outlook clients refuse data: URIs, so most recipients saw two
// broken images. They are drawn in HTML now, as the registration invite does.

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function isHex(v) {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

// Simple perceived-brightness check so we know whether white or dark text
// reads better on top of an arbitrary org colour.
function isLight(hex) {
  const { r, g, b } = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170
}

// Resend's "from" header only accepts a verified sending domain, so we can't
// send as the org's own address. The org's identity goes in the display name
// while the address stays authenticated (SPF/DKIM). An organisation whose plan
// includes branding sends under its own name alone; the rest say
// "<Org Name> via LaunchSession".
function fromHeader(displayName, branded) {
  const safeName = String(displayName ?? '').replace(/["\r\n]/g, '').trim() || 'LaunchSession'
  return branded
    ? `${safeName} <hello@launchsession.co.uk>`
    : `${safeName} via LaunchSession <hello@launchsession.co.uk>`
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      email,
      org_name,
      org_color,
      org_color2,
      org_logo,
      org_sender_name,
      org_footer_text,
      org_reply_to,
      form_name,
      form_description,
      form_url,
      sender_name,
      // Decided by the caller from organisations.branding_enabled, which the
      // plan sets: no LaunchSession marks anywhere in the email.
      branded,
    } = await req.json()

    const primary = isHex(org_color) ? org_color : '#3B82F6'
    const secondary = isHex(org_color2) && org_color2.toLowerCase() !== primary.toLowerCase() ? org_color2 : '#0EA5E9'
    const headerTextColor = isLight(primary) && isLight(secondary) ? '#0F172A' : '#ffffff'
    const headerSubTextColor = headerTextColor === '#ffffff' ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.65)'
    const senderDisplayName = org_sender_name || org_name
    const subject = `${form_name} — ${org_name}`
    const hasOrgLogo = !!org_logo
    const ctaTextColor = isLight(primary) && isLight(secondary) ? '#0F172A' : '#ffffff'

    // Real logo if the org has uploaded one. Otherwise an unbranded org falls
    // back to the LaunchSession mark, clearly "sent via LaunchSession on this
    // org's behalf"; a branded org shows its name alone.
    const logoBlock = hasOrgLogo && branded
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;"><tr><td style="background:#ffffff;border-radius:14px;padding:10px 16px;box-shadow:0 6px 18px rgba(0,0,0,0.18);"><img src="${esc(org_logo)}" alt="${esc(org_name)}" style="display:block;max-height:56px;max-width:200px;object-fit:contain;" /></td></tr></table>`
      : hasOrgLogo
      ? `<img src="${esc(org_logo)}" alt="${esc(org_name)}" style="max-height:64px;max-width:220px;object-fit:contain;display:block;margin:0 auto 14px;" />`
      : branded
        ? ''
        : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;"><tr><td width="56" height="56" align="center" valign="middle" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.18);"><img src="${LAUNCHSESSION_FALLBACK_LOGO_URL}" width="56" height="56" alt="LaunchSession" style="display:block;width:56px;height:56px;object-fit:contain;border-radius:16px;" /></td></tr></table>`

    const poweredByLabel = branded ? '' : hasOrgLogo ? 'Powered by LaunchSession' : 'Sent via LaunchSession'

    // Org's own footer line (e.g. "Solidarity Sports · Registered Charity No. 123456").
    const orgFooterBlock = org_footer_text
      ? `<p style="margin:0 0 10px; font-size:12px; font-weight:700; color:#475569;">${esc(org_footer_text)}</p>`
      : branded
        ? `<p style="margin:0 0 10px; font-size:12px; font-weight:700; color:#475569;">${esc(org_name)}</p>`
        : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:40px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.12);">

        <tr>
          <td style="background:${primary};background-image:linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);padding:38px 32px 32px;text-align:center;">
            ${logoBlock}
            <div style="font-size:22px;font-weight:900;color:${headerTextColor};letter-spacing:-0.4px;">${esc(org_name)}</div>
            ${poweredByLabel ? `<div style="margin-top:10px;display:inline-block;padding:5px 14px;border-radius:99px;background:${headerTextColor === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.08)'};font-size:10.5px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:${headerSubTextColor};">${poweredByLabel}</div>` : ''}
          </td>
        </tr>

        <tr>
          <td style="padding:40px 32px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
              <tr><td width="56" height="56" align="center" valign="middle" style="background:${primary};background-image:linear-gradient(135deg, ${primary}, ${secondary});border-radius:16px;font-size:26px;box-shadow:0 8px 20px ${rgba(primary, 0.35)};">📝</td></tr>
            </table>
            <h1 style="margin:0 0 12px;font-size:25px;font-weight:900;color:#0F172A;text-align:center;letter-spacing:-0.4px;">${esc(form_name)}</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;text-align:center;">
              ${sender_name ? `${esc(sender_name)} at ` : ''}<strong style="color:#0F172A;">${esc(org_name)}</strong> has asked you to complete this form.${form_description ? ` ${esc(form_description)}` : ''}
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:${primary};background-image:linear-gradient(135deg, ${primary}, ${secondary});border-radius:12px;text-align:center;box-shadow:0 10px 24px ${rgba(primary, 0.35)};">
                        <a href="${form_url}" style="display:inline-block;padding:16px 40px;font-size:15.5px;font-weight:800;color:${ctaTextColor};text-decoration:none;border-radius:12px;mso-padding-alt:16px 40px;">
                          Complete Form →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr>
                <td style="background:${rgba(primary, 0.06)};border:1px solid ${rgba(primary, 0.18)};border-left:4px solid ${primary};border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:11.5px;font-weight:800;color:${primary};text-transform:uppercase;letter-spacing:0.7px;">Organisation</p>
                  <p style="margin:0;font-size:16px;font-weight:800;color:#0F172A;">${esc(org_name)}</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:12px;color:#94A3B8;text-align:center;">Or copy this link into your browser:</p>
            <p style="margin:0;font-size:11px;color:${primary};word-break:break-all;text-align:center;">
              <a href="${form_url}" style="color:${primary};font-weight:600;">${form_url}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px;">
            <div style="border-top:1px solid #E2E8F0;"></div>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 32px;text-align:center;">
            ${orgFooterBlock}
            ${branded ? '' : `<p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#0F172A;">
              Launch<span style="color:${primary};">Session</span>
            </p>`}
            <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">
              ${branded ? '' : 'Organisation OS for charities &amp; youth organisations<br>'}
              If you weren't expecting this, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>

      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;margin-top:20px;">
        <tr>
          <td style="text-align:center;font-size:11px;color:#94A3B8;">
            ${branded ? `© ${new Date().getFullYear()} ${esc(org_name)}` : `© ${new Date().getFullYear()} LaunchSession · <a href="https://www.launchsession.co.uk" style="color:#94A3B8;">launchsession.co.uk</a>`}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

    const text = `${form_name}\n\n${sender_name ? `${sender_name} at ` : ''}${org_name} has asked you to complete this form.${form_description ? ` ${form_description}` : ''}\n\nComplete Form:\n${form_url}\n\n---\n${org_footer_text ? `${org_footer_text}\n` : branded ? `${org_name}\n` : ''}${branded ? '' : 'LaunchSession · Organisation OS for charities\n'}If you weren't expecting this, you can safely ignore this email.`

    const emailPayload = {
      from: fromHeader(senderDisplayName, branded),
      to: [email],
      subject,
      headers: {
        'List-Unsubscribe': '<mailto:hello@launchsession.co.uk?subject=unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
      text,
      html,
    }

    // Route replies to the org's own contact address when they've set one, so a
    // recipient hitting "reply" reaches the organisation rather than LaunchSession's
    // generic inbox.
    if (org_reply_to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(org_reply_to)) {
      emailPayload.reply_to = org_reply_to
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const data = await res.json()

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
