import { createClient } from '@supabase/supabase-js'

// This route serves two senders, not one.
//
// Vercel Hobby caps the project at 12 serverless functions and we are exactly
// at 12, so the Newsletter Studio branches in here rather than adding a
// thirteenth file and breaking the deploy. POST { newsletterId } for a
// newsletter; everything else is the original volunteer broadcast.

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Only allow http(s) in a block's link, so a stored javascript: or data: URL
// cannot become a live link in somebody's inbox.
const safeUrl = (v) => (/^https?:\/\//i.test(String(v || '')) ? esc(v) : '')

// Blocks -> email HTML. Tables and inline styles throughout, because Outlook
// renders neither flexbox nor a <style> block reliably.
function renderBlocks(blocks, primary) {
  return (Array.isArray(blocks) ? blocks : []).map(b => {
    if (b.type === 'heading' && b.text) {
      return `<h2 style="margin:0 0 12px;font-size:19px;font-weight:800;color:#0F172A;">${esc(b.text)}</h2>`
    }
    if (b.type === 'text' && b.text) {
      const paras = String(b.text).split(/\n{2,}/).map(t =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">${esc(t).replace(/\n/g, '<br />')}</p>`)
      return paras.join('')
    }
    if (b.type === 'image' && safeUrl(b.url)) {
      // Mirrors IMAGE_SIZES in NewsletterStudio.jsx. A portrait phone photo at
      // the full 496px column is around 880px tall, which is a screenful of
      // one picture, so the block carries its own width.
      const px = { small: 240, medium: 360, full: 496 }[b.size] || 496
      const cap = b.caption ? `<div style="font-size:12px;color:#94A3B8;margin-top:6px;">${esc(b.caption)}</div>` : ''
      // width attribute as well as the style: Outlook ignores CSS width on
      // images often enough that leaving it off means a full-bleed original.
      return `<div style="margin:0 0 18px;text-align:center;"><img src="${safeUrl(b.url)}" alt="${esc(b.alt || '')}" width="${px}" style="width:${px}px;max-width:100%;height:auto;border-radius:8px;display:inline-block;" />${cap}</div>`
    }
    if (b.type === 'callout' && (b.title || b.text)) {
      const t = b.title ? `<div style="font-size:14px;font-weight:800;color:#0F172A;margin-bottom:4px;">${esc(b.title)}</div>` : ''
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:${primary}12;border-left:4px solid ${primary};padding:14px 16px;">${t}<div style="font-size:14.5px;color:#334155;line-height:1.6;">${esc(b.text || '')}</div></td></tr></table>`
    }
    if (b.type === 'button' && b.label && safeUrl(b.url)) {
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:${primary};border-radius:8px;"><a href="${safeUrl(b.url)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(b.label)}</a></td></tr></table>`
    }
    if (b.type === 'divider') {
      return '<div style="border-top:1px solid #E2E8F0;margin:0 0 20px;"></div>'
    }
    return ''
  }).join('')
}

async function handleNewsletter(req, res, { adminClient, user, profile }) {
  const { newsletterId } = req.body || {}

  const { data: nl, error: nlErr } = await adminClient
    .from('newsletters').select('*').eq('id', newsletterId).single()
  if (nlErr || !nl) return res.status(404).json({ error: 'Newsletter not found' })
  if (nl.org_id !== profile.org_id) return res.status(403).json({ error: 'You do not have access to this newsletter' })
  if (nl.status === 'sent') return res.status(400).json({ error: 'This newsletter has already been sent' })

  const roles = nl.audience_roles || []
  const { data: org } = await adminClient
    .from('organisations').select('name, primary_color, logo_url').eq('id', nl.org_id).single()

  // One resolver, shared with the composer. Assembling the audience here by
  // hand is what previously let the confirmation dialog promise one number
  // while a different set of people got the email.
  const aud = nl.audience || {}
  const { data: resolved, error: resolveErr } = await adminClient
    .rpc('resolve_newsletter_audience', {
      p_org_id: nl.org_id,
      p_roles: roles,
      p_group_names: aud.group_names || [],
      p_project_ids: aud.project_ids || [],
      p_manual_emails: nl.manual_emails || [],
      p_excluded_emails: nl.excluded_emails || [],
    })
  if (resolveErr) return res.status(500).json({ error: 'Could not work out the audience: ' + resolveErr.message })

  // Suppressed addresses are resolved and then dropped here rather than being
  // filtered out in SQL, so the composer can show "3 people have unsubscribed"
  // instead of silently returning a smaller number.
  const audience = (resolved || []).filter(r => !r.suppressed)
  const suppressed = (resolved || []).length - audience.length

  if (audience.length === 0) {
    return res.status(400).json({
      error: suppressed
        ? 'Everyone matching that audience has unsubscribed.'
        : 'Nobody in this organisation matches that audience',
    })
  }

  // Recipient rows first, then claim. The unique (newsletter_id, email) means
  // a retry re-inserts nothing and re-claims nothing already sent, so a
  // double-click or a timeout retry cannot mail anyone twice.
  const { error: seedErr } = await adminClient.from('newsletter_recipients')
    .upsert(audience.map(a => ({
      newsletter_id: nl.id, org_id: nl.org_id, email: a.email, first_name: a.first_name,
    })), { onConflict: 'newsletter_id,email', ignoreDuplicates: true })
  if (seedErr) return res.status(500).json({ error: 'Could not prepare recipients: ' + seedErr.message })

  await adminClient.from('newsletters')
    .update({ status: 'sending', recipient_count: audience.length }).eq('id', nl.id)

  const { data: claimed, error: claimErr } = await adminClient
    .rpc('claim_newsletter_recipients', { p_newsletter_id: nl.id, p_limit: 500 })
  if (claimErr) return res.status(500).json({ error: 'Could not claim recipients: ' + claimErr.message })

  if (!claimed || claimed.length === 0) {
    return res.status(200).json({ success: true, sent: 0, failed: 0, already: true })
  }

  const primary = org?.primary_color || '#3B82F6'
  const body_html = renderBlocks(nl.blocks, primary)

  let results = []
  try {
    const { data: fnResult, error: fnError } = await adminClient.functions.invoke('send-volunteer-broadcast', {
      body: {
        // id travels through so the edge function can build a per-person
        // unsubscribe link rather than a shared mailto nobody reads.
        recipients: claimed.map(c => ({ id: c.id, email: c.email, first_name: c.first_name })),
        app_url: process.env.PUBLIC_APP_URL || 'https://app.launchsession.co.uk',
        subject: nl.subject,
        preheader: nl.preheader || '',
        body_html,
        prerendered: true,
        org_name: org?.name || 'Your organisation',
        org_color: primary,
        org_logo: org?.logo_url,
        sender_name: profile.full_name,
      },
    })
    if (fnError) throw fnError
    results = fnResult?.results || []
  } catch (sendErr) {
    console.error('newsletter: edge function invoke failed', sendErr)
    // The whole batch failed to dispatch. Release the claim so a retry can
    // pick these up again rather than stranding them as permanently claimed.
    await adminClient.from('newsletter_recipients')
      .update({ claimed_at: null, status: 'pending' })
      .in('id', claimed.map(c => c.id))
    await adminClient.from('newsletters').update({ status: 'draft' }).eq('id', nl.id)
    return res.status(502).json({ error: 'Could not reach the mail service. Nothing was sent — try again.' })
  }

  const byEmail = new Map(results.map(r => [String(r.email).toLowerCase(), r]))
  let sent = 0, failed = 0
  await Promise.all(claimed.map(async (c) => {
    const r = byEmail.get(String(c.email).toLowerCase())
    const ok = !!r?.ok
    if (ok) sent++; else failed++
    await adminClient.from('newsletter_recipients').update({
      status: ok ? 'sent' : 'failed',
      error: ok ? null : (r?.error || 'No result returned'),
      sent_at: ok ? new Date().toISOString() : null,
      // A failure releases its claim so it can be retried.
      claimed_at: ok ? new Date().toISOString() : null,
    }).eq('id', c.id)
  }))

  const { count: pending } = await adminClient.from('newsletter_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', nl.id).eq('status', 'pending')

  await adminClient.from('newsletters').update({
    status: pending ? 'sending' : 'sent',
    sent_count: sent,
    failed_count: failed,
    sent_at: new Date().toISOString(),
  }).eq('id', nl.id)

  return res.status(200).json({ success: true, sent, failed, suppressed, remaining: pending || 0 })
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
    if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_ANON_KEY || !REACT_APP_SUPABASE_SERVICE_KEY) {
      console.error('send-volunteer-broadcast: missing required env vars')
      return res.status(500).json({ error: 'Server misconfiguration' })
    }

    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

    const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

    // Newsletter branch. Auth is resolved below in exactly the same way, so
    // this is dispatched after the profile lookup rather than here.
    const isNewsletter = !!(req.body || {}).newsletterId

    const { org_id, channel, subject, body_html, audience, audience_label } = req.body || {}
    if (!isNewsletter) {
      if (!org_id || !body_html) return res.status(400).json({ error: 'Missing org_id or message body' })
      if (channel && !['email', 'portal', 'notes'].includes(channel)) {
        return res.status(400).json({ error: `Unsupported channel: ${channel}` })
      }
    }

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    const { data: profile, error: profileErr } = await adminClient
      .from('user_profiles').select('org_id, role, full_name').eq('id', user.id).single()
    if (profileErr || !profile) return res.status(403).json({ error: 'No profile found for this user' })
    if (!['admin', 'staff'].includes(profile.role)) return res.status(403).json({ error: 'Only staff or admins can send broadcasts' })

    if (isNewsletter) return await handleNewsletter(req, res, { adminClient, user, profile })

    if (profile.org_id !== org_id) return res.status(403).json({ error: 'You do not have access to this organisation' })

    // Resolve audience — a filter object built by the client (status/tags/group/session)
    let query = adminClient.from('user_profiles').select('id, email, first_name, full_name').eq('org_id', org_id).eq('role', 'volunteer')
    const filter = audience || {}
    if (filter.status === 'active') query = query.eq('status', 'active')
    if (filter.status === 'pending') query = query.eq('status', 'pending')
    if (filter.tag) query = query.contains('tags', [filter.tag])
    if (Array.isArray(filter.volunteer_ids) && filter.volunteer_ids.length) query = query.in('id', filter.volunteer_ids)

    const { data: recipients, error: recErr } = await query
    if (recErr) return res.status(500).json({ error: 'Failed to resolve audience: ' + recErr.message })
    if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'No volunteers match this audience' })

    // Log the broadcast up front (portal/notes channels don't need external delivery)
    const { data: broadcastRow, error: insertErr } = await adminClient.from('volunteer_broadcasts').insert({
      org_id,
      sender_id: user.id,
      channel: channel || 'email',
      subject: subject || null,
      body: body_html,
      audience_label: audience_label || 'All Volunteers',
      recipient_count: recipients.length,
      sent_count: 0,
      failed_count: 0,
    }).select().single()
    if (insertErr) return res.status(500).json({ error: 'Failed to log broadcast: ' + insertErr.message })

    if (channel === 'portal' || channel === 'notes') {
      // No external delivery — the row itself is the record volunteers/staff will see
      await adminClient.from('volunteer_broadcasts').update({ sent_count: recipients.length }).eq('id', broadcastRow.id)
      return res.status(200).json({ success: true, recipient_count: recipients.length, sent: recipients.length, failed: 0 })
    }

    const { data: org } = await adminClient.from('organisations').select('name, primary_color, logo_url').eq('id', org_id).single()

    let sent = 0, failed = 0
    try {
      const { data: fnResult, error: fnError } = await adminClient.functions.invoke('send-volunteer-broadcast', {
        body: {
          recipients: recipients.map(r => ({ email: r.email, first_name: r.first_name || r.full_name?.split(' ')[0] })),
          subject: subject || 'Update from ' + (org?.name || 'your organisation'),
          body_html,
          org_name: org?.name || 'Your organisation',
          org_color: org?.primary_color,
          org_logo: org?.logo_url,
          sender_name: profile.full_name,
        }
      })
      if (fnError) throw fnError
      sent = fnResult?.sent || 0
      failed = fnResult?.failed || 0
    } catch (sendErr) {
      console.error('send-volunteer-broadcast: edge function invoke failed', sendErr)
      failed = recipients.length
    }

    await adminClient.from('volunteer_broadcasts').update({ sent_count: sent, failed_count: failed }).eq('id', broadcastRow.id)

    return res.status(200).json({ success: true, recipient_count: recipients.length, sent, failed })
  } catch (err) {
    console.error('send-volunteer-broadcast: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
