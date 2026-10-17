const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const DEFAULT_COLOR = '#8B5CF6'

function logoMark(size) {
  const box = size === 'lg' ? 40 : 28
  const font = size === 'lg' ? 20 : 15
  const radius = size === 'lg' ? 12 : 9
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;"><tr>
      <td width="${box}" height="${box}" align="center" valign="middle" bgcolor="#8B5CF6"
        style="background: linear-gradient(135deg,#8B5CF6,#A855F7); border-radius: ${radius}px; font-family: ${FONT}; font-size: ${Math.round(box * 0.55)}px; font-weight: 800; color: #ffffff; line-height: ${box}px;">L</td>
      <td style="padding-left: 10px; font-family: ${FONT}; font-size: ${font}px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">LaunchSession</td>
    </tr></table>
  `
}

function shade(hex, percent) {
  const clean = hex.replace('#', '')
  const num = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16)
  const amt = Math.round(2.55 * percent)
  const r = Math.min(255, Math.max(0, (num >> 16) + amt))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amt))
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)
}

export function createPasswordResetHandler({ createClient, env, fetch: sendEmail = fetch }) {
  return async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const respond = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  try {
    let body
    try { body = await req.json() } catch (e) { return respond({ error: 'Invalid request' }, 400) }
    const { org_name, org_slug, org_logo, org_color, redirect_to } = body || {}
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return respond({ error: 'A valid email is required' }, 400)
    const RESEND_API_KEY = env('RESEND_API_KEY')
    const SUPABASE_URL = env('SUPABASE_URL')
    const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) return respond({ error: 'Password reset is temporarily unavailable' }, 503)

    const orgName = typeof org_name === 'string' && org_name.trim() ? org_name.trim().slice(0, 150) : 'LaunchSession'
    const safeOrgName = escapeHtml(orgName)
    const isValidHex = typeof org_color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(org_color)
    const accent = isValidHex ? org_color : DEFAULT_COLOR
    const accentLight = shade(accent, 20)
    const accentDark = shade(accent, -55)

    // Never trust caller-supplied origins: a recovery token must only reach
    // our app. Build the destination ourselves, preserving only known context.
    const destination = new URL('https://app.launchsession.co.uk/reset-password')
    if (typeof org_slug === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(org_slug)) destination.searchParams.set('org', org_slug)
    try {
      if (new URL(redirect_to).searchParams.get('portal') === 'volunteer') destination.searchParams.set('portal', 'volunteer')
    } catch (e) {}
    const redirectTo = destination.href
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    // Unknown addresses receive the same response as successful requests.
    // Operational failures must not be disguised as an email being sent.
    if (linkError?.code === 'user_not_found') return respond({ success: true })
    if (linkError || !linkData?.properties?.hashed_token) return respond({ error: 'Could not create a reset link' }, 502)

    // A direct application link avoids the shared Auth Site URL fallback and
    // is consumed only after the recipient presses Continue on the reset page.
    destination.hash = new URLSearchParams({ token_hash: linkData.properties.hashed_token, type: 'recovery' }).toString()
    const actionUrl = destination.href
    const safeActionUrl = escapeHtml(actionUrl)
    const subject = `Reset your ${orgName} password`

    const logo = typeof org_logo === 'string' && /^https:\/\//i.test(org_logo) ? escapeHtml(org_logo) : ''
    const orgBadge = logo
      ? `<img src="${logo}" alt="${safeOrgName}" width="64" height="64" style="display:block; width:64px; height:64px; border-radius:50%; object-fit:cover; margin: 0 auto 20px; border: 3px solid rgba(255,255,255,0.25);" />`
      : `<div style="width:64px; height:64px; margin: 0 auto 20px; border-radius: 50%; background: rgba(255,255,255,0.12); display: inline-flex; align-items: center; justify-content: center; font-size: 28px; line-height: 64px;">🔒</div>`

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table {border-collapse: collapse;} td, th, div, p, a, h1, h2, h3 {font-family: Arial, Helvetica, sans-serif;}</style>
<![endif]-->
<style>
  html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; background-color: #070B16; }
  * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  #MessageViewBody a { color: inherit; text-decoration: none; }
  p { margin: 0; }
  .cta-btn:hover { box-shadow: 0 0 28px ${accent}88 !important; }
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid { width: 100% !important; max-width: 100% !important; }
    .px-mobile { padding-left: 20px !important; padding-right: 20px !important; }
    .h1-mobile { font-size: 24px !important; line-height: 32px !important; }
  }
  @media (prefers-color-scheme: dark) { .bg-body { background-color: #070B16 !important; } }
  [data-ogsc] .bg-body { background-color: #070B16 !important; }
  [data-ogsc] .force-white { color: #ffffff !important; }
</style>
</head>
<body class="bg-body" style="margin:0; padding:0; background-color:#070B16; width:100%;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#070B16;">
  Reset your ${safeOrgName} password on LaunchSession. Use the latest reset email to continue. &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-body" style="background-color:#070B16;">
<tr><td align="center" style="padding: 32px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container fluid" style="width:600px; max-width:600px;">

    <tr><td align="center" class="px-mobile" style="padding: 8px 24px 20px;">
      ${logoMark('lg')}
    </td></tr>

    <tr><td class="px-mobile" style="padding: 0 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${accent}"
        style="background-color:${accent}; background-image: linear-gradient(150deg, ${accentDark} 0%, ${accentDark} 32%, ${accent} 68%, ${accentLight} 100%); border-radius: 24px; overflow: hidden;">
        <tr><td align="center" style="padding: 44px 32px 40px;">
          ${orgBadge}
          <h1 class="h1-mobile force-white" style="margin:0 0 10px; font-family: ${FONT}; font-size: 26px; line-height: 34px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Reset your password</h1>
          <p style="margin: 0 auto; max-width: 420px; font-family: ${FONT}; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.75);">
            We received a request to reset the password for your <strong style="color:#ffffff; font-weight:600;">${safeOrgName}</strong> account on LaunchSession.
          </p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" class="px-mobile" style="padding: 32px 24px 8px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeActionUrl}" style="height:54px;v-text-anchor:middle;width:280px;" arcsize="26%" strokecolor="${accent}" fillcolor="${accent}">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Reset password</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${safeActionUrl}" class="cta-btn" target="_blank"
        style="background: ${accent}; background-image: linear-gradient(135deg, ${accent}, ${accentLight}); border-radius: 14px; color: #ffffff; display: inline-block; font-family: ${FONT}; font-size: 16px; font-weight: 700; line-height: 54px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; box-shadow: 0 0 20px ${accent}59;">
        Reset password
      </a>
      <!--<![endif]-->
      <p style="margin: 14px 0 0; font-family: ${FONT}; font-size: 12px; color: rgba(255,255,255,0.4);">For your security, this link can only be used once.</p>
    </td></tr>

    <tr><td class="px-mobile" style="padding: 28px 12px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px;">
        <tr><td style="padding: 22px 26px;">
          <p style="margin:0; font-family: ${FONT}; font-size: 13px; line-height: 21px; color: rgba(255,255,255,0.55);">
            If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
          </p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" class="px-mobile" style="padding: 40px 24px 12px;">
      <div style="margin: 0 auto 14px;">${logoMark('sm')}</div>
      <p style="margin:0 0 18px; font-family: ${FONT}; font-size: 12px; color: rgba(255,255,255,0.4);">Empowering youth. Every session.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 18px;"><tr>
        <td style="padding: 0 10px; font-family: ${FONT}; font-size: 12px;"><a href="https://www.launchsession.co.uk" style="color: rgba(255,255,255,0.5); text-decoration: none;">Website</a></td>
        <td style="color: rgba(255,255,255,0.2); font-size: 12px;">·</td>
        <td style="padding: 0 10px; font-family: ${FONT}; font-size: 12px;"><a href="https://www.launchsession.co.uk/privacy" style="color: rgba(255,255,255,0.5); text-decoration: none;">Privacy policy</a></td>
        <td style="color: rgba(255,255,255,0.2); font-size: 12px;">·</td>
        <td style="padding: 0 10px; font-family: ${FONT}; font-size: 12px;"><a href="https://www.launchsession.co.uk/terms" style="color: rgba(255,255,255,0.5); text-decoration: none;">Terms</a></td>
      </tr></table>
      <p style="margin:0; font-family: ${FONT}; font-size: 11px; color: rgba(255,255,255,0.3);">© ${new Date().getFullYear()} LaunchSession. All rights reserved.</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`

    const text = `Reset your ${orgName} password\n\nWe received a request to reset the password for your ${orgName} account on LaunchSession.\n\n${actionUrl}\n\nUse the latest reset email to continue. If you didn't request this, you can ignore this email.\n\n---\nLaunchSession · Organisation OS for charities`

    const res = await sendEmail('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LaunchSession <hello@launchsession.co.uk>',
        to: [email],
        subject,
        headers: {
          'List-Unsubscribe': '<mailto:hello@launchsession.co.uk?subject=unsubscribe>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Entity-Ref-ID': crypto.randomUUID(),
        },
        text,
        html,
      }),
    })

    if (!res.ok) return respond({ error: 'Could not send the reset email. Please try again.' }, 502)
    return respond({ success: true })
  } catch (error) {
    return respond({ error: 'Password reset is temporarily unavailable. Please try again.' }, 503)
  }
  }
}
