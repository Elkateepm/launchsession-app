import { createClient } from '@supabase/supabase-js'

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
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

    const { email, name, org_id, org_slug, redirect_to, role } = req.body || {}
    if (!email || !org_id) return res.status(400).json({ error: 'Missing email or org_id' })
    const inviteRole = ['admin', 'staff', 'volunteer'].includes(role) ? role : 'volunteer'
    const cleanEmail = email.trim().toLowerCase()
    const fullName = name || email.split('@')[0]

    // Use service role for all admin operations
    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    // ── Check for an existing account up front. This applies the same way ──
    // regardless of which invite path (volunteer vs staff/admin) we take below.
    let existingUserId = null
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
        if (match) { existingUserId = match.id; break }
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
          .select('name, slug, primary_color, logo_url')
          .eq('id', org_id)
          .single()
        if (orgErr) throw orgErr
        return org
      } catch (orgFetchErr) {
        console.error('invite-volunteer: org lookup failed (non-fatal)', orgFetchErr)
        return null
      }
    }

    // ── Existing user: reassign to this org/role and notify, regardless of role ──
    if (existingUserId) {
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
            org_logo: orgDataForExisting?.logo_url || null,
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

    // ── New volunteer: use Supabase's native invite flow (unchanged) ──
    // This redirects to /volunteer/accept-invite, which is built to handle
    // Supabase Auth's own invite link format.
    if (inviteRole === 'volunteer') {
      const redirectUrl = redirect_to || `https://app.launchsession.co.uk/volunteer/accept-invite`

      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectUrl,
        data: { org_id, role: inviteRole, full_name: fullName }
      })

      if (error) {
        console.error('invite-volunteer: inviteUserByEmail failed', error)
        return res.status(400).json({ error: error.message })
      }

      const { error: profileErr } = await adminClient.from('user_profiles').upsert({
        id: data.user.id,
        email: cleanEmail,
        full_name: fullName,
        org_id,
        role: inviteRole,
        status: 'pending_invite',
      }, { onConflict: 'id' })

      if (profileErr) {
        console.error('invite-volunteer: user_profiles upsert failed', profileErr)
        return res.status(207).json({
          success: true,
          user_id: data.user.id,
          warning: 'Invite sent but profile record failed to save: ' + profileErr.message,
        })
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
            org_logo: orgData?.logo_url || null,
            role: inviteRole,
            redirect_to: redirectUrl,
          }
        })
        if (fnError) throw fnError
      } catch (emailErr) {
        emailSent = false
        console.error('invite-volunteer: send-invite-email failed (non-fatal)', emailErr)
      }

      return res.status(200).json({ success: true, user_id: data.user.id, email_sent: emailSent })
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
          org_logo: orgData?.logo_url || null,
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
