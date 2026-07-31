import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Server-generated notification copy — the frontend only ever sends an
// event_type + minimal targeting info, never raw title/body text. This is
// what keeps a compromised/buggy client from dictating arbitrary push
// content to arbitrary users. Deep links are relative; the SW/client resolve
// them against the app origin so org context (already in the session) holds.
const EVENT_TEMPLATES = {
  TEST_NOTIFICATION:            { title: 'LaunchSession notifications are working 🚀', body: "You're all set to receive important updates.", category: 'security', priority: 'low', url: '/?tab=settings' },
  SAFEGUARDING_ACTION_REQUIRED: { title: 'Action required', body: 'A safeguarding item requires your attention in LaunchSession.', category: 'safeguarding', priority: 'critical', url: '/?tab=safeguarding' },
  NEW_MESSAGE:                  { title: 'New message', body: 'You have a new message in LaunchSession.', category: 'messaging', priority: 'normal', url: '/?tab=messaging' },
  SESSION_STARTING_SOON:        { title: 'Session starting soon', body: "A session you're assigned to starts in 30 minutes.", category: 'sessions', priority: 'high', url: '/?tab=registers' },
  SESSION_CANCELLED:            { title: 'Session cancelled', body: 'A session you were assigned to has been cancelled.', category: 'sessions', priority: 'high', url: '/?tab=sessions' },
  REGISTER_INCOMPLETE:          { title: 'Register needs attention', body: 'A session has ended with attendance still unresolved.', category: 'registers', priority: 'high', url: '/?tab=registers' },
  VOLUNTEER_COVER_REQUIRED:     { title: 'Volunteer cover needed', body: 'A session needs more volunteer cover.', category: 'volunteers', priority: 'normal', url: '/?tab=volunteers' },
  FORM_SUBMISSION_RECEIVED:     { title: 'New form submission', body: 'A new form response has come in.', category: 'forms', priority: 'normal', url: '/?tab=forms' },
  CONSENT_EXPIRING:             { title: 'Consent expiring', body: 'A consent record is expiring soon.', category: 'consents', priority: 'normal', url: '/?tab=children' },
  MEDICAL_INFO_UPDATED:         { title: 'Medical information updated', body: "A young person's medical information has been updated.", category: 'medical', priority: 'normal', url: '/?tab=children' },
  RISK_ASSESSMENT_DUE:          { title: 'Risk assessment due', body: 'A risk assessment needs review.', category: 'resources', priority: 'normal', url: '/?tab=risk_assessments' },
  RESOURCE_BOOKING_UPDATE:      { title: 'Resource booking update', body: 'A resource booking has been approved or changed.', category: 'resources', priority: 'low', url: '/?tab=resources' },
  REFLECTION_DUE:                { title: 'Reflection due', body: 'A session is ready for its reflection to be written up.', category: 'reflections', priority: 'low', url: '/?tab=registers' },
  INVITATION_ACCEPTED:          { title: 'Invitation accepted', body: 'Someone has accepted your invitation.', category: 'volunteers', priority: 'low', url: '/?tab=volunteers' },
  STAFF_ADDED_TO_SESSION:       { title: 'Added to a session', body: "You've been added to a session.", category: 'sessions', priority: 'normal', url: '/?tab=sessions' },
  SECURITY_ALERT:                { title: 'Security alert', body: 'A security-related event needs your attention.', category: 'security', priority: 'critical', url: '/?tab=settings' },
}

