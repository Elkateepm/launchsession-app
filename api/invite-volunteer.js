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

    // Use service role to invite
    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    const redirectUrl = redirect_to || (inviteRole === 'volunteer'
      ? `https://app.launchsession.co.uk/volunteer/accept-invite`
      : `https://app.launchsession.co.uk/create-password`)

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: { org_id, role: inviteRole, full_name: name || email.split('@')[0] }
    })

    // If the user already has an account, update their existing profile to this org/role
    // instead of failing outright (single-org-per-user model).
    if (error && error.code === 'email_exists') {
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
          const match = pageData.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())
          if (match) { existingUserId = match.id; break }
          if (pageData.users.length < perPage) break // last page reached, no match
          page += 1
        }
      } catch (lookupErr) {
        console.error('invite-volunteer: existing-user lookup failed', lookupErr)
        return res.status(500).json({ error: 'Failed to look up existing user: ' + lookupErr.message })
      }

      if (!existingUserId) {
        // Shouldn't happen (Supabase just told us the email exists) but guard anyway
        return res.status(400).json({ error: 'User already registered but could not be located' })
      }

      const { error: reassignErr } = await adminClient.from('user_profiles').upsert({
        id: existingUserId,
        email: email.trim().toLowerCase(),
        full_name: name || email.split('@')[0],
        org_id,
        role: inviteRole,
        status: 'active',
      }, { onConflict: 'id' })

      if (reassignErr) {
        console.error('invite-volunteer: existing-user profile update failed', reassignErr)
        return res.status(500).json({ error: 'Failed to update existing user profile: ' + reassignErr.message })
      }

      // Get org details for the notification email (non-fatal if this fails)
      let orgDataForExisting = null
      try {
        const { data: org, error: orgErr } = await adminClient
          .from('organisations')
          .select('name, slug, primary_color, logo_url')
          .eq('id', org_id)
          .single()
        if (orgErr) throw orgErr
        orgDataForExisting = org
      } catch (orgFetchErr) {
        console.error('invite-volunteer: org lookup failed for existing user (non-fatal)', orgFetchErr)
      }

      // Notify the existing user via the same branded email function, added_to_org variant
      let existingUserEmailSent = true
      try {
        const { error: fnError } = await adminClient.functions.invoke('send-invite-email', {
          body: {
            email: email.trim().toLowerCase(),
            full_name: name || email.split('@')[0],
            org_name: orgDataForExisting?.name || 'your organisation',
            org_slug: orgDataForExisting?.slug || org_slug,
            org_color: orgDataForExisting?.primary_color || '#3B82F6',
            org_logo: orgDataForExisting?.logo_url || null,
            role: inviteRole,
            redirect_to: redirectUrl,
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

    if (error) {
      console.error('invite-volunteer: inviteUserByEmail failed', error)
      return res.status(400).json({ error: error.message })
    }

    // Create or update user profile
    const { error: profileErr } = await adminClient.from('user_profiles').upsert({
      id: data.user.id,
      email: email.trim().toLowerCase(),
      full_name: name || email.split('@')[0],
      org_id,
      role: inviteRole,
      status: 'pending_invite',
    }, { onConflict: 'id' })

    if (profileErr) {
      console.error('invite-volunteer: user_profiles upsert failed', profileErr)
      // Invite was already created in auth — don't fail the whole request, but surface it
      return res.status(207).json({
        success: true,
        user_id: data.user.id,
        warning: 'Invite sent but profile record failed to save: ' + profileErr.message,
      })
    }

    // Get org details for the email (non-fatal if this fails)
    let orgData = null
    try {
      const { data: org, error: orgErr } = await adminClient
        .from('organisations')
        .select('name, slug, primary_color, logo_url')
        .eq('id', org_id)
        .single()
      if (orgErr) throw orgErr
      orgData = org
    } catch (orgFetchErr) {
      console.error('invite-volunteer: org lookup failed (non-fatal)', orgFetchErr)
    }

    // Send branded invite email via the send-invite-email Edge Function (non-fatal)
    let emailSent = true
    try {
      const { error: fnError } = await adminClient.functions.invoke('send-invite-email', {
        body: {
          email: email.trim().toLowerCase(),
          full_name: name || email.split('@')[0],
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
  } catch (err) {
    // Catch-all: guarantees we ALWAYS return valid JSON, never Vercel's HTML error page
    console.error('invite-volunteer: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
