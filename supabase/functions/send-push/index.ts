// Web push delivery for LaunchSession. Moved here from api/send-form-email.js
// so push no longer depends on the Vercel deployment (or its function cap).
//
// Three callers, two ways to prove who you are:
//   type 'push'           the app, with the signed-in user's access token.
//                         Recipients are resolved here and re-filtered to the
//                         caller's own organisation; the client never chooses
//                         the wording.
//   type 'db_event_push'  database triggers via pg_net, with the vault's
//                         db_event_secret in x-db-event-secret.
//   type 'deliver'        the reminder sweeps (api/send-form-email.js), with
//                         the same secret and recipients already resolved.
//
// verify_jwt is off because pg_net calls carry no JWT; every request is
// authenticated below instead -- a user token is verified with Supabase Auth,
// and the shared secret is checked against the vault, never decoded locally.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const EVENT_TEMPLATES: Record<string, { title: string; body: string; category: string; priority: string; url: string }> = {
  TEST_NOTIFICATION:            { title: 'LaunchSession notifications are working 🚀', body: "You're all set to receive important updates.", category: 'security', priority: 'low', url: '/?tab=settings' },
  SAFEGUARDING_ACTION_REQUIRED: { title: 'Action required', body: 'A safeguarding item requires your attention in LaunchSession.', category: 'safeguarding', priority: 'critical', url: '/?tab=safeguarding' },
  NEW_MESSAGE:                  { title: 'New message', body: 'You have a new message in LaunchSession.', category: 'messaging', priority: 'normal', url: '/?tab=messaging' },
  SESSION_STARTING_SOON:        { title: 'Session starting soon', body: "A session you're assigned to starts in 30 minutes.", category: 'sessions', priority: 'high', url: '/?tab=registers' },
  SESSION_CANCELLED:            { title: 'Session cancelled', body: 'A session you were assigned to has been cancelled.', category: 'sessions', priority: 'high', url: '/?tab=sessions' },
  REGISTER_INCOMPLETE:          { title: 'Register needs attention', body: 'A session has ended with attendance still unresolved.', category: 'registers', priority: 'high', url: '/?tab=registers' },
  REGISTER_LEFT_OPEN:           { title: 'Register still open', body: "A session ended a while ago but its register hasn't been closed yet.", category: 'registers', priority: 'high', url: '/?tab=registers' },
  VOLUNTEER_COVER_REQUIRED:     { title: 'Volunteer cover needed', body: 'A session needs more volunteer cover.', category: 'volunteers', priority: 'normal', url: '/?tab=volunteers' },
  FORM_SUBMISSION_RECEIVED:     { title: 'New form submission', body: 'A new form response has come in.', category: 'forms', priority: 'normal', url: '/?tab=forms' },
  CONSENT_EXPIRING:             { title: 'Consent expiring', body: 'A consent record is expiring soon.', category: 'consents', priority: 'normal', url: '/?tab=children' },
  MEDICAL_INFO_UPDATED:         { title: 'Medical information updated', body: "A young person's medical information has been updated.", category: 'medical', priority: 'normal', url: '/?tab=children' },
  RISK_ASSESSMENT_DUE:          { title: 'Risk assessment due', body: 'A risk assessment needs review.', category: 'resources', priority: 'normal', url: '/?tab=risk_assessments' },
  RESOURCE_BOOKING_UPDATE:      { title: 'Resource booking update', body: 'A resource booking has been approved or changed.', category: 'resources', priority: 'low', url: '/?tab=resources' },
  REFLECTION_DUE:               { title: 'Reflection due', body: 'A session is ready for its reflection to be written up.', category: 'reflections', priority: 'low', url: '/?tab=registers' },
  INVITATION_ACCEPTED:          { title: 'Invitation accepted', body: 'Someone has accepted your invitation.', category: 'volunteers', priority: 'low', url: '/?tab=volunteers' },
  STAFF_ADDED_TO_SESSION:       { title: 'Added to a session', body: "You've been added to a session.", category: 'sessions', priority: 'normal', url: '/?tab=sessions' },
  SESSION_CREATED:              { title: 'New session created', body: 'A new session has been created.', category: 'sessions', priority: 'normal', url: '/?tab=registers' },
  SESSION_EDITED:               { title: 'Session updated', body: 'A session you’re assigned to has been updated.', category: 'sessions', priority: 'normal', url: '/?tab=registers' },
  SECURITY_ALERT:               { title: 'Security alert', body: 'A security-related event needs your attention.', category: 'security', priority: 'critical', url: '/?tab=settings' },
  CHILD_REGISTRATION_SUBMITTED: { title: 'New registration to authorise', body: 'A parent has submitted a new registration awaiting approval.', category: 'children', priority: 'high', url: '/?tab=children&sub=requests' },
}

