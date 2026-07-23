import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// Same fallback mark used app-wide (favicons, OrgLookup, other transactional emails)
// whenever an org hasn't uploaded their own logo yet.
const LAUNCHSESSION_FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

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

function isLight(hex) {
  const { r, g, b } = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170
}

// Resend only sends from a single verified domain, so the org's own identity
// goes in the display name while the actual address stays authenticated.
function fromHeader(displayName) {
  const safeName = String(displayName ?? '').replace(/["\r\n]/g, '').trim() || 'LaunchSession'
  return `${safeName} via LaunchSession <hello@launchsession.co.uk>`
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
      registration_url,
      sender_name,
      parent_name,
    } = await req.json()

    const primary = isHex(org_color) ? org_color : '#1B9AAA'
    const secondary = isHex(org_color2) && org_color2.toLowerCase() !== primary.toLowerCase() ? org_color2 : '#123B30'
    const headerTextColor = isLight(primary) && isLight(secondary) ? '#0F172A' : '#ffffff'
    const headerSubTextColor = headerTextColor === '#ffffff' ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.65)'
    const senderDisplayName = org_sender_name || org_name
    const greetingName = parent_name ? esc(parent_name) : 'there'
    const subject = `Register your child with ${org_name}`
    const hasOrgLogo = !!org_logo
    const ctaTextColor = isLight(primary) && isLight(secondary) ? '#0F172A' : '#ffffff'

    const logoBlock = hasOrgLogo
      ? `<img src="${esc(org_logo)}" alt="${esc(org_name)}" style="max-height:64px;max-width:220px;object-fit:contain;display:block;margin:0 auto 14px;" />`
      : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;"><tr><td width="56" height="56" align="center" valign="middle" style="background:#ffffff;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.18);"><img src="${LAUNCHSESSION_FALLBACK_LOGO_URL}" width="56" height="56" alt="LaunchSession" style="display:block;width:56px;height:56px;object-fit:contain;border-radius:16px;" /></td></tr></table>`

    const poweredByLabel = hasOrgLogo ? 'Powered by LaunchSession' : 'Sent via LaunchSession'

    const orgFooterBlock = org_footer_text
      ? `<p style="margin:0 0 10px; font-size:12px; font-weight:700; color:#475569;">${esc(org_footer_text)}</p>`
      : ''

    // What a parent will need on hand — set expectations before they click through,
    // rather than surprising them mid-form.
    const checklistItems = [
      "Your child's full name and date of birth",
      'Your contact details and an emergency contact',
      'Any allergies, medical conditions, or support needs',
      'Photo, trip, and medical treatment consent decisions',
    ]
    const checklistHtml = checklistItems.map(item => `
      <tr>
        <td style="padding:4px 0;vertical-align:top;width:20px;"><span style="color:${primary};font-weight:900;">✓</span></td>
        <td style="padding:4px 0;font-size:13.5px;color:#334155;line-height:1.5;">${esc(item)}</td>
      </tr>`).join('')

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
            <div style="margin-top:10px;display:inline-block;padding:5px 14px;border-radius:99px;background:${headerTextColor === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.08)'};font-size:10.5px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:${headerSubTextColor};">${poweredByLabel}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 32px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
              <tr><td width="56" height="56" align="center" valign="middle" style="background:${primary};background-image:linear-gradient(135deg, ${primary}, ${secondary});border-radius:16px;font-size:26px;box-shadow:0 8px 20px ${rgba(primary, 0.35)};">🧒</td></tr>
            </table>
            <h1 style="margin:0 0 12px;font-size:25px;font-weight:900;color:#0F172A;text-align:center;letter-spacing:-0.4px;">Register your child</h1>
            <p style="margin:0 0 26px;font-size:15px;color:#475569;line-height:1.7;text-align:center;">
              Hi ${greetingName} — ${sender_name ? `${esc(sender_name)} at ` : ''}<strong style="color:#0F172A;">${esc(org_name)}</strong> has invited you to register your child. It takes about five minutes.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:${primary};background-image:linear-gradient(135deg, ${primary}, ${secondary});border-radius:12px;text-align:center;box-shadow:0 10px 24px ${rgba(primary, 0.35)};">
                        <a href="${registration_url}" style="display:inline-block;padding:16px 40px;font-size:15.5px;font-weight:800;color:${ctaTextColor};text-decoration:none;border-radius:12px;mso-padding-alt:16px 40px;">
                          Start Registration →
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
                  <p style="margin:0 0 8px;font-size:11.5px;font-weight:800;color:${primary};text-transform:uppercase;letter-spacing:0.7px;">What you'll need</p>
                  <table role="presentation" cellpadding="0" cellspacing="0">${checklistHtml}</table>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr>
                <td style="background:${rgba(primary, 0.04)};border-radius:10px;padding:14px 18px;">
                  <p style="margin:0 0 4px;font-size:11.5px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:0.6px;">What happens next</p>
                  <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">Your submission goes to ${esc(org_name)} for review. They'll be in touch once it's approved — nothing is finalised until then.</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;font-size:12px;color:#94A3B8;text-align:center;">Or copy this link into your browser:</p>
            <p style="margin:0;font-size:11px;color:${primary};word-break:break-all;text-align:center;">
              <a href="${registration_url}" style="color:${primary};font-weight:600;">${registration_url}</a>
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
            <p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#0F172A;">
              Launch<span style="color:${primary};">Session</span>
            </p>
            <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">
              Organisation OS for charities &amp; youth organisations<br>
              If you weren't expecting this, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>

      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;margin-top:20px;">
        <tr>
          <td style="text-align:center;font-size:11px;color:#94A3B8;">
            © ${new Date().getFullYear()} LaunchSession · <a href="https://www.launchsession.co.uk" style="color:#94A3B8;">launchsession.co.uk</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

    const text = `Register your child with ${org_name}\n\nHi ${parent_name || 'there'} — ${sender_name ? `${sender_name} at ` : ''}${org_name} has invited you to register your child.\n\nWhat you'll need:\n${checklistItems.map(i => `- ${i}`).join('\n')}\n\nStart Registration:\n${registration_url}\n\nYour submission goes to ${org_name} for review — they'll be in touch once it's approved.\n\n---\n${org_footer_text ? `${org_footer_text}\n` : ''}LaunchSession · Organisation OS for charities\nIf you weren't expecting this, you can safely ignore this email.`

    const emailPayload = {
      from: fromHeader(senderDisplayName),
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
