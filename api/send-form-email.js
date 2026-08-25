import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import crypto from 'crypto'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'

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
  REGISTER_LEFT_OPEN:          { title: 'Register still open', body: "A session ended a while ago but its register hasn't been closed yet.", category: 'registers', priority: 'high', url: '/?tab=registers' },
  VOLUNTEER_COVER_REQUIRED:     { title: 'Volunteer cover needed', body: 'A session needs more volunteer cover.', category: 'volunteers', priority: 'normal', url: '/?tab=volunteers' },
  FORM_SUBMISSION_RECEIVED:     { title: 'New form submission', body: 'A new form response has come in.', category: 'forms', priority: 'normal', url: '/?tab=forms' },
  CONSENT_EXPIRING:             { title: 'Consent expiring', body: 'A consent record is expiring soon.', category: 'consents', priority: 'normal', url: '/?tab=children' },
  MEDICAL_INFO_UPDATED:         { title: 'Medical information updated', body: "A young person's medical information has been updated.", category: 'medical', priority: 'normal', url: '/?tab=children' },
  RISK_ASSESSMENT_DUE:          { title: 'Risk assessment due', body: 'A risk assessment needs review.', category: 'resources', priority: 'normal', url: '/?tab=risk_assessments' },
  RESOURCE_BOOKING_UPDATE:      { title: 'Resource booking update', body: 'A resource booking has been approved or changed.', category: 'resources', priority: 'low', url: '/?tab=resources' },
  REFLECTION_DUE:                { title: 'Reflection due', body: 'A session is ready for its reflection to be written up.', category: 'reflections', priority: 'low', url: '/?tab=registers' },
  INVITATION_ACCEPTED:          { title: 'Invitation accepted', body: 'Someone has accepted your invitation.', category: 'volunteers', priority: 'low', url: '/?tab=volunteers' },
  STAFF_ADDED_TO_SESSION:       { title: 'Added to a session', body: "You've been added to a session.", category: 'sessions', priority: 'normal', url: '/?tab=sessions' },
  SESSION_CREATED:              { title: 'New session created', body: 'A new session has been created.', category: 'sessions', priority: 'normal', url: '/?tab=registers' },
  SESSION_EDITED:                { title: 'Session updated', body: 'A session you\u2019re assigned to has been updated.', category: 'sessions', priority: 'normal', url: '/?tab=registers' },
  SECURITY_ALERT:                { title: 'Security alert', body: 'A security-related event needs your attention.', category: 'security', priority: 'critical', url: '/?tab=settings' },
  CHILD_REGISTRATION_SUBMITTED: { title: 'New registration to authorise', body: 'A parent has submitted a new registration awaiting approval.', category: 'children', priority: 'high', url: '/?tab=children&sub=requests' },
}


// ── Passkeys (WebAuthn) ───────────────────────────────────────────────────
// Shares this function to stay within the Hobby plan's 12-serverless-function
// limit, same as the push and cron branches above.
//
// The relying party ID is the registrable domain a credential is bound to. It
// cannot be taken from the request unchecked — an attacker-controlled Host
// header would otherwise let a credential be minted for another origin — so
// it is resolved against a fixed allowlist.
const PASSKEY_ORIGINS = {
  'https://app.launchsession.co.uk': 'launchsession.co.uk',
  'https://launchsession.co.uk':     'launchsession.co.uk',
  'http://localhost:3000':           'localhost',
}

function resolveRp(req) {
  const origin = req.headers.origin || ''
  const rpID = PASSKEY_ORIGINS[origin]
  return rpID ? { rpID, origin } : null
}

// Single-use: consumed challenges are deleted, so an intercepted assertion
// cannot be replayed. Expired ones are swept at the same time.
async function consumeChallenge(adminClient, id, kind) {
  if (!id) return null
  // DELETE ... RETURNING, in one statement. A prior SELECT-then-DELETE let two
  // concurrent verifies both read the row before either delete committed, so a
  // captured assertion could be replayed to mint a second session. Postgres
  // serialises the delete, so exactly one caller gets the row back.
  const { data, error } = await adminClient.from('webauthn_challenges')
    .delete().eq('id', id).eq('kind', kind)
    .select('*').maybeSingle()
  // A failed delete must not be treated as a successful consume, or the
  // challenge stays reusable while the assertion is accepted.
  if (error || !data) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null
  return data
}

