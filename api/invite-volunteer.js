import { createClient } from '@supabase/supabase-js'

// Where an invited volunteer lands to choose a password. Only this app's own
// page: the live site, or the preview the invite was sent from.
export function volunteerAcceptUrl(origin, requested) {
  const ok = o => /^https:\/\/(app\.launchsession\.co\.uk|launchsession-[a-z0-9-]+\.vercel\.app)$/.test(o || '')
  try {
    const r = requested ? new URL(requested) : null
    if (r && ok(r.origin) && r.pathname === '/volunteer/accept-invite') return `${r.origin}/volunteer/accept-invite`
  } catch (_e) { /* fall through */ }
  return `${ok(origin) ? origin : 'https://app.launchsession.co.uk'}/volunteer/accept-invite`
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

    // Fail fast and clearly if required env vars are missing
    const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
    if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_ANON_KEY || !REACT_APP_SUPABASE_SERVICE_KEY) {
      console.error('invite-volunteer: missing required env vars', {
        hasUrl: !!REACT_APP_SUPABASE_URL,
        hasAnonKey: !!REACT_APP_SUPABASE_ANON_KEY,
        hasServiceKey: !!REACT_APP_SUPABASE_SERVICE_KEY,
      })
      return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' })
    }

    // Verify the calling user is authenticated
    const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
    const token = authHeader.replace(/^Bearer\s+/, '').trim()
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

    const { email, name, org_id, org_slug, redirect_to, role, resend_invite_id, action, user_id: targetUserId } = req.body || {}

    // Use service role for all admin operations
    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    // ── An invited volunteer has set their password: let them in. ──
    // Staff chose to invite them, so there is no second approval. Done here,
    // not from the browser, so the only accounts this can open are ones that
    // really were invited (status pending_invite), and only the person's own.
    if (action === 'accept_volunteer_invite') {
      const { data: me } = await adminClient.from('user_profiles')
        .select('id, role, status, org_id, full_name').eq('id', user.id).maybeSingle()
      if (!me || me.role !== 'volunteer' || !me.org_id) return res.status(404).json({ error: 'This invitation has no volunteer account behind it. Ask the organisation to send it again.' })
      if (me.status === 'pending_invite') {
        const { error: upErr } = await adminClient.from('user_profiles').update({ status: 'active' }).eq('id', user.id).eq('status', 'pending_invite')
        if (upErr) return res.status(500).json({ error: 'Could not finish setting up your account: ' + upErr.message })
      }
      const { data: o } = await adminClient.from('organisations').select('slug').eq('id', me.org_id).maybeSingle()
      return res.status(200).json({ success: true, org_slug: o?.slug || null })
    }

    if (!org_id || (!email && !resend_invite_id && !targetUserId)) return res.status(400).json({ error: 'Missing email or org_id' })
    // 'manager' has to be in this list. The Invite Staff dropdown offers it,
    // and without it every manager invite was silently downgraded to volunteer
    // -- which routes the person into the volunteer portal instead of the
    // dashboard they were invited to.
    const inviteRole = ['admin', 'manager', 'staff', 'volunteer'].includes(role) ? role : 'volunteer'
    const cleanEmail = (email || '').trim().toLowerCase()
    const fullName = name || (email || '').split('@')[0]

    // Only an approved member of org_id may invite into it, and only into a
    // role below their own (owners and admins may invite admins). This route
    // used to check only that the caller was signed in, then wrote org_id and
    // role from the request body with the service key. Any account at all --
    // a volunteer, a parent, a trial sign-up -- could name another
    // organisation's id with role 'admin' and its own email, and be moved
    // into that organisation as an admin.
    const { data: caller } = await adminClient
      .from('user_profiles')
      .select('org_id, role, approval_status')
      .eq('id', user.id)
      .maybeSingle()
    if (!caller || caller.org_id !== org_id || (caller.approval_status && caller.approval_status !== 'approved')) {
      return res.status(403).json({ error: 'You do not have access to this organisation' })
    }
    const canInvite = {
      owner: ['admin', 'manager', 'staff', 'volunteer'],
      admin: ['admin', 'manager', 'staff', 'volunteer'],
      manager: ['staff', 'volunteer'],
      staff: ['volunteer'],
    }[caller.role] || []

    // ── Cancel a volunteer invite nobody has used yet. Only someone allowed
    // to invite volunteers, only in their own organisation, and only an
    // account that has never been signed in to: anything else is a real
    // person's account and is removed from Team, not from here. ──
    if (action === 'cancel_volunteer_invite') {
      if (!canInvite.includes('volunteer')) return res.status(403).json({ error: "Your role can't manage volunteer invites" })
      if (!targetUserId || targetUserId === user.id) return res.status(400).json({ error: 'Missing user_id' })
      const { data: target } = await adminClient.from('user_profiles').select('org_id, role, status').eq('id', targetUserId).maybeSingle()
      if (!target || target.org_id !== org_id || target.role !== 'volunteer' || target.status !== 'pending_invite') {
        return res.status(404).json({ error: 'That invite is no longer waiting. Refresh the page.' })
      }
      const { data: authUser } = await adminClient.auth.admin.getUserById(targetUserId)
      if (authUser?.user?.last_sign_in_at) return res.status(409).json({ error: 'They have already signed in, so this is a real account now.' })
      const { error: delErr } = await adminClient.rpc('delete_user', { user_id: targetUserId })
      if (delErr) return res.status(500).json({ error: 'Could not cancel the invite: ' + delErr.message })
      return res.status(200).json({ success: true, cancelled: true })
    }

    // ── Resend a pending invite from Team: same token, same email, same
    // role rules as sending it in the first place. ──
    if (resend_invite_id) {
      const { data: invite } = await adminClient
        .from('admin_invites')
        .select('id, org_id, email, full_name, role, token, status')
        .eq('id', resend_invite_id).maybeSingle()
      if (!invite || invite.org_id !== org_id || invite.status !== 'pending') {
        return res.status(404).json({ error: 'That invite is no longer waiting. Refresh the page.' })
      }
      if (!canInvite.includes(invite.role)) {
        return res.status(403).json({ error: `Your role can't invite someone as ${invite.role}` })
      }
      const { data: o } = await adminClient
        .from('organisations').select('name, slug, primary_color, email_logo_url, logo_url').eq('id', org_id).maybeSingle()
      const { error: fnError } = await adminClient.functions.invoke('send-invite-email', {
        body: {
          email: invite.email,
          full_name: invite.full_name,
          org_name: o?.name || 'your organisation',
          org_slug: o?.slug || org_slug,
          org_color: o?.primary_color || '#3B82F6',
          org_logo: o?.email_logo_url || o?.logo_url || null,
          role: invite.role,
          token: invite.token,
        },
      })
      if (fnError) {
        console.error('invite-volunteer: resend failed', fnError)
        return res.status(502).json({ error: 'The email could not be sent. Try again in a minute.' })
      }
      return res.status(200).json({ success: true, resent: true })
    }

    if (!canInvite.includes(inviteRole)) {
      return res.status(403).json({ error: `Your role can't invite someone as ${inviteRole}` })
    }

    // ── Check for an existing account up front. This applies the same way ──
    // regardless of which invite path (volunteer vs staff/admin) we take below.
    let existingUserId = null
    let existingUserNeverSignedIn = false
    try {
      // Supabase Admin API has no direct "get user by email" — page through listUsers.
      // For larger user bases this should be replaced with a dedicated lookup (e.g. an
      // RPC or a users-by-email index), but this covers current scale.
      let page = 1
      const perPage = 200
      while (!existingUserId) {
        const { data: pageData, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage })
        if (listErr) throw listErr
        const match = pageData.users.find(u => u.email?.toLowerCase() === cleanEmail)
        if (match) {
          existingUserId = match.id
          // A stray auth.users row can exist without the person ever having
          // actually completed setup (e.g. a leftover from an earlier invite
          // attempt) — if they've never signed in, there's no real password
          // to "go to workspace" with. Treat this the same as a brand-new
          // invite instead of silently sending them a dead-end sign-in link.
          existingUserNeverSignedIn = !match.last_sign_in_at
          break
        }
        if (pageData.users.length < perPage) break // last page reached, no match
        page += 1
      }
    } catch (lookupErr) {
      console.error('invite-volunteer: existing-user lookup failed', lookupErr)
      return res.status(500).json({ error: 'Failed to look up existing user: ' + lookupErr.message })
    }

    // Get org details for the email (non-fatal if this fails)
    async function fetchOrgData() {
      try {
        const { data: org, error: orgErr } = await adminClient
          .from('organisations')
          .select('name, slug, primary_color, logo_url, email_logo_url')
          .eq('id', org_id)
          .single()
        if (orgErr) throw orgErr
        return org
      } catch (orgFetchErr) {
        console.error('invite-volunteer: org lookup failed (non-fatal)', orgFetchErr)
        return null
      }
    }

    if (existingUserId === user.id) {
      return res.status(400).json({ error: "You can't change your own role here" })
    }

    // An account belongs to one organisation. Moving someone else's account
    // into this one would take it from the organisation it belongs to, so an
    // invite can only add someone who is not yet a member anywhere, or update
    // a member of this organisation.
    if (existingUserId) {
      const { data: existingProfile } = await adminClient
        .from('user_profiles').select('org_id').eq('id', existingUserId).maybeSingle()
      if (existingProfile?.org_id && existingProfile.org_id !== org_id) {
        return res.status(409).json({ error: 'This email already has a LaunchSession account with another organisation, so it cannot be added here.' })
      }
    }

    // ── Existing user: reassign to this org/role and notify, regardless of role ──
    if (existingUserId && !existingUserNeverSignedIn) {
      const { error: reassignErr } = await adminClient.from('user_profiles').upsert({
        id: existingUserId,
        email: cleanEmail,
        full_name: fullName,
        org_id,
        role: inviteRole,
        status: 'active',
      }, { onConflict: 'id' })

      if (reassignErr) {
        console.error('invite-volunteer: existing-user profile update failed', reassignErr)
        return res.status(500).json({ error: 'Failed to update existing user profile: ' + reassignErr.message })
      }

      const orgDataForExisting = await fetchOrgData()

      let existingUserEmailSent = true
      try {
        const { error: fnError } = await adminClient.functions.invoke('send-invite-email', {
          body: {
            email: cleanEmail,
            full_name: fullName,
            org_name: orgDataForExisting?.name || 'your organisation',
            org_slug: orgDataForExisting?.slug || org_slug,
            org_color: orgDataForExisting?.primary_color || '#3B82F6',
            org_logo: orgDataForExisting?.email_logo_url || orgDataForExisting?.logo_url || null,
            role: inviteRole,
            existing_user: true, // lets the Edge Function pick an "added to org" template instead of "welcome, set your password"
          }
        })
        if (fnError) throw fnError
      } catch (emailErr) {
        existingUserEmailSent = false
        console.error('invite-volunteer: send-invite-email failed for existing user (non-fatal)', emailErr)
      }

      return res.status(200).json({
        success: true,
        user_id: existingUserId,
        existing_user: true,
        email_sent: existingUserEmailSent,
      })
    }

    // ── New volunteer (or a resend to one who never got in) ──
    // generateLink makes the same secure sign-in link Supabase would email,
    // without sending Supabase's own plain email. The link goes in our one
    // branded email, and lands on /volunteer/accept-invite to choose a
    // password. It used to send both emails, and point both at the portal's
    // sign-in page, where a person with no password could not get in.
    if (inviteRole === 'volunteer' && (!existingUserId || existingUserNeverSignedIn)) {
      const redirectUrl = volunteerAcceptUrl(req.headers.origin, redirect_to)
      const { data: link, error } = await adminClient.auth.admin.generateLink({
        type: existingUserId ? 'magiclink' : 'invite',
        email: cleanEmail,
        options: { redirectTo: redirectUrl, data: { org_id, role: inviteRole, full_name: fullName } },
      })
      const actionLink = link?.properties?.action_link
      if (error || !actionLink || !link?.user?.id) {
        console.error('invite-volunteer: generateLink failed', error)
        return res.status(400).json({ error: error?.message || 'Could not create the invite link' })
      }

      const { error: profileErr } = await adminClient.from('user_profiles').upsert({
        id: link.user.id,
        email: cleanEmail,
        full_name: fullName,
        org_id,
        role: inviteRole,
        status: 'pending_invite',
      }, { onConflict: 'id' })
      if (profileErr) {
        console.error('invite-volunteer: user_profiles upsert failed', profileErr)
        return res.status(500).json({ error: 'Could not save the invite: ' + profileErr.message })
      }

      const orgData = await fetchOrgData()
      const { error: fnError } = await adminClient.functions.invoke('send-invite-email', {
        body: {
          email: cleanEmail,
          full_name: fullName,
          org_name: orgData?.name || 'your organisation',
          org_slug: orgData?.slug || org_slug,
          org_color: orgData?.primary_color || '#3B82F6',
          org_logo: orgData?.email_logo_url || orgData?.logo_url || null,
          role: inviteRole,
          redirect_to: actionLink,
        },
      })
      // This is now the only email, so a failure is the caller's to know about.
      if (fnError) {
        console.error('invite-volunteer: send-invite-email failed', fnError)
        return res.status(502).json({ error: 'The invite is saved but the email did not send. Use Resend in a minute.', user_id: link.user.id })
      }
      return res.status(200).json({ success: true, user_id: link.user.id, email_sent: true, resent: !!existingUserId })
    }

    // ── New staff/admin: create an admin_invites row and send its real token ──
    // CreatePassword.jsx reads ?token= from the URL and looks it up directly in
    // admin_invites — it does NOT use Supabase's built-in invite flow at all, and
    // it creates the auth user itself (via signUp) once the person sets a password.
    // Calling inviteUserByEmail here would pre-create a passwordless auth user and
    // break that signUp step, so we deliberately skip it for this path.
    const { data: adminInvite, error: inviteErr } = await adminClient
      .from('admin_invites')
      .insert({
        org_id,
        email: cleanEmail,
        full_name: fullName,
        role: inviteRole,
      })
      .select()
      .single()

    if (inviteErr) {
      console.error('invite-volunteer: admin_invites insert failed', inviteErr)
      return res.status(500).json({ error: 'Failed to create invite: ' + inviteErr.message })
    }

    const orgData = await fetchOrgData()

    let emailSent = true
    try {
      const { error: fnError } = await adminClient.functions.invoke('send-invite-email', {
        body: {
          email: cleanEmail,
          full_name: fullName,
          org_name: orgData?.name || 'your organisation',
          org_slug: orgData?.slug || org_slug,
          org_color: orgData?.primary_color || '#3B82F6',
          org_logo: orgData?.email_logo_url || orgData?.logo_url || null,
          role: inviteRole,
          token: adminInvite.token, // the real, DB-generated token CreatePassword.jsx will look up
        }
      })
      if (fnError) throw fnError
    } catch (emailErr) {
      emailSent = false
      console.error('invite-volunteer: send-invite-email failed for admin/staff invite (non-fatal)', emailErr)
    }

    return res.status(200).json({ success: true, invite_id: adminInvite.id, email_sent: emailSent })
  } catch (err) {
    // Catch-all: guarantees we ALWAYS return valid JSON, never Vercel's HTML error page
    console.error('invite-volunteer: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
