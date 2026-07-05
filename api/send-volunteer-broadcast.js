import { createClient } from '@supabase/supabase-js'

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

    const { org_id, channel, subject, body_html, audience, audience_label } = req.body || {}
    if (!org_id || !body_html) return res.status(400).json({ error: 'Missing org_id or message body' })
    if (channel && !['email', 'portal', 'notes'].includes(channel)) {
      return res.status(400).json({ error: `Unsupported channel: ${channel}` })
    }

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    const { data: profile, error: profileErr } = await adminClient
      .from('user_profiles').select('org_id, role, full_name').eq('id', user.id).single()
    if (profileErr || !profile) return res.status(403).json({ error: 'No profile found for this user' })
    if (profile.org_id !== org_id) return res.status(403).json({ error: 'You do not have access to this organisation' })
    if (!['admin', 'staff'].includes(profile.role)) return res.status(403).json({ error: 'Only staff or admins can send broadcasts' })

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