// Which event types are actually wired up to resolve real recipients today.
// Anything else is documented (has copy above) but intentionally rejected
// rather than silently resolving to nobody or the wrong audience.
// SESSION_CANCELLED, FORM_SUBMISSION_RECEIVED, MEDICAL_INFO_UPDATED,
// RESOURCE_BOOKING_UPDATE, and INVITATION_ACCEPTED are handled by DB
// triggers (see the notification_coverage_triggers migration) that write
// directly to the notifications table — bell-only, no real push. That's
// what makes them fire for every code path, including anonymous public-form
// submitters who have no session to call this endpoint with.
// REGISTER_INCOMPLETE and REFLECTION_DUE are raised by trg_notify_session_closed:
// REGISTER_INCOMPLETE stays bell-only; REFLECTION_DUE also fires a real push
// (lead_staff_id only) via the db_event_push path below, same pattern as
// SESSION_CREATED/EDITED.
// SESSION_STARTING_SOON, REGISTER_LEFT_OPEN, RISK_ASSESSMENT_DUE,
// CONSENT_EXPIRING, and VOLUNTEER_COVER_REQUIRED are time-based rather than
// event-based, so they're handled by the `cron_reminders` branch further
// down, polled by an external cron (see `starting_soon_notified_at` /
// `register_open_reminder_sent_at` / `review_reminder_sent_at` /
// `expiry_reminder_sent_at` / `volunteer_cover_reminder_sent_at` for the
// dedup mechanism — note this deliberately never auto-resolves anything
// itself, only alerts the people who can).
// SESSION_CREATED and SESSION_EDITED are handled by a DB trigger too
// (notify_session_created_or_edited migration) but — unlike the
// bell-only trigger group above — that trigger also fires an actual push
// via pg_net, hitting the `db_event_push` branch below with a
// per-call shared secret (DB_EVENT_SECRET, distinct from CRON_SECRET
// since this fires inside a user's own transaction rather than an
// external poll). This covers every place a session gets created/edited
// (wizard, session form, trip/event editor, future ones) from one place
// instead of instrumenting each call site separately.
// SECURITY_ALERT is raised by trg_notify_role_escalation on user_profiles
// (a user promoted to admin/owner) — org-wide rather than session-scoped, so
// it passes an explicit recipient_ids array to db_event_push instead of a
// session_id.
// CHILD_REGISTRATION_SUBMITTED is raised by trg_notify_child_registration on
// child_registration_requests (INSERT). Submitted by a parent on the public
// registration form with no logged-in session, so — like SECURITY_ALERT —
// it can't go through the session-gated `push` branch below; the trigger
// resolves org admins/owners itself and passes them as recipient_ids to
// db_event_push, using the shared DB_EVENT_SECRET rather than a user token.
// This also writes the bell notification directly via notify_users, same as
// the bell-only trigger group above, so it works even if VAPID/push isn't
// configured.
const IMPLEMENTED_EVENTS = new Set(['TEST_NOTIFICATION', 'SAFEGUARDING_ACTION_REQUIRED', 'NEW_MESSAGE', 'STAFF_ADDED_TO_SESSION'])

// Shared delivery path for the cron_reminders sweeps below — resolves
// per-user notification prefs, writes the in-app notification row
// regardless of push eligibility, then sends + logs the actual push.
// (The user-triggered `push` type branch further down has its own copy of
// this logic — deliberately not merged, so a change to one code path can't
// silently affect the other.)
// Safeguarding/security-critical event types that must always reach their
// recipients, matching the locked (non-togglable) groups in the
// Notifications settings screen. Enforced here, not just in the UI --
// someone editing notification_preferences directly (bypassing the app)
// still can't silence these.
const CRITICAL_EVENT_TYPES = new Set(['SAFEGUARDING_ACTION_REQUIRED', 'SECURITY_ALERT'])