// What a signed-in user may trigger. Everything else is raised by the
// database or the sweeps, never on a client's say-so.
const USER_EVENTS = new Set(['TEST_NOTIFICATION', 'SAFEGUARDING_ACTION_REQUIRED', 'NEW_MESSAGE', 'STAFF_ADDED_TO_SESSION'])

// Match the locked groups in Settings > Notifications. Enforced here so that
// editing notification_preferences directly cannot silence them.
const CRITICAL_EVENT_TYPES = new Set(['SAFEGUARDING_ACTION_REQUIRED', 'SECURITY_ALERT'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-db-event-secret',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@launchsession.co.uk'
const pushConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
if (pushConfigured) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)

// deno-lint-ignore no-explicit-any
type Admin = any

// Writes the bell row for everyone, then pushes to those whose preferences
// allow it, logging each attempt and retiring endpoints that are gone.
async function deliver(admin: Admin, opts: {
  org_id: string, event_type: string, category: string, title: string, body: string,
  url: string, priority: string, recipientIds: string[], tag?: string,
}) {
  const ids = [...new Set(opts.recipientIds)].filter(Boolean).slice(0, 500)
  if (ids.length === 0) return { recipients: 0, sent: 0, subscriptions: 0 }

  const { data: prefsRows } = await admin.from('notification_preferences').select('*').in('user_id', ids)
  const prefsByUser: Record<string, Record<string, unknown>> = {}
  ;(prefsRows || []).forEach((p: Record<string, unknown>) => { prefsByUser[p.user_id as string] = p })
  const eligibleIds = ids.filter(id => {
    if (CRITICAL_EVENT_TYPES.has(opts.event_type)) return true
    const p = prefsByUser[id]
    if (!p) return true
    if (p.push_enabled === false) return false
    // A per-type override beats the category toggle in either direction.
    const override = (p.event_overrides as Record<string, boolean> | null)?.[opts.event_type]
    if (override !== undefined) return !!override
    if (opts.category && p[opts.category] === false) return false
    return true
  })

  // Always write the in-app notification, even where push is off.
  await admin.from('notifications').insert(ids.map(id => ({
    org_id: opts.org_id, user_id: id, category: opts.category, event_type: opts.event_type,
    title: opts.title, body: opts.body, target_url: opts.url, priority: opts.priority,
  })))

  if (eligibleIds.length === 0) return { recipients: ids.length, sent: 0, subscriptions: 0 }

  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', eligibleIds).eq('is_active', true)
  const payload = JSON.stringify({
    title: opts.title, body: opts.body, url: opts.url, event_type: opts.event_type,
    category: opts.category, priority: opts.priority, tag: opts.tag || opts.event_type,
  })
  let sent = 0
  const logRows: Record<string, unknown>[] = []
  await Promise.allSettled((subs || []).map(async (sub: Record<string, string>) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      sent += 1
      logRows.push({ org_id: opts.org_id, user_id: sub.user_id, subscription_id: sub.id, event_type: opts.event_type, status: 'sent' })
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode
      logRows.push({ org_id: opts.org_id, user_id: sub.user_id, subscription_id: sub.id, event_type: opts.event_type, status: 'failed', error_code: code ? String(code) : 'unknown' })
      // 404/410: the endpoint is gone for good, so stop retrying it.
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', sub.id)
      }
    }
  }))
  if (logRows.length) await admin.from('push_delivery_logs').insert(logRows)
  return { recipients: ids.length, sent, subscriptions: (subs || []).length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  // Lets the cut-over be checked without sending anything or revealing keys.
  if (req.method === 'GET') return json(200, { configured: pushConfigured })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let body: Record<string, unknown>
  try { body = await req.json() } catch (_e) { return json(400, { error: 'Invalid JSON' }) }

  // ── Trusted callers: database triggers and the reminder sweeps ──
  const secret = req.headers.get('x-db-event-secret')
  if (secret) {
    const { data: ok, error } = await admin.rpc('verify_db_event_secret', { p_secret: secret })
    if (error || ok !== true) return json(401, { error: 'Unauthorized' })
    if (!pushConfigured) return json(500, { error: 'Push notifications are not configured on the server yet' })

    if (body.type === 'deliver') {
      const { org_id, event_type, category, title, body: text, url, priority, recipient_ids, tag } = body as Record<string, never>
      if (!org_id || !event_type || !title || !Array.isArray(recipient_ids)) return json(400, { error: 'Missing org_id, event_type, title or recipient_ids' })
      const result = await deliver(admin, { org_id, event_type, category, title, body: text, url, priority, recipientIds: recipient_ids, tag })
      return json(200, { success: true, ...result })
    }

    if (body.type === 'db_event_push') {
      const { event_type, session_id, actor_user_id, recipient_ids, org_id: bodyOrgId, body_override } = body as Record<string, never>
      const template = EVENT_TEMPLATES[event_type]
      if (!template) return json(400, { error: 'Unknown or missing event_type' })
      let orgId: string, recipientIds: string[]
      let text: string = body_override || template.body
      let url = template.url

      if (session_id) {
        const { data: s, error: sErr } = await admin.from('sessions').select('id, org_id, title, lead_staff_id').eq('id', session_id).maybeSingle()
        if (sErr || !s) return json(404, { error: 'Session not found' })
        orgId = s.org_id
        if (event_type === 'REFLECTION_DUE') {
          // Only the lead writes the reflection.
          recipientIds = [s.lead_staff_id].filter(Boolean)
          text = `The session "${s.title}" is ready for its reflection to be written up.`
        } else {
          const { data: staffRows } = await admin.from('session_staff').select('user_id').eq('session_id', session_id).not('user_id', 'is', null)
          // Never notify whoever made the change about their own action.
          recipientIds = [s.lead_staff_id, ...(staffRows || []).map((r: { user_id: string }) => r.user_id)].filter(id => id && id !== actor_user_id)
          text = `"${s.title}" has been ${event_type === 'SESSION_CREATED' ? 'created' : 'updated'}.`
        }
        url = `/?tab=registers&session=${s.id}`
      } else if (bodyOrgId && Array.isArray(recipient_ids)) {
        // Org-wide events; the trigger already knows who should hear.
        orgId = bodyOrgId
        recipientIds = (recipient_ids as string[]).filter(id => id && id !== actor_user_id)
      } else {
        return json(400, { error: 'Missing session_id or (org_id + recipient_ids)' })
      }

      const result = await deliver(admin, {
        org_id: orgId, event_type, category: template.category, title: template.title,
        body: text, url, priority: template.priority, recipientIds, tag: `${String(event_type).toLowerCase()}-${url}`,
      })
      return json(200, { success: true, recipients: result.recipients, pushes_sent: result.sent })
    }

    return json(400, { error: 'Unknown type' })
  }

  // ── Signed-in users: the app ──
  if (body.type !== 'push') return json(400, { error: 'Unknown type' })
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Unauthorized' })
  const { data: { user }, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !user) return json(401, { error: 'Invalid session' })
  const { data: profile } = await admin.from('user_profiles').select('org_id').eq('id', user.id).maybeSingle()
  if (!profile?.org_id) return json(403, { error: 'No organisation for this account' })

  const { event_type, target_user_ids, thread_id, session_id } = body as Record<string, never>
  const template = EVENT_TEMPLATES[event_type]
  if (!template) return json(400, { error: 'Unknown or missing event_type' })
  if (!USER_EVENTS.has(event_type)) return json(400, { error: 'This event type is not yet wired to a recipient list' })
  if (!pushConfigured) return json(500, { error: 'Push notifications are not configured on the server yet' })

  // Recipients are always re-filtered to the caller's own organisation.
  let recipientIds: string[] = []
  let text = template.body
  let url = template.url
  const requested = Array.isArray(target_user_ids) ? (target_user_ids as string[]).slice(0, 200) : []

  if (event_type === 'TEST_NOTIFICATION') {
    recipientIds = [user.id]
  } else if (event_type === 'SAFEGUARDING_ACTION_REQUIRED') {
    const { data: admins } = await admin.from('user_profiles').select('id').eq('org_id', profile.org_id).in('role', ['admin', 'owner'])
    recipientIds = (admins || []).map((a: { id: string }) => a.id)
  } else if (event_type === 'NEW_MESSAGE' || event_type === 'STAFF_ADDED_TO_SESSION') {
    if (requested.length === 0) return json(400, { error: 'Missing target_user_ids' })
    const { data: members } = await admin.from('user_profiles').select('id').eq('org_id', profile.org_id).in('id', requested)
    recipientIds = (members || []).map((m: { id: string }) => m.id)
    if (event_type === 'NEW_MESSAGE') {
      recipientIds = recipientIds.filter(id => id !== user.id)
      if (thread_id) url = `/?tab=messaging&thread=${thread_id}`
    } else if (session_id) {
      const { data: s } = await admin.from('sessions').select('id, title').eq('id', session_id).eq('org_id', profile.org_id).maybeSingle()
      if (s) { text = `You've been added to "${s.title}".`; url = `/?tab=registers&session=${s.id}` }
    }
  }

  const result = await deliver(admin, {
    org_id: profile.org_id, event_type, category: template.category, title: template.title,
    body: text, url, priority: template.priority, recipientIds,
  })
  return json(200, { success: true, ...result })
})
