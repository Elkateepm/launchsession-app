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
      ? `https://app.launchsession.co.uk/volunteer/${org_slug || ''}`
      : `https://app.launchsession.co.uk/create-password`)

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: { org_id, role: inviteRole, full_name: name || email.split('@')[0] }
    })

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