async function deliverSweepPush(adminClient, { org_id, event_type, category, title, body, url, priority, recipientIds }) {
  const ids = [...new Set(recipientIds)].filter(Boolean)
  if (ids.length === 0) return 0

  const { data: prefsRows } = await adminClient.from('notification_preferences').select('*').in('user_id', ids)
  const prefsByUser = {}
  ;(prefsRows || []).forEach(p => { prefsByUser[p.user_id] = p })
  const eligibleIds = ids.filter(id => {
    if (CRITICAL_EVENT_TYPES.has(event_type)) return true // never silenceable, regardless of stored prefs
    const p = prefsByUser[id]
    if (!p) return true
    if (p.push_enabled === false) return false
    // A per-type override takes precedence over the broad category toggle
    // either direction — lets someone turn off one specific alert while
    // keeping the rest of its category on, or vice versa.
    const override = p.event_overrides?.[event_type]
    if (override !== undefined) return !!override
    if (category && p[category] === false) return false
    return true
  })

  await adminClient.from('notifications').insert(ids.map(id => ({
    org_id, user_id: id, category, event_type, title, body, target_url: url, priority,
  })))

  if (eligibleIds.length === 0) return 0

  const { data: subs } = await adminClient.from('push_subscriptions').select('*').in('user_id', eligibleIds).eq('is_active', true)
  const payload = JSON.stringify({ title, body, url, event_type, category, priority, tag: `${event_type.toLowerCase()}-${url}` })
  let sent = 0
  const logRows = []
  await Promise.allSettled((subs || []).map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      sent += 1
      logRows.push({ org_id, user_id: sub.user_id, subscription_id: sub.id, event_type, status: 'sent' })
      await adminClient.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
    } catch (err) {
      const code = err?.statusCode
      logRows.push({ org_id, user_id: sub.user_id, subscription_id: sub.id, event_type, status: 'failed', error_code: code ? String(code) : 'unknown' })
      if (code === 404 || code === 410) {
        await adminClient.from('push_subscriptions').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', sub.id)
      }
    }
  }))
  if (logRows.length) await adminClient.from('push_delivery_logs').insert(logRows)
  return sent
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    // ── Signup invite — called by create_trial_signup via pg_net once the
    // signup transaction commits, never by the browser. The whole point is
    // that admin_invite_token must reach the mailbox and nowhere else: the
    // email IS the proof that whoever filled in the form actually owns the
    // address they typed. Returning it in the RPC response skipped that proof
    // entirely and let an anonymous caller mint an admin token for any address.
    // Gated by the same shared secret as db_event_push. ──
    if (req.body?.type === 'signup_invite_email') {
      const providedSecret = req.headers['x-db-event-secret']
      const { DB_EVENT_SECRET } = process.env
      if (!DB_EVENT_SECRET || providedSecret !== DB_EVENT_SECRET) return res.status(401).json({ error: 'Unauthorized' })

      const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
      if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_SERVICE_KEY) {
        console.error('send-form-email(signup_invite_email): missing Supabase env vars')
        return res.status(500).json({ error: 'Server misconfiguration' })
      }

      const { trial_id } = req.body
      if (!trial_id) return res.status(400).json({ error: 'Missing trial_id' })

      // The token is read here, server-side, rather than accepted from the
      // caller -- so even this endpoint cannot be used to post an arbitrary
      // token to an arbitrary address.
      const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)
      const { data: trial, error: trialErr } = await adminClient
        .from('trial_requests')
        .select('email, full_name, organisation_name, generated_slug, admin_invite_token, status')
        .eq('id', trial_id).maybeSingle()

      if (trialErr || !trial || trial.status !== 'approved' || !trial.admin_invite_token) {
        console.error('send-form-email(signup_invite_email): no approved trial for', trial_id)
        return res.status(400).json({ error: 'Invalid signup' })
      }

      const { error: fnErr } = await adminClient.functions.invoke('send-invite-email', {
        body: {
          email: trial.email,
          full_name: trial.full_name,
          org_name: trial.organisation_name,
          org_slug: trial.generated_slug,
          org_color: '#3B82F6',
          org_logo: null,
          token: trial.admin_invite_token,
          role: 'admin',
        },
      })
      if (fnErr) {
        console.error('send-form-email(signup_invite_email): send failed', fnErr.message)
        return res.status(500).json({ error: 'Could not send invite' })
      }
      return res.status(200).json({ ok: true })
    }

    // ── SESSION_CREATED / SESSION_EDITED — called by the
    // notify_session_created_or_edited Postgres trigger via pg_net right
    // after an insert/update commits, not by a logged-in user, so it's
    // gated by its own shared secret (kept separate from CRON_SECRET since
    // this fires inside a user's transaction, not an external poll). ──
    if (req.body?.type === 'db_event_push') {
      const providedSecret = req.headers['x-db-event-secret']
      const { DB_EVENT_SECRET, REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
      if (!DB_EVENT_SECRET || providedSecret !== DB_EVENT_SECRET) return res.status(401).json({ error: 'Unauthorized' })
      if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_SERVICE_KEY) {
        console.error('send-form-email(db_event_push): missing Supabase env vars')
        return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' })
      }
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('send-form-email(db_event_push): missing VAPID keys')
        return res.status(500).json({ error: 'Push notifications are not configured on the server yet' })
      }

      const { event_type, session_id, actor_user_id, recipient_ids, org_id: bodyOrgId, body_override } = req.body || {}
      if (!event_type || !EVENT_TEMPLATES[event_type]) return res.status(400).json({ error: 'Unknown or missing event_type' })

      const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)
      webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@launchsession.co.uk', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

      const template = EVENT_TEMPLATES[event_type]
      let orgId, recipientIds, notifBody = body_override || template.body, notifUrl = template.url

      if (session_id) {
        // Session-scoped events: SESSION_CREATED, SESSION_EDITED, REFLECTION_DUE.
        const { data: sessionRow, error: sessionErr } = await adminClient.from('sessions').select('id, org_id, title, lead_staff_id').eq('id', session_id).maybeSingle()
        if (sessionErr || !sessionRow) return res.status(404).json({ error: 'Session not found' })
        orgId = sessionRow.org_id

        if (event_type === 'REFLECTION_DUE') {
          // Only the lead needs to write the reflection — not the whole team.
          recipientIds = [sessionRow.lead_staff_id].filter(Boolean)
          notifBody = `The session "${sessionRow.title}" is ready for its reflection to be written up.`
          notifUrl = `/?tab=registers&session=${sessionRow.id}`
        } else {
          const { data: staffRows } = await adminClient.from('session_staff').select('user_id').eq('session_id', session_id).not('user_id', 'is', null)
          // Never notify whoever just made the change about their own action.
          recipientIds = [sessionRow.lead_staff_id, ...(staffRows || []).map(r => r.user_id)].filter(id => id && id !== actor_user_id)
          const verb = event_type === 'SESSION_CREATED' ? 'created' : 'updated'
          notifBody = `"${sessionRow.title}" has been ${verb}.`
          notifUrl = `/?tab=registers&session=${sessionRow.id}`
        }
      } else if (bodyOrgId && Array.isArray(recipient_ids)) {
        // Org-wide events with no single session to hang off, e.g. SECURITY_ALERT.
        // The trigger computes and passes the recipient list itself since it
        // already has the context (role change, etc.) that decided who cares.
        orgId = bodyOrgId
        recipientIds = recipient_ids.filter(id => id && id !== actor_user_id)
      } else {
        return res.status(400).json({ error: 'Missing session_id or (org_id + recipient_ids)' })
      }

      const sent = await deliverSweepPush(adminClient, {
        org_id: orgId,
        event_type,
        category: template.category,
        title: template.title,
        body: notifBody,
        url: notifUrl,
        priority: template.priority,
        recipientIds,
      })

      return res.status(200).json({ success: true, recipients: recipientIds.length, pushes_sent: sent })
    }

    // ── SESSION_STARTING_SOON sweep — called by an external cron (e.g.
    // cron-job.org) every ~10 min, not by a logged-in user, so it's gated
    // by a shared secret instead of a Supabase session token. Lives here
    // too, same 12-function Hobby cap reason as everything else below. ──
    if (req.body?.type === 'cron_reminders') {
      const providedSecret = req.headers['x-cron-secret']
      const { CRON_SECRET, REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
      if (!CRON_SECRET || providedSecret !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })
      if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_SERVICE_KEY) {
        console.error('send-form-email(cron_reminders): missing Supabase env vars')
        return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' })
      }
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('send-form-email(cron_reminders): missing VAPID keys')
        return res.status(500).json({ error: 'Push notifications are not configured on the server yet' })
      }

      const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)
      webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@launchsession.co.uk', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

      // All orgs are UK-based today, so "starting soon" is computed against
      // UK wall-clock time rather than per-org/per-user timezones.
      const now = new Date()
      const ukParts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(now).map(p => [p.type, p.value])
      )
      const todayStr = `${ukParts.year}-${ukParts.month}-${ukParts.day}`
      const nowMinutes = parseInt(ukParts.hour, 10) * 60 + parseInt(ukParts.minute, 10)

      const { data: candidates, error: candErr } = await adminClient
        .from('sessions')
        .select('id, org_id, title, start_time, lead_staff_id')
        .eq('session_date', todayStr)
        .is('cancelled_at', null)
        .is('closed_at', null)
        .is('starting_soon_notified_at', null)

      if (candErr) {
        console.error('send-form-email(cron_reminders): failed to query sessions', candErr)
        return res.status(500).json({ error: 'Failed to query sessions' })
      }

      // Window sized to the ~10-min cron cadence — every session starting
      // today passes through exactly one 25–35-min-out tick, with slack
      // for cron jitter, so it's caught once and only once.
      const due = (candidates || []).filter(s => {
        const [h, m] = String(s.start_time || '').split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return false
        const diff = (h * 60 + m) - nowMinutes
        return diff >= 25 && diff <= 35
      })

      const startingSoonTemplate = EVENT_TEMPLATES.SESSION_STARTING_SOON
      let startingSoonSent = 0

      for (const session of due) {
        const { data: staffRows } = await adminClient.from('session_staff').select('user_id').eq('session_id', session.id).not('user_id', 'is', null)
        const recipientIds = [session.lead_staff_id, ...(staffRows || []).map(r => r.user_id)]

        startingSoonSent += await deliverSweepPush(adminClient, {
          org_id: session.org_id,
          event_type: 'SESSION_STARTING_SOON',
          category: startingSoonTemplate.category,
          title: startingSoonTemplate.title,
          body: `"${session.title}" starts in 30 minutes.`,
          url: `/?tab=registers&session=${session.id}`,
          priority: startingSoonTemplate.priority,
          recipientIds,
        })

        // Mark as notified regardless of recipient count/push success, so a
        // session with no assigned staff (or a transient send failure)
        // doesn't get re-queried on every subsequent tick.
        await adminClient.from('sessions').update({ starting_soon_notified_at: new Date().toISOString() }).eq('id', session.id)
      }

      // ── REGISTER_LEFT_OPEN — deliberately never auto-closes a register;
      // only alerts the people who can. Looks at today + yesterday (not
      // just today) so a session ending late at night still gets caught
      // once the 15-min grace period rolls past midnight before the next
      // tick, without needing real timezone-aware date math. ──
      const y = new Date(now)
      y.setUTCDate(y.getUTCDate() - 1)
      const yParts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(y).map(p => [p.type, p.value])
      )
      const yesterdayStr = `${yParts.year}-${yParts.month}-${yParts.day}`

      const { data: openCandidates, error: openErr } = await adminClient
        .from('sessions')
        .select('id, org_id, title, session_date, end_time, lead_staff_id')
        .in('session_date', [todayStr, yesterdayStr])
        .is('cancelled_at', null)
        .is('closed_at', null)
        .is('register_open_reminder_sent_at', null)

      if (openErr) {
        console.error('send-form-email(cron_reminders): failed to query open registers', openErr)
        return res.status(500).json({ error: 'Failed to query sessions' })
      }

      const overdue = (openCandidates || []).filter(s => {
        const [h, m] = String(s.end_time || '').split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return false
        const endMinutes = h * 60 + m
        const diff = s.session_date === todayStr ? (nowMinutes - endMinutes) : (nowMinutes + 1440 - endMinutes)
        return diff >= 15 // at least 15 min past scheduled end
      })

      const openTemplate = EVENT_TEMPLATES.REGISTER_LEFT_OPEN
      let openSent = 0

      for (const session of overdue) {
        const { data: staffRows } = await adminClient.from('session_staff').select('user_id').eq('session_id', session.id).not('user_id', 'is', null)
        const recipientIds = [session.lead_staff_id, ...(staffRows || []).map(r => r.user_id)]

        openSent += await deliverSweepPush(adminClient, {
          org_id: session.org_id,
          event_type: 'REGISTER_LEFT_OPEN',
          category: openTemplate.category,
          title: openTemplate.title,
          body: `"${session.title}" ended at ${session.end_time} but its register is still open.`,
          url: `/?tab=registers&session=${session.id}`,
          priority: openTemplate.priority,
          recipientIds,
        })

        // Only marks the reminder as sent — never touches closed_at. Closing
        // stays a deliberate human action; this sweep only ever alerts.
        await adminClient.from('sessions').update({ register_open_reminder_sent_at: new Date().toISOString() }).eq('id', session.id)
      }

      // ── RISK_ASSESSMENT_DUE — non-archived assessments whose next review
      // date is today or already passed, or due within the next 7 days.
      // Notified once per due-window via review_reminder_sent_at; a new
      // review (which should update next_review_date) naturally re-arms it. ──
      const dueWindow = new Date(now)
      dueWindow.setUTCDate(dueWindow.getUTCDate() + 7)
      const dueWindowStr = dueWindow.toISOString().slice(0, 10)

      const { data: dueAssessments, error: raErr } = await adminClient
        .from('risk_assessments')
        .select('id, org_id, name, next_review_date, assigned_reviewer_id')
        .eq('archived', false)
        .not('next_review_date', 'is', null)
        .lte('next_review_date', dueWindowStr)
        .is('review_reminder_sent_at', null)

      if (raErr) console.error('send-form-email(cron_reminders): failed to query risk_assessments', raErr)

      const raTemplate = EVENT_TEMPLATES.RISK_ASSESSMENT_DUE
      let raSent = 0
      for (const ra of (dueAssessments || [])) {
        const { data: admins } = await adminClient.from('user_profiles').select('id').eq('org_id', ra.org_id).in('role', ['admin', 'owner'])
        const recipientIds = [ra.assigned_reviewer_id, ...(admins || []).map(a => a.id)]
        const overdue = ra.next_review_date <= todayStr
        raSent += await deliverSweepPush(adminClient, {
          org_id: ra.org_id,
          event_type: 'RISK_ASSESSMENT_DUE',
          category: raTemplate.category,
          title: raTemplate.title,
          body: `"${ra.name}" ${overdue ? 'was due for review on' : 'is due for review on'} ${ra.next_review_date}.`,
          url: '/?tab=risk_assessments',
          priority: raTemplate.priority,
          recipientIds,
        })
        await adminClient.from('risk_assessments').update({ review_reminder_sent_at: new Date().toISOString() }).eq('id', ra.id)
      }

      // ── CONSENT_EXPIRING — granted consents with an expiry date within the
      // next 7 days. expires_at is optional/nullable (most consent types
      // don't expire), so this only ever fires for the ones that are set. ──
      const { data: expiringConsents, error: ceErr } = await adminClient
        .from('child_consents')
        .select('id, org_id, child_id, consent_type, expires_at')
        .eq('status', 'granted')
        .not('expires_at', 'is', null)
        .lte('expires_at', dueWindow.toISOString())
        .is('expiry_reminder_sent_at', null)

      if (ceErr) console.error('send-form-email(cron_reminders): failed to query child_consents', ceErr)

      const ceTemplate = EVENT_TEMPLATES.CONSENT_EXPIRING
      let ceSent = 0
      for (const consent of (expiringConsents || [])) {
        const { data: child } = await adminClient.from('children').select('first_name, last_name').eq('id', consent.child_id).maybeSingle()
        const { data: admins } = await adminClient.from('user_profiles').select('id').eq('org_id', consent.org_id).in('role', ['admin', 'owner'])
        const recipientIds = (admins || []).map(a => a.id)
        const childName = child ? `${child.first_name} ${child.last_name}` : 'A child'
        ceSent += await deliverSweepPush(adminClient, {
          org_id: consent.org_id,
          event_type: 'CONSENT_EXPIRING',
          category: ceTemplate.category,
          title: ceTemplate.title,
          body: `${childName}'s ${consent.consent_type} consent expires on ${new Date(consent.expires_at).toISOString().slice(0, 10)}.`,
          url: '/?tab=children',
          priority: ceTemplate.priority,
          recipientIds,
        })
        await adminClient.from('child_consents').update({ expiry_reminder_sent_at: new Date().toISOString() }).eq('id', consent.id)
      }

      // ── VOLUNTEER_COVER_REQUIRED — sessions starting within 24h that are
      // short of their volunteer_limit. Alerts admins (they arrange cover),
      // not the assigned team, since the team can't fix a staffing gap
      // themselves. Uses the same today/tomorrow UK-date approach as the
      // other sweeps rather than a single date, so anything within a
      // rolling 24h window is caught regardless of where in the day we are. ──
      const t = new Date(now)
      t.setUTCDate(t.getUTCDate() + 1)
      const tParts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(t).map(p => [p.type, p.value])
      )
      const tomorrowStr = `${tParts.year}-${tParts.month}-${tParts.day}`

      const { data: coverCandidates, error: vcErr } = await adminClient
        .from('sessions')
        .select('id, org_id, title, session_date, start_time, volunteer_limit')
        .in('session_date', [todayStr, tomorrowStr])
        .is('cancelled_at', null)
        .is('closed_at', null)
        .not('volunteer_limit', 'is', null)
        .gt('volunteer_limit', 0)
        .is('volunteer_cover_reminder_sent_at', null)

      if (vcErr) console.error('send-form-email(cron_reminders): failed to query sessions for volunteer cover', vcErr)

      const withinNext24h = (coverCandidates || []).filter(s => {
        const [h, m] = String(s.start_time || '').split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return false
        const startMinutes = h * 60 + m
        const diff = s.session_date === todayStr ? (startMinutes - nowMinutes) : (startMinutes + 1440 - nowMinutes)
        return diff >= 0 && diff <= 1440
      })

      const vcTemplate = EVENT_TEMPLATES.VOLUNTEER_COVER_REQUIRED
      let vcSent = 0
      for (const session of withinNext24h) {
        const { count } = await adminClient.from('session_staff').select('id', { count: 'exact', head: true }).eq('session_id', session.id).not('volunteer_id', 'is', null)
        if ((count || 0) >= session.volunteer_limit) {
          await adminClient.from('sessions').update({ volunteer_cover_reminder_sent_at: new Date().toISOString() }).eq('id', session.id)
          continue
        }
        const { data: admins } = await adminClient.from('user_profiles').select('id').eq('org_id', session.org_id).in('role', ['admin', 'owner'])
        const recipientIds = (admins || []).map(a => a.id)
        vcSent += await deliverSweepPush(adminClient, {
          org_id: session.org_id,
          event_type: 'VOLUNTEER_COVER_REQUIRED',
          category: vcTemplate.category,
          title: vcTemplate.title,
          body: `"${session.title}" has ${count || 0}/${session.volunteer_limit} volunteers signed up and starts soon.`,
          url: `/?tab=registers&session=${session.id}`,
          priority: vcTemplate.priority,
          recipientIds,
        })
        await adminClient.from('sessions').update({ volunteer_cover_reminder_sent_at: new Date().toISOString() }).eq('id', session.id)
      }

      // ── DATA RETENTION — archives closed registers past an org's
      // retention window, then permanently deletes archived registers past
      // a further grace period. Both settings are opt-in (null = never
      // runs), so this is a no-op for every org unless they've explicitly
      // set it in Settings > Registers. Deletion goes through
      // delete_session_for_retention, which preserves safeguarding records
      // (nulls the link rather than deleting the concern) and writes a
      // minimal audit row before the actual attendance data is removed. ──
      const { data: retentionOrgs, error: retErr } = await adminClient
        .from('organisations')
        .select('id, register_retention_months, register_deletion_grace_months')
        .or('register_retention_months.not.is.null,register_deletion_grace_months.not.is.null')

      if (retErr) console.error('send-form-email(cron_reminders): failed to query organisations for retention', retErr)

      let archivedCount = 0
      let deletedCount = 0

      for (const orgRow of (retentionOrgs || [])) {
        if (orgRow.register_retention_months != null) {
          const cutoff = new Date(now)
          cutoff.setUTCMonth(cutoff.getUTCMonth() - orgRow.register_retention_months)
          const cutoffStr = cutoff.toISOString().slice(0, 10)

          const { data: toArchive } = await adminClient
            .from('sessions')
            .select('id')
            .eq('org_id', orgRow.id)
            .not('closed_at', 'is', null)
            .is('archived_at', null)
            .lte('session_date', cutoffStr)

          if (toArchive && toArchive.length > 0) {
            await adminClient.from('sessions').update({ archived_at: new Date().toISOString() }).in('id', toArchive.map(s => s.id))
            archivedCount += toArchive.length
          }
        }

        if (orgRow.register_deletion_grace_months != null) {
          const deleteCutoff = new Date(now)
          deleteCutoff.setUTCMonth(deleteCutoff.getUTCMonth() - orgRow.register_deletion_grace_months)

          const { data: toDelete } = await adminClient
            .from('sessions')
            .select('id')
            .eq('org_id', orgRow.id)
            .not('archived_at', 'is', null)
            .lte('archived_at', deleteCutoff.toISOString())

          for (const s of (toDelete || [])) {
            const { error: delErr } = await adminClient.rpc('delete_session_for_retention', { p_session_id: s.id })
            if (delErr) console.error('send-form-email(cron_reminders): failed to delete session for retention', s.id, delErr)
            else deletedCount += 1
          }
        }
      }

      return res.status(200).json({
        success: true,
        sessions_starting_soon: due.length,
        starting_soon_pushes: startingSoonSent,
        registers_left_open: overdue.length,
        left_open_pushes: openSent,
        risk_assessments_due: (dueAssessments || []).length,
        risk_assessment_pushes: raSent,
        consents_expiring: (expiringConsents || []).length,
        consent_pushes: ceSent,
        volunteer_cover_candidates: withinNext24h.length,
        volunteer_cover_pushes: vcSent,
        registers_archived: archivedCount,
        registers_deleted: deletedCount,
      })
    }

    // ── Passkey sign-in. Deliberately above the auth-header check: the whole
    // point is that the caller has no session yet. Both branches are safe to
    // expose because neither reveals whether an account exists — options are
    // returned unconditionally, and a failed assertion returns the same
    // generic error whether the credential is unknown or the signature is
    // bad. ──
    if (req.body?.type === 'passkey_auth_options' || req.body?.type === 'passkey_auth_verify') {
      const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
      if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_SERVICE_KEY) {
        console.error('send-form-email(passkey): missing Supabase credentials')
        return res.status(500).json({ error: 'Passkeys are not configured on the server yet' })
      }
      const rp = resolveRp(req)
      if (!rp) return res.status(400).json({ error: 'Passkeys are not available on this domain' })

      const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

      if (req.body.type === 'passkey_auth_options') {
        // Unauthenticated and it writes a row, so it needs a bound or it is a
        // free anonymous insert primitive. Keyed on a hash of the client IP:
        // the raw address is not stored, and the origin allowlist is no defence
        // here since a non-browser client can just send an allowed Origin.
        const fwd = req.headers['x-forwarded-for'] || ''
        const clientIp = String(fwd).split(',')[0].trim() || 'unknown'
        const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').slice(0, 32)
        const { data: allowed } = await adminClient.rpc('check_rate_limit', {
          p_bucket: 'passkey_auth:' + ipHash, p_max: 20, p_window_secs: 300,
        })
        if (allowed === false) {
          return res.status(429).json({ error: 'Too many passkey attempts. Please wait a moment and try again.' })
        }

        // No allowCredentials: passkeys here are discoverable, so the
        // authenticator tells us which account it holds. That is what lets
        // sign-in skip the email step entirely, and it avoids handing out a
        // credential list to an unauthenticated caller.
        const options = await generateAuthenticationOptions({
          rpID: rp.rpID,
          userVerification: 'required',
          timeout: 60000,
        })
        const { data: row, error } = await adminClient.from('webauthn_challenges')
          .insert({ challenge: options.challenge, kind: 'authentication' })
          .select('id').single()
        if (error) {
          console.error('send-form-email(passkey): challenge insert failed', error)
          return res.status(500).json({ error: 'Could not start passkey sign-in' })
        }
        adminClient.rpc('purge_expired_webauthn_challenges').then(() => {}, () => {})
        return res.status(200).json({ options, challengeId: row.id })
      }

      // ── verify ──
      const { challengeId, credential } = req.body
      const generic = { error: 'That passkey didn\u2019t work. Try again, or use your password.' }
      if (!credential?.rawId) return res.status(400).json(generic)

      const challenge = await consumeChallenge(adminClient, challengeId, 'authentication')
      if (!challenge) return res.status(400).json({ error: 'That sign-in attempt expired. Try again.' })

      const { data: stored } = await adminClient.from('webauthn_credentials')
        .select('*').eq('credential_id', credential.rawId).maybeSingle()
      if (!stored) return res.status(401).json(generic)

      let verification
      try {
        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge: challenge.challenge,
          expectedOrigin: rp.origin,
          expectedRPID: rp.rpID,
          requireUserVerification: true,
          authenticator: {
            credentialID: stored.credential_id,
            credentialPublicKey: Buffer.from(stored.public_key, 'base64url'),
            counter: Number(stored.counter) || 0,
            transports: stored.transports || undefined,
          },
        })
      } catch (e) {
        console.error('send-form-email(passkey): assertion failed', e.message)
        return res.status(401).json(generic)
      }
      if (!verification.verified) return res.status(401).json(generic)

      // A counter that fails to advance suggests a cloned authenticator.
      // Authenticators that always report 0 are legitimate and common
      // (Apple's, notably), so only a *regression* is treated as suspect.
      const newCounter = verification.authenticationInfo?.newCounter ?? 0
      const oldCounter = Number(stored.counter) || 0
      if (oldCounter > 0 && newCounter > 0 && newCounter <= oldCounter) {
        console.error('send-form-email(passkey): counter regression for credential', stored.id)
        return res.status(401).json(generic)
      }

      await adminClient.from('webauthn_credentials')
        .update({ counter: newCounter, last_used_at: new Date().toISOString() })
        .eq('id', stored.id)

      // Mint a session. The assertion is verified at this point, so issuing a
      // one-time token for this user is exactly as strong as a correct
      // password would have been.
      const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(stored.user_id)
      if (userErr || !userData?.user?.email) return res.status(401).json(generic)

      const { data: link, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.user.email,
      })
      if (linkErr || !link?.properties?.hashed_token) {
        console.error('send-form-email(passkey): could not mint session', linkErr)
        return res.status(500).json({ error: 'Signed in, but the session couldn\u2019t be created' })
      }

      return res.status(200).json({ token_hash: link.properties.hashed_token })
    }

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

    // ── Passkey enrolment and management. These need a real session: a
    // passkey is added to an account you have already proved you own. ──
    if (req.body?.type?.startsWith('passkey_')) {
      const rp = resolveRp(req)
      if (!rp) return res.status(400).json({ error: 'Passkeys are not available on this domain' })

      if (req.body.type === 'passkey_list') {
        const { data } = await adminClient.from('webauthn_credentials')
          .select('id, device_label, created_at, last_used_at, backed_up')
          .eq('user_id', user.id).order('created_at', { ascending: false })
        return res.status(200).json({ passkeys: data || [] })
      }

      if (req.body.type === 'passkey_delete') {
        // Scoped to the caller's own credentials, so an id from another
        // account is a no-op rather than a deletion.
        await adminClient.from('webauthn_credentials')
          .delete().eq('id', req.body.id).eq('user_id', user.id)
        return res.status(200).json({ ok: true })
      }

      if (req.body.type === 'passkey_register_options') {
        const { data: existing } = await adminClient.from('webauthn_credentials')
          .select('credential_id, transports').eq('user_id', user.id)

        const options = await generateRegistrationOptions({
          rpName: 'LaunchSession',
          rpID: rp.rpID,
          userID: Buffer.from(user.id),
          userName: user.email,
          userDisplayName: profile.full_name || user.email,
          timeout: 60000,
          attestationType: 'none',
          // Exclude what's already enrolled, so the authenticator says "you
          // already have one" rather than silently creating a duplicate.
          excludeCredentials: (existing || []).map(c => ({
            id: c.credential_id, type: 'public-key', transports: c.transports || undefined,
          })),
          authenticatorSelection: {
            residentKey: 'required',      // discoverable: sign-in needs no email
            userVerification: 'required', // Face ID / Touch ID, not just presence
          },
        })

        const { data: row, error } = await adminClient.from('webauthn_challenges')
          .insert({ challenge: options.challenge, kind: 'registration', user_id: user.id })
          .select('id').single()
        if (error) {
          console.error('send-form-email(passkey): challenge insert failed', error)
          return res.status(500).json({ error: 'Could not start passkey setup' })
        }
        return res.status(200).json({ options, challengeId: row.id })
      }

      if (req.body.type === 'passkey_register_verify') {
        const { challengeId, credential, deviceLabel } = req.body
        const challenge = await consumeChallenge(adminClient, challengeId, 'registration')
        if (!challenge || challenge.user_id !== user.id) {
          return res.status(400).json({ error: 'That setup attempt expired. Try again.' })
        }

        let verification
        try {
          verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: challenge.challenge,
            expectedOrigin: rp.origin,
            expectedRPID: rp.rpID,
            requireUserVerification: true,
          })
        } catch (e) {
          console.error('send-form-email(passkey): registration failed', e.message)
          return res.status(400).json({ error: 'That passkey couldn\u2019t be saved. Try again.' })
        }
        if (!verification.verified || !verification.registrationInfo) {
          return res.status(400).json({ error: 'That passkey couldn\u2019t be saved. Try again.' })
        }

        const info = verification.registrationInfo
        const credentialId = typeof info.credentialID === 'string'
          ? info.credentialID
          : Buffer.from(info.credentialID).toString('base64url')

        const { error: insErr } = await adminClient.from('webauthn_credentials').insert({
          user_id: user.id,
          org_id: profile.org_id,
          credential_id: credentialId,
          public_key: Buffer.from(info.credentialPublicKey).toString('base64url'),
          counter: info.counter || 0,
          transports: credential?.response?.transports || null,
          // Typed rather than truthy-checked: a non-string deviceLabel would
          // throw on .slice() *after* the authenticator has already registered
          // the credential, 500ing a setup the user cannot simply retry
          // (the challenge is consumed by then).
          device_label: typeof deviceLabel === 'string' && deviceLabel.trim()
            ? deviceLabel.trim().slice(0, 60)
            : 'This device',
          backed_up: !!info.credentialBackedUp,
        })
        if (insErr) {
          // Unique violation: this credential is already enrolled. Not an
          // error worth alarming anyone about.
          if (insErr.code === '23505') return res.status(200).json({ ok: true, alreadyEnrolled: true })
          console.error('send-form-email(passkey): credential insert failed', insErr)
          return res.status(500).json({ error: 'That passkey couldn\u2019t be saved. Try again.' })
        }

        return res.status(200).json({ ok: true })
      }

      return res.status(400).json({ error: 'Unknown passkey action' })
    }

    // ── Push notifications (shares this function to stay within the Hobby
    // plan's 12-serverless-functions-per-deployment limit) ──
    if (req.body?.type === 'push') {
      const { event_type, target_user_ids, thread_id, session_id } = req.body || {}
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
      } else if (event_type === 'STAFF_ADDED_TO_SESSION') {
        const requested = Array.isArray(target_user_ids) ? target_user_ids.slice(0, 200) : []
        if (requested.length === 0) return res.status(400).json({ error: 'Missing target_user_ids' })
        // Re-filter by org — a client can't push a colleague from another org this way.
        const { data: members } = await adminClient.from('user_profiles').select('id').eq('org_id', profile.org_id).in('id', requested)
        recipientIds = (members || []).map(m => m.id)
        if (session_id) {
          const { data: sessionRow } = await adminClient.from('sessions').select('id, title').eq('id', session_id).eq('org_id', profile.org_id).maybeSingle()
          if (sessionRow) {
            notifBody = `You've been added to "${sessionRow.title}".`
            notifUrl = `/?tab=registers&session=${sessionRow.id}`
          }
        }
      }

      recipientIds = [...new Set(recipientIds)].slice(0, 500) // hard cap — basic abuse guard
      if (recipientIds.length === 0) return res.status(200).json({ success: true, sent: 0, recipients: 0 })

      // Respect each recipient's own preferences (default to enabled if they
      // haven't set any yet, matching the table's own column defaults).
      const { data: prefsRows } = await adminClient.from('notification_preferences').select('*').in('user_id', recipientIds)
      const prefsByUser = {}
      ;(prefsRows || []).forEach(p => { prefsByUser[p.user_id] = p })

      const eligibleIds = recipientIds.filter(id => {
        if (CRITICAL_EVENT_TYPES.has(event_type)) return true // never silenceable, regardless of stored prefs
        const p = prefsByUser[id]
        if (!p) return true // no row yet = defaults = enabled
        if (p.push_enabled === false) return false
        const override = p.event_overrides?.[event_type]
        if (override !== undefined) return !!override
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

    const baseFormUrl = `https://app.launchsession.co.uk/forms/${org.slug}/${form.id}`

    // Each link carries the recipient row it was sent to, so a response ticks
    // off the right invite instead of being matched back by whichever
    // email-shaped value turned up in the payload -- which cannot distinguish
    // siblings sharing one parent address, and so left both outstanding.
    // Anyone not on the recipient list still gets a plain link and can still
    // respond; the recipient list is for chasing, not for admission.
    const { data: recipientRows, error: recipErr } = await adminClient.from('form_recipients')
      .select('id, recipient_email')
      .eq('form_id', form.id)
      .eq('org_id', profile.org_id)
    if (recipErr) console.error('send-form-email: recipient lookup failed', recipErr.message)

    const recipientIdByEmail = new Map(
      (recipientRows || [])
        .filter(r => r.recipient_email)
        .map(r => [String(r.recipient_email).trim().toLowerCase(), r.id])
    )
    // cleanEmails are already trimmed and lowercased, so this matches directly.
    const formUrlFor = email => {
      const recipientId = recipientIdByEmail.get(email)
      return recipientId ? `${baseFormUrl}?r=${encodeURIComponent(recipientId)}` : baseFormUrl
    }

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
          form_url: formUrlFor(email),
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
