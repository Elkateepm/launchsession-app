import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const FALLBACK_BRAND = '#8B5CF6'
const FALLBACK_BRAND_2 = '#A855F7'

const LAUNCHSESSION_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-rocket-logo.png'

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

function rgbaOf(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

// Returns hex, not rgb(): brandLight is passed back through rgbaOf() for the
// role badge, and an rgb() string parsed as hex rendered rgba(NaN,...).
function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const channel = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`
}

// The gateway has already checked the token's signature (verify_jwt), so the
// claims can be read as-is. Only server code holding the service role may send:
// with the public anon key alone, anyone could have this send a LaunchSession
// welcome email, with any organisation name and any link, to any address.
function callerRole(req) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part + '='.repeat((4 - part.length % 4) % 4))).role || null
  } catch (_e) {
    return null
  }
}

function isLight(hex) {
  const { r, g, b } = hexToRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170
}

const ROLE_CONTENT = {
  admin: {
    emphasis: "You've got the keys — manage your organisation, your team, and everything in between.",
    cards: [
      { icon: '🏢', title: 'Organisation settings', body: 'Branding, groups and locations, all in one place.' },
      { icon: '👥', title: 'Staff & volunteers', body: 'Invite your team and manage permissions.' },
      { icon: '🛡️', title: 'Safeguarding', body: 'Oversee cases and DSL reporting.' },
      { icon: '📈', title: 'Reports', body: "Track attendance and your organisation's impact." },
    ],
    chips: ['Organisation Settings', 'Team & Permissions', 'Safeguarding', 'Reports'],
  },
  staff: {
    emphasis: 'Plan sessions, run registers, and keep every young person safe — all from one dashboard.',
    cards: [
      { icon: '📅', title: 'Plan sessions', body: 'Create and manage activities.' },
      { icon: '👥', title: 'Manage registers', body: 'Live attendance and sign in/out.' },
      { icon: '🛡️', title: 'Safeguarding', body: 'Record incidents securely.' },
      { icon: '📈', title: 'Reports', body: 'Track attendance and outcomes.' },
    ],
    chips: ['Session Planning', 'Registers', 'Safeguarding', 'Reports'],
  },
  volunteer: {
    emphasis: "Check your upcoming sessions, update your availability, and stay in the loop with your team.",
    cards: [
      { icon: '📅', title: 'Upcoming sessions', body: 'See what you\'re signed up for next.' },
      { icon: '💬', title: 'Messaging', body: 'Stay connected with your team.' },
      { icon: '🕒', title: 'Availability', body: 'Let your organisation know when you can help.' },
      { icon: '✅', title: 'Session sign-in', body: 'Quick sign in/out on session day.' },
    ],
    chips: ['Upcoming Sessions', 'Messaging', 'Availability'],
  },
  default: {
    emphasis: 'Everything you need to help run your organisation is now in one place.',
    cards: [
      { icon: '📅', title: 'Plan sessions', body: 'Create and manage activities.' },
      { icon: '👥', title: 'Manage registers', body: 'Live attendance and sign in/out.' },
      { icon: '🛡️', title: 'Safeguarding', body: 'Record incidents securely.' },
      { icon: '📈', title: 'Reports', body: 'Track attendance and outcomes.' },
    ],
    chips: ['Session Planning', 'Registers', 'Safeguarding', 'Reports'],
  },
}

function logoMark(size) {
  const box = size === 'lg' ? 40 : 28
  const font = size === 'lg' ? 20 : 15
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;"><tr>
      <td width="${box}" height="${box}" align="center" valign="middle">
        <img src="${LAUNCHSESSION_LOGO_URL}" width="${box}" height="${box}" alt="LaunchSession" style="display:block; width:${box}px; height:${box}px; object-fit:contain; border-radius: ${Math.round(box * 0.3)}px;" />
      </td>
      <td style="padding-left: 10px; font-family: ${FONT}; font-size: ${font}px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">LaunchSession</td>
    </tr></table>
  `
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (callerRole(req) !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const {
      email,
      full_name,
      org_name,
      org_slug,
      org_logo,
      org_color,
      token,
      role,
      redirect_to,
      existing_user,
    } = await req.json()

    const firstName = esc(full_name?.split(' ')[0] || full_name || 'there')
    const lastName  = esc(full_name?.split(' ').slice(1).join(' ') || '')
    const isVolunteer = role === 'volunteer'
    const isExisting  = !!existing_user
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member'
    const orgNameRaw = org_name || 'your organisation'
    const orgName = esc(orgNameRaw)
    const roleKey = (role === 'admin' || role === 'staff' || role === 'volunteer') ? role : 'default'
    const roleContent = ROLE_CONTENT[roleKey]

    const hasOrgColour = isHex(org_color)
    const brand = hasOrgColour ? org_color : FALLBACK_BRAND
    const brandLight = hasOrgColour ? mix(org_color, '#ffffff', 0.22) : FALLBACK_BRAND_2
    const brandDeep = hasOrgColour ? mix(org_color, '#000000', 0.58) : '#2A1458'
    const brandCtaText = isLight(brand) ? '#0F172A' : '#ffffff'
    const hasOrgLogo = !!org_logo

    const inviteUrl = token
      ? `https://app.launchsession.co.uk/create-password?token=${token}`
      : (redirect_to || `https://app.launchsession.co.uk/?org=${org_slug}`)

    const actionUrl = isExisting
      ? `https://app.launchsession.co.uk/?org=${org_slug}`
      : inviteUrl

    const subject = isExisting
      ? `You've been added to ${orgNameRaw} on LaunchSession`
      : isVolunteer
        ? `You've been invited to volunteer with ${orgNameRaw} 🚀`
        : `Welcome to ${orgNameRaw} on LaunchSession 🚀`

    const ctaLabel = isExisting ? 'Go to workspace' : 'Set password'

    const featureChips = roleContent.chips.map((label, i) => `
      <span class="chip-pop" style="animation-delay: ${0.15 + i * 0.12}s; display:inline-block; margin: 3px; padding: 7px 14px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.22); border-radius: 99px; font-family: ${FONT}; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.9);">✓ ${label}</span>
    `).join('')

    const orgIdentityBlock = hasOrgLogo
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 18px;"><tr><td align="center">
          <img src="${esc(org_logo)}" alt="${orgName}" width="72" style="display:block; max-height:72px; max-width:220px; width:auto; height:auto; object-fit:contain; margin:0 auto 12px; background:#ffffff; border-radius:14px; padding:10px 16px;" />
          <span style="display:inline-block; padding: 4px 12px; border-radius: 99px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.18); font-family: ${FONT}; font-size: 10px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; color: rgba(255,255,255,0.7);">⚡ Powered by LaunchSession</span>
        </td></tr></table>
      `
      : hasOrgColour
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 18px;"><tr><td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;"><tr><td width="60" height="60" align="center" valign="middle" class="org-badge-pulse" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35); border-radius: 18px; font-family: ${FONT}; font-size: 24px; font-weight: 900; color: #ffffff;">${esc(orgNameRaw.charAt(0).toUpperCase())}</td></tr></table>
          <span style="display:inline-block; padding: 4px 12px; border-radius: 99px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.18); font-family: ${FONT}; font-size: 10px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase; color: rgba(255,255,255,0.7);">⚡ Powered by LaunchSession</span>
        </td></tr></table>
      `
      : `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 18px;"><tr><td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="org-badge-pulse" style="margin:0 auto; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px;"><tr><td style="padding: 12px 18px;">
            <img src="${LAUNCHSESSION_LOGO_URL}" width="52" height="52" alt="LaunchSession" style="display:block; width:52px; height:52px; object-fit:contain;" />
          </td></tr></table>
        </td></tr></table>
      `

    const accountDetailsBlock = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px;">
        <tr><td style="padding: 24px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: ${FONT}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.4);">Name</td>
              <td align="right" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: ${FONT}; font-size: 14px; font-weight: 600; color: #ffffff;">${firstName} ${lastName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: ${FONT}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.4);">Organisation</td>
              <td align="right" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: ${FONT}; font-size: 14px; font-weight: 600; color: #ffffff;">${orgName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: ${FONT}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.4);">Email</td>
              <td align="right" style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-family: ${FONT}; font-size: 14px; font-weight: 600; color: #ffffff;">${esc(email)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-family: ${FONT}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.4);">Role</td>
              <td align="right" style="padding: 8px 0;">
                <span style="display:inline-block; padding: 4px 12px; background: ${rgbaOf(brand, 0.2)}; border: 1px solid ${rgbaOf(brandLight, 0.45)}; border-radius: 99px; font-family: ${FONT}; font-size: 12px; font-weight: 700; color: ${brandLight};">${roleLabel}</span>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    `

    const stepCircle = (n, label, colourCss) => `
      <tr><td align="center" style="padding-bottom: 6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="32" height="32" align="center" valign="middle" style="background: ${colourCss}; border-radius: 50%; font-family: ${FONT}; font-size: 13px; font-weight: 700; color: #ffffff;">${n}</td>
          <td style="padding-left: 12px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: #ffffff;">${label}</td>
        </tr></table>
      </td></tr>
      <tr><td align="center" style="padding: 2px 0; font-size: 13px; color: rgba(255,255,255,0.3);">↓</td></tr>
    `

    const quickStartBlock = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px;">
        <tr><td style="padding: 28px;">
          <p style="margin:0 0 20px; font-family: ${FONT}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: rgba(255,255,255,0.4); text-align: center;">Quick start</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${stepCircle('1', 'Create your password', `linear-gradient(135deg, ${brand}, ${brandLight})`)}
            ${stepCircle('2', 'Sign into LaunchSession', `linear-gradient(135deg, ${brand}, ${brandLight})`)}
            ${stepCircle('3', 'Complete your profile', `linear-gradient(135deg, ${brand}, ${brandLight})`)}
            <tr><td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="32" height="32" align="center" valign="middle" bgcolor="#22C55E" style="background: linear-gradient(135deg,#22C55E,#16A34A); border-radius: 50%; font-family: ${FONT}; font-size: 15px; font-weight: 700; color: #ffffff;">✓</td>
                <td style="padding-left: 12px; font-family: ${FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">You're ready!</td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
      </table>
    `

    const whatYouCanDoBlock = `
      <p style="margin:0 0 16px; font-family: ${FONT}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: rgba(255,255,255,0.4); text-align: center;">What you can do</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${roleContent.cards.slice(0, 2).map((c, i) => `
          <td width="50%" valign="top" style="padding: 0 ${i === 0 ? '6px 12px 0' : '0 12px 6px'};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 16px;">
              <tr><td style="padding: 20px;">
                <div style="font-size: 22px; margin-bottom: 8px;">${c.icon}</div>
                <p style="margin:0 0 4px; font-family: ${FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">${c.title}</p>
                <p style="margin:0; font-family: ${FONT}; font-size: 13px; line-height: 19px; color: rgba(255,255,255,0.55);">${c.body}</p>
              </td></tr>
            </table>
          </td>`).join('')}
        </tr>
        <tr>
          ${roleContent.cards.slice(2, 4).map((c, i) => `
          <td width="50%" valign="top" style="padding: 0 ${i === 0 ? '6px 0 0' : '0 0 0 6px'};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 16px;">
              <tr><td style="padding: 20px;">
                <div style="font-size: 22px; margin-bottom: 8px;">${c.icon}</div>
                <p style="margin:0 0 4px; font-family: ${FONT}; font-size: 14px; font-weight: 700; color: #ffffff;">${c.title}</p>
                <p style="margin:0; font-family: ${FONT}; font-size: 13px; line-height: 19px; color: rgba(255,255,255,0.55);">${c.body}</p>
              </td></tr>
            </table>
          </td>`).join('')}
        </tr>
      </table>
    `

    const testimonialBlock = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px;">
        <tr><td align="center" style="padding: 28px 32px;">
          <p style="margin:0 0 14px; font-family: ${FONT}; font-size: 15px; letter-spacing: 2px; color: #FBBF24;">★★★★★</p>
          <p style="margin:0 0 16px; font-family: ${FONT}; font-size: 15px; line-height: 24px; font-style: italic; color: rgba(255,255,255,0.85); max-width: 440px;">
            "LaunchSession has transformed how we deliver youth sessions. Everything is easier. Everything is safer. Our team absolutely loves it."
          </p>
          <p style="margin:0; font-family: ${FONT}; font-size: 13px; font-weight: 700; color: #ffffff;">Solidarity Sports</p>
          <p style="margin:2px 0 0; font-family: ${FONT}; font-size: 12px; color: rgba(255,255,255,0.4);">London</p>
        </td></tr>
      </table>
    `

    const heroHeadline = isExisting ? `You're in, ${firstName}!` : `Welcome aboard, ${firstName}!`
    const heroSub = isExisting
      ? `<strong style="color:#ffffff; font-weight:600;">${orgName}</strong> has added you to their team on LaunchSession. Your existing login still works — just sign in to access this workspace.`
      : `You're now part of <strong style="color:#ffffff; font-weight:600;">${orgName}</strong> on LaunchSession. ${roleContent.emphasis}`

    const welcomeCardTitle = isExisting ? 'Added to a new workspace 👋' : 'Welcome to the team 👋'
    const welcomeCardBody = isExisting
      ? `Your account has been added to ${orgName}. LaunchSession has been designed to make delivering youth sessions easier, safer and more enjoyable — everything you need is just a few clicks away.`
      : `We're excited to have you join ${orgName}. LaunchSession has been designed to make delivering youth sessions easier, safer and more enjoyable. Whether you're signing young people in, recording safeguarding concerns or planning your next session, everything you need is just a few clicks away.`

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${subject}</title>
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
  @keyframes twinkle { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
  @keyframes floaty { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
  @keyframes chip-pop { 0% { transform: scale(0.85); } 55% { transform: scale(1.08); } 100% { transform: scale(1); } }
  @keyframes badge-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.35); } 50% { box-shadow: 0 0 0 8px rgba(255,255,255,0); } }
  @keyframes cta-glow { 0%, 100% { box-shadow: 0 0 20px ${rgbaOf(brand, 0.35)}; } 50% { box-shadow: 0 0 36px ${rgbaOf(brand, 0.7)}; } }
  .spark { animation: twinkle 2.4s ease-in-out infinite; opacity: 0.7; display: inline-block; }
  .spark2 { animation: twinkle 3.1s ease-in-out infinite; animation-delay: 0.6s; opacity: 0.7; display: inline-block; }
  .rocket-float { animation: floaty 3.2s ease-in-out infinite; display: inline-block; }
  .chip-pop { animation: chip-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
  .org-badge-pulse { animation: badge-pulse 2.4s ease-out infinite; }
  .cta-btn { animation: cta-glow 2.6s ease-in-out infinite; }
  .cta-btn:hover { box-shadow: 0 0 40px ${rgbaOf(brand, 0.8)} !important; }
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid { width: 100% !important; max-width: 100% !important; }
    .stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
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
  ${isExisting ? `You've been added to ${orgName} on LaunchSession.` : `Welcome to LaunchSession — set your password to get started.`} &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-body" style="background-color:#070B16;">
<tr><td align="center" style="padding: 32px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container fluid" style="width:600px; max-width:600px;">

    <tr><td align="center" class="px-mobile" style="padding: 8px 24px 20px;">
      ${logoMark('lg')}
    </td></tr>

    <tr><td class="px-mobile" style="padding: 0 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${brand}"
        style="background-color:${brand}; background-image: linear-gradient(150deg, #0B0F1F 0%, ${brandDeep} 38%, ${brand} 74%, ${brandLight} 100%); border-radius: 24px; overflow: hidden;">
        <tr><td align="center" style="padding: 40px 32px 36px;">
          ${orgIdentityBlock}
          <h1 class="h1-mobile force-white" style="margin:0 0 10px; font-family: ${FONT}; font-size: 28px; line-height: 36px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
            <span class="spark">✦</span> ${heroHeadline} <span class="rocket-float">🚀</span>
          </h1>
          <p style="margin: 0 auto; max-width: 440px; font-family: ${FONT}; font-size: 15px; line-height: 24px; color: rgba(255,255,255,0.8);">${heroSub}</p>
          <div style="margin-top: 26px;">${featureChips}</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td class="px-mobile" style="padding: 28px 12px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px;">
        <tr><td style="padding: 28px 28px;">
          <p style="margin:0 0 10px; font-family: ${FONT}; font-size: 18px; font-weight: 700; color: #ffffff;">${welcomeCardTitle}</p>
          <p style="margin:0; font-family: ${FONT}; font-size: 14px; line-height: 23px; color: rgba(255,255,255,0.62);">${welcomeCardBody}</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td class="px-mobile" style="padding: 16px 12px 0;">${accountDetailsBlock}</td></tr>

    <tr><td align="center" class="px-mobile" style="padding: 32px 24px 8px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${actionUrl}" style="height:54px;v-text-anchor:middle;width:280px;" arcsize="26%" strokecolor="${brand}" fillcolor="${brand}">
      <w:anchorlock/>
      <center style="color:${brandCtaText};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${ctaLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${actionUrl}" class="cta-btn" target="_blank"
        style="background: ${brand}; background-image: linear-gradient(135deg, ${brand}, ${brandLight}); border-radius: 14px; color: ${brandCtaText}; display: inline-block; font-family: ${FONT}; font-size: 16px; font-weight: 700; line-height: 54px; text-align: center; text-decoration: none; width: 280px; -webkit-text-size-adjust: none; box-shadow: 0 0 20px ${rgbaOf(brand, 0.35)};">
        ${ctaLabel}
      </a>
      <!--<![endif]-->
      ${isExisting ? '' : `<p style="margin: 14px 0 0; font-family: ${FONT}; font-size: 12px; color: rgba(255,255,255,0.4);">This secure link expires in 24 hours.</p>`}
    </td></tr>

    <tr><td class="px-mobile" style="padding: 36px 12px 0;">${whatYouCanDoBlock}</td></tr>

    ${isExisting ? '' : `<tr><td class="px-mobile" style="padding: 36px 12px 0;">${quickStartBlock}</td></tr>`}

    <tr><td class="px-mobile" style="padding: 36px 12px 0;">${testimonialBlock}</td></tr>

    <tr><td class="px-mobile" style="padding: 20px 12px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${rgbaOf(brand, 0.08)}; border: 1px solid ${rgbaOf(brand, 0.28)}; border-radius: 20px;">
        <tr><td align="center" style="padding: 26px 24px;">
          <p style="margin:0 0 6px; font-family: ${FONT}; font-size: 15px; font-weight: 700; color: #ffffff;"><span class="spark2">✦</span> Need help?</p>
          <p style="margin:0 0 16px; font-family: ${FONT}; font-size: 13px; line-height: 20px; color: rgba(255,255,255,0.55);">Our support team is here whenever you need us.</p>
          <p style="margin:0 0 16px; font-family: ${FONT}; font-size: 13px;">
            <a href="mailto:support@launchsession.co.uk" style="color: ${brandLight}; text-decoration: none; font-weight: 600;">support@launchsession.co.uk</a>
          </p>
          <a href="https://www.launchsession.co.uk/help" target="_blank"
            style="display: inline-block; padding: 10px 22px; border: 1px solid rgba(255,255,255,0.22); border-radius: 10px; font-family: ${FONT}; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none;">
            Knowledge base
          </a>
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
      <p style="margin: 10px 0 0; font-family: ${FONT}; font-size: 11px; color: rgba(255,255,255,0.25);">If you did not request this, please ignore this email.</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`

    const text = `Hi ${full_name?.split(' ')[0] || full_name || 'there'},\n\n${isExisting
      ? `${orgNameRaw} has added you to their team on LaunchSession. Your existing login still works.`
      : isVolunteer
        ? `${orgNameRaw} has invited you to join their volunteer team on LaunchSession.`
        : `Welcome to ${orgNameRaw} on LaunchSession! Your account is ready.`
    }\n\n${ctaLabel}\n${actionUrl}\n\n---\nLaunchSession · Organisation OS for charities\nIf you did not request this, please ignore this email.`

    const res = await fetch('https://api.resend.com/emails', {
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