// Which event types are actually wired up to resolve real recipients today.
// Anything else is documented (has copy above) but intentionally rejected
// rather than silently resolving to nobody or the wrong audience.
const IMPLEMENTED_EVENTS = new Set(['TEST_NOTIFICATION', 'SAFEGUARDING_ACTION_REQUIRED', 'NEW_MESSAGE'])

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

    const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
    if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_ANON_KEY || !REACT_APP_SUPABASE_SERVICE_KEY) {
      console.error('send-form-email: missing required env vars')
      return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' })
    }

    // Verify the calling user is authenticated
    const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)
    const { data: profile, error: profileErr } = await adminClient.from('user_profiles').select('org_id, full_name').eq('id', user.id).maybeSingle()
    if (profileErr || !profile?.org_id) return res.status(403).json({ error: 'No organisation found for this account' })

    // ── Push notifications (shares this function to stay within the Hobby
    // plan's 12-serverless-functions-per-deployment limit) ──
    if (req.body?.type === 'push') {
      const { event_type, target_user_ids, thread_id } = req.body || {}
      if (!event_type || !EVENT_TEMPLATES[event_type]) return res.status(400).json({ error: 'Unknown or missing event_type' })
      if (!IMPLEMENTED_EVENTS.has(event_type)) return res.status(400).json({ error: 'This event type is not yet wired to a recipient list' })

      const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('send-form-email(push): missing VAPID keys')
        return res.status(500).json({ error: 'Push notifications are not configured on the server yet' })
      }
      webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@launchsession.co.uk', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

      const template = EVENT_TEMPLATES[event_type]

      // ── Resolve recipients — always scoped to the caller's own org, never
      // trusting client-supplied user ids without re-filtering by org_id. ──
      let recipientIds = []
      let notifBody = template.body
      let notifUrl = template.url

      if (event_type === 'TEST_NOTIFICATION') {
        recipientIds = [user.id]
      } else if (event_type === 'SAFEGUARDING_ACTION_REQUIRED') {
        const { data: admins } = await adminClient.from('user_profiles').select('id').eq('org_id', profile.org_id).in('role', ['admin', 'owner'])
        recipientIds = (admins || []).map(a => a.id)
      } else if (event_type === 'NEW_MESSAGE') {
        const requested = Array.isArray(target_user_ids) ? target_user_ids.slice(0, 200) : []
        if (requested.length === 0) return res.status(400).json({ error: 'Missing target_user_ids' })
        const { data: members } = await adminClient.from('user_profiles').select('id').eq('org_id', profile.org_id).in('id', requested)
        recipientIds = (members || []).map(m => m.id).filter(id => id !== user.id)
        if (thread_id) notifUrl = `/?tab=messaging&thread=${thread_id}`
      }

      recipientIds = [...new Set(recipientIds)].slice(0, 500) // hard cap — basic abuse guard
      if (recipientIds.length === 0) return res.status(200).json({ success: true, sent: 0, recipients: 0 })

      // Respect each recipient's own preferences (default to enabled if they
      // haven't set any yet, matching the table's own column defaults).
      const { data: prefsRows } = await adminClient.from('notification_preferences').select('*').in('user_id', recipientIds)
      const prefsByUser = {}
      ;(prefsRows || []).forEach(p => { prefsByUser[p.user_id] = p })

      const eligibleIds = recipientIds.filter(id => {
        const p = prefsByUser[id]
        if (!p) return true // no row yet = defaults = enabled
        if (p.push_enabled === false) return false
        if (template.category && p[template.category] === false) return false
        return true
      })

      // Always write the in-app notification record, even for users with
      // push disabled — they should still see it when they next open the app.
      const notifRows = recipientIds.map(id => ({
        org_id: profile.org_id, user_id: id, category: template.category, event_type,
        title: template.title, body: notifBody, target_url: notifUrl, priority: template.priority,
      }))
      await adminClient.from('notifications').insert(notifRows)

      if (eligibleIds.length === 0) return res.status(200).json({ success: true, sent: 0, recipients: recipientIds.length })

      const { data: subs } = await adminClient.from('push_subscriptions').select('*').in('user_id', eligibleIds).eq('is_active', true)
      const payload = JSON.stringify({ title: template.title, body: notifBody, url: notifUrl, event_type, category: template.category, priority: template.priority, tag: event_type })

      let sent = 0
      const logRows = []
      await Promise.allSettled((subs || []).map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          sent += 1
          logRows.push({ org_id: profile.org_id, user_id: sub.user_id, subscription_id: sub.id, event_type, status: 'sent' })
          await adminClient.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
        } catch (err) {
          const code = err?.statusCode
          logRows.push({ org_id: profile.org_id, user_id: sub.user_id, subscription_id: sub.id, event_type, status: 'failed', error_code: code ? String(code) : 'unknown' })
          // 404/410 mean the endpoint is gone for good — deactivate so we stop retrying it.
          if (code === 404 || code === 410) {
            await adminClient.from('push_subscriptions').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', sub.id)
          }
        }
      }))
      if (logRows.length) await adminClient.from('push_delivery_logs').insert(logRows)

      return res.status(200).json({ success: true, sent, recipients: recipientIds.length, subscriptions: (subs || []).length })
    }

    // ── Child registration invite (shares this function to stay within the
    // Hobby plan's 12-serverless-functions-per-deployment limit) ──
    if (req.body?.type === 'registration') {
      const { emails, parent_name } = req.body || {}
      if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'Missing emails' })

      const cleanEmails = [...new Set(emails.map(e => String(e).trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]
      if (cleanEmails.length === 0) return res.status(400).json({ error: 'No valid email addresses provided' })
      if (cleanEmails.length > 50) return res.status(400).json({ error: 'Too many recipients — please send in smaller batches' })

      const { data: org, error: orgErr } = await adminClient.from('organisations')
        .select('name, slug, primary_color, secondary_color, logo_url, email_logo_url, email_footer_text, email_sender_name, contact_email')
        .eq('id', profile.org_id).maybeSingle()
      if (orgErr || !org?.slug) return res.status(404).json({ error: 'Organisation not found' })

      const registrationUrl = `https://app.launchsession.co.uk/register-child/${org.slug}`

      const results = await Promise.allSettled(cleanEmails.map(email =>
        adminClient.functions.invoke('send-registration-invite', {
          body: {
            email,
            org_name: org.name,
            org_color: org.primary_color,
            org_color2: org.secondary_color,
            org_logo: org.email_logo_url || org.logo_url,
            org_sender_name: org.email_sender_name,
            org_footer_text: org.email_footer_text,
            org_reply_to: org.contact_email,
            registration_url: registrationUrl,
            sender_name: profile.full_name,
            parent_name: parent_name || null,
          },
        })
      ))

      const failed = []
      results.forEach((r, i) => { if (r.status === 'rejected' || r.value?.error) failed.push(cleanEmails[i]) })
      return res.status(200).json({ success: true, sent: cleanEmails.length - failed.length, failed })
    }

    // ── Existing form-email flow ──
    const { form_id, emails } = req.body || {}
    if (!form_id || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Missing form_id or emails' })
    }

    const cleanEmails = [...new Set(emails.map(e => String(e).trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]
    if (cleanEmails.length === 0) return res.status(400).json({ error: 'No valid email addresses provided' })
    if (cleanEmails.length > 100) return res.status(400).json({ error: 'Too many recipients — please send in smaller batches' })

    // Confirm the form belongs to the caller's org — this is what prevents
    // one org from emailing out another org's form.
    const { data: form, error: formErr } = await adminClient.from('org_forms').select('id, name, description, org_id').eq('id', form_id).eq('org_id', profile.org_id).maybeSingle()
    if (formErr || !form) return res.status(404).json({ error: 'Form not found for your organisation' })

    const { data: org, error: orgErr } = await adminClient.from('organisations').select('name, slug, primary_color, secondary_color, logo_url, email_logo_url, email_footer_text, email_sender_name, contact_email').eq('id', profile.org_id).maybeSingle()
    if (orgErr || !org?.slug) return res.status(404).json({ error: 'Organisation not found' })

    const formUrl = `https://app.launchsession.co.uk/forms/${org.slug}/${form.id}`

    const results = await Promise.allSettled(cleanEmails.map(email =>
      adminClient.functions.invoke('send-form-email', {
        body: {
          email,
          org_name: org.name,
          org_color: org.primary_color,
          org_color2: org.secondary_color,
          org_logo: org.email_logo_url || org.logo_url,
          org_sender_name: org.email_sender_name,
          org_footer_text: org.email_footer_text,
          org_reply_to: org.contact_email,
          form_name: form.name,
          form_description: form.description,
          form_url: formUrl,
          sender_name: profile.full_name,
        },
      })
    ))

    const failed = []
    results.forEach((r, i) => {
      if (r.status === 'rejected' || r.value?.error) failed.push(cleanEmails[i])
    })

    return res.status(200).json({ success: true, sent: cleanEmails.length - failed.length, failed })
  } catch (err) {
    console.error('send-form-email: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
