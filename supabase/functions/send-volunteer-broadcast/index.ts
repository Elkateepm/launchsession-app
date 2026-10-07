import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// Newsletters and volunteer broadcasts, sent on an organisation's behalf.
//
// An organisation whose plan includes branding (organisations.branding_enabled,
// decided by the caller from the organisation row) sends under its own name,
// colour, footer and reply-to, with no LaunchSession marks. The rest send as
// "<Org> via LaunchSession" with the LaunchSession header line and footer.
// Either way the address is hello@launchsession.co.uk: Resend only sends from
// a verified domain.

function esc(str: unknown) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)

function isLight(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170
}

function fromHeader(displayName: unknown, branded: boolean) {
  const safeName = String(displayName ?? '').replace(/["\r\n<>]/g, '').trim() || 'LaunchSession'
  return branded
    ? `${safeName} <hello@launchsession.co.uk>`
    : `${safeName} via LaunchSession <hello@launchsession.co.uk>`
}

// Only LaunchSession's own server may send through this function. Its API
// routes call with the service role key; the gateway (verify_jwt) has already
// checked the token's signature, so its role claim can be trusted. Without
// this, the public anon key -- shipped in every browser -- could send any
// email, to anyone, from hello@launchsession.co.uk under any display name.
function calledByServer(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const part = token.split('.')[1]
  if (!part) return false
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))).role === 'service_role'
  } catch {
    return false
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!calledByServer(req)) {
    return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const {
      recipients,
      subject,
      body_html,
      org_name,
      org_color,
      org_logo,
      sender_name,
      preheader,
      reply_to,
      prerendered,
      app_url,
      branded,
      org_sender_name,
      org_footer_text,
    } = await req.json()

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const isBranded = branded === true
    const primary = isHex(org_color) ? org_color : '#1B9AAA'
    const base = (app_url || 'https://app.launchsession.co.uk').replace(/\/$/, '')
    const orgName = org_name || 'Your organisation'

    // Branded: the organisation's own colour across the top. Otherwise the
    // LaunchSession navy, with the organisation's colour as a rule beneath.
    const headerBg = isBranded ? primary : '#0F172A'
    const headerText = isBranded && isLight(primary) ? '#0F172A' : '#ffffff'

    // Logos are drawn for white backgrounds, so on the organisation's own
    // colour the logo sits on a white plate, as it does in the app.
    const logoBlock = org_logo && isBranded
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="background:#ffffff;border-radius:14px;padding:10px 16px;box-shadow:0 6px 18px rgba(0,0,0,0.18);"><img src="${esc(org_logo)}" alt="${esc(orgName)}" style="display:block;max-height:44px;max-width:180px;object-fit:contain;" /></td></tr></table>`
      : org_logo
      ? `<img src="${esc(org_logo)}" alt="${esc(orgName)}" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" />`
      : `<div style="font-size:22px;font-weight:900;color:${headerText};letter-spacing:-0.5px;">${esc(orgName)}</div>`

    const poweredBy = isBranded
      ? ''
      : `<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Powered by LaunchSession</div>`

    const footerIdentity = isBranded
      ? `<p style="margin:0;font-size:13px;font-weight:700;color:#0F172A;line-height:1.6;">${esc(org_footer_text || orgName)}</p>`
      : `${org_footer_text ? `<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#475569;">${esc(org_footer_text)}</p>` : ''}
<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0F172A;">Launch<span style="color:${primary};">Session</span></p>
<p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">Organisation OS for charities &amp; youth organisations</p>`

    const preheaderBlock = preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${esc(preheader)}</div>`
      : ''

    function renderHtml(firstName: string, unsubUrl: string) {
      const name = firstName || 'there'
      const personalised = (body_html || '')
        .replaceAll('{{FirstName}}', esc(name))
        .replaceAll('{{first_name}}', esc(name))
      const heading = prerendered
        ? ''
        : `<p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.6px;">${sender_name ? `From ${esc(sender_name)} at ` : ''}${esc(orgName)}</p>\n<h1 style="margin:0 0 18px;font-size:21px;font-weight:900;color:#0F172A;">${esc(subject || '')}</h1>`

      // A visible unsubscribe line, not just a header. Mail clients only
      // surface List-Unsubscribe some of the time, and a recipient who cannot
      // find a way out marks the message as spam instead -- which costs the
      // sending domain far more than the unsubscribe would have.
      const unsubBlock = unsubUrl
        ? `<p style="margin:8px 0 0;font-size:11px;color:#94A3B8;">Don't want these? <a href="${unsubUrl}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe</a>.</p>`
        : ''

      return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(subject)}</title></head>\n<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">\n${preheaderBlock}\n<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">\n<tr><td align="center">\n<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">\n<tr><td style="background:${headerBg};padding:28px 32px;text-align:center;border-top:4px solid ${primary};">${logoBlock}${poweredBy}</td></tr>\n<tr><td style="height:4px;background:linear-gradient(90deg,${primary},${primary}88);"></td></tr>\n<tr><td style="padding:36px 32px;">\n${heading}\n<div style="font-size:15px;color:#334155;line-height:1.7;">${personalised}</div>\n</td></tr>\n<tr><td style="padding:0 32px;"><div style="border-top:1px solid #E2E8F0;"></div></td></tr>\n<tr><td style="padding:20px 32px 32px;text-align:center;">\n${footerIdentity}\n${unsubBlock}\n</td></tr>\n</table>\n</td></tr>\n</table>\n</body></html>`
    }

    const results = await Promise.all(recipients.map(async (r: { id?: string, email: string, first_name?: string }) => {
      // Only newsletters carry a recipient id, so only they get an unsubscribe
      // link. Transactional mail (invites, password resets) must not have one:
      // you cannot opt out of the email that lets you reset your password.
      const unsubUrl = r.id ? `${base}/unsubscribe/${r.id}` : ''
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromHeader(isBranded ? (org_sender_name || orgName) : orgName, isBranded),
            to: [r.email],
            subject,
            ...(reply_to ? { reply_to } : {}),
            headers: {
              // Only advertised when there is a real endpoint behind it. The
              // previous mailto pointed at an unmonitored shared inbox, which
              // is worse than advertising nothing.
              ...(unsubUrl ? { 'List-Unsubscribe': `<${unsubUrl}>` } : {}),
              'X-Entity-Ref-ID': crypto.randomUUID(),
            },
            html: renderHtml(r.first_name || '', unsubUrl),
          }),
        })
        if (!res.ok) {
          const detail = await res.text()
          return { email: r.email, ok: false, error: `${res.status}: ${detail.slice(0, 200)}` }
        }
        return { email: r.email, ok: true }
      } catch (e) {
        return { email: r.email, ok: false, error: String((e as Error)?.message || e) }
      }
    }))

    const sent = results.filter(r => r.ok).length
    const failed = results.length - sent

    return new Response(JSON.stringify({ success: true, sent, failed, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
