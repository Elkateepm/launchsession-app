import { createClient } from '@supabase/supabase-js'

// Handles the edge case where signUp fails with "already registered" during
// invite acceptance — a stray auth.users row exists (e.g. left over from an
// earlier invite attempt) but was never actually activated with a real
// password. Rather than leaving the person stuck ("Account exists. Try
// signing in directly." with no password they actually know), this verifies
// their invite token server-side and force-sets the password on that account
// using the service role key, which the client can never do on its own.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
    if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_SERVICE_KEY) {
      console.error('complete-invite-account: missing required env vars')
      return res.status(500).json({ error: 'Server misconfiguration' })
    }

    const { email, password, invite_token } = req.body || {}
    if (!email || !password || !invite_token) return res.status(400).json({ error: 'Missing required fields' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
    const cleanEmail = email.trim().toLowerCase()

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    // The invite token is the only "credential" here (the person has no
    // session yet) — verify it's real and matches this email before touching
    // any account, same trust model CreatePassword.jsx already relies on.
    const { data: invite, error: inviteErr } = await adminClient
      .from('admin_invites')
      .select('*')
      .eq('token', invite_token)
      .eq('email', cleanEmail)
      .maybeSingle()
    if (inviteErr || !invite) return res.status(400).json({ error: 'Invalid or expired invite' })

    let matchedUser = null
    let page = 1
    const perPage = 200
    while (!matchedUser) {
      const { data: pageData, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage })
      if (listErr) return res.status(500).json({ error: listErr.message })
      matchedUser = pageData.users.find(u => u.email?.toLowerCase() === cleanEmail)
      if (matchedUser) break
      if (pageData.users.length < perPage) break
      page += 1
    }
    if (!matchedUser) return res.status(404).json({ error: 'No account found for this email' })

    // An invite token is NOT proof of mailbox ownership, so it must never be
    // able to overwrite the password of an account someone is already using.
    //
    // Live chain this closes: signup is anonymous and hands the caller an
    // admin_invite_token for whatever email they type. Submitting a victim's
    // address produced a valid token, and this endpoint then reset that
    // victim's password and moved their profile into the attacker's new org.
    //
    // The stray-row case this endpoint exists for is narrow and identifiable:
    // an auth.users row created by an earlier invite attempt that was never
    // activated. Such a row has never been signed into and owns no profile.
    // Anything else is a real account and must go through Supabase's
    // mailbox-controlled recovery flow instead.
    if (matchedUser.last_sign_in_at) {
      return res.status(409).json({
        error: 'An account already exists for this email. Please sign in, or use "Forgot password" to reset it.',
      })
    }

    const { data: existingProfile } = await adminClient
      .from('user_profiles').select('id, org_id').eq('id', matchedUser.id).maybeSingle()

    // A profile in a different organisation means this is an established user
    // being pulled across tenants -- refuse regardless of sign-in history.
    if (existingProfile && existingProfile.org_id && existingProfile.org_id !== invite.org_id) {
      console.warn('complete-invite-account: refused cross-org claim for', matchedUser.id)
      return res.status(409).json({
        error: 'An account already exists for this email. Please sign in, or use "Forgot password" to reset it.',
      })
    }

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(matchedUser.id, { password })
    if (updateErr) return res.status(500).json({ error: updateErr.message })

    await adminClient.from('user_profiles').upsert({
      id: matchedUser.id, org_id: invite.org_id, email: cleanEmail,
      full_name: invite.full_name, role: invite.role || 'admin',
    }, { onConflict: 'id' })

    await adminClient.from('admin_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id)

    return res.status(200).json({ success: true, user_id: matchedUser.id })
  } catch (err) {
    console.error('complete-invite-account: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
