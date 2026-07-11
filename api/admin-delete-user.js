import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = authHeader.replace(/^Bearer\s+/, '').trim()

  // Fail fast and clearly if required env vars are missing (this endpoint was
  // previously reading the wrong env var name — SUPABASE_SERVICE_KEY instead
  // of REACT_APP_SUPABASE_SERVICE_KEY — which silently produced an empty-key
  // client, made every RLS-protected read fail, and surfaced as a confusing
  // "Forbidden: admin role required" error for every admin, every time.)
  const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
  if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_ANON_KEY || !REACT_APP_SUPABASE_SERVICE_KEY) {
    console.error('admin-delete-user: missing required env vars', {
      hasUrl: !!REACT_APP_SUPABASE_URL,
      hasAnonKey: !!REACT_APP_SUPABASE_ANON_KEY,
      hasServiceKey: !!REACT_APP_SUPABASE_SERVICE_KEY,
    })
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' })
  }

  // Verify caller's session using anon client (stateless JWT check, no DB read needed here)
  const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })

  // All subsequent reads use the service-role client, since RLS would block
  // an unauthenticated client from reading user_profiles at all.
  const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

  // Verify caller is admin/owner in their org
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden: admin role required' })
  }

  const { user_id, org_id } = req.body
  if (!user_id || !org_id) return res.status(400).json({ error: 'user_id and org_id required' })

  if (user_id === user.id) {
    return res.status(400).json({ error: "You can't delete your own account from here." })
  }

  // Verify target user belongs to the same org as the caller
  const { data: targetProfile } = await adminClient
    .from('user_profiles')
    .select('org_id')
    .eq('id', user_id)
    .single()

  if (!targetProfile || targetProfile.org_id !== profile.org_id || targetProfile.org_id !== org_id) {
    return res.status(403).json({ error: 'Cannot delete user from another org' })
  }

  // delete_user() fully removes the person: detaches any audit/attribution
  // references (cases, risk assessments, documents keep their history but
  // lose the dangling link), deletes the user_profiles row, then deletes
  // the auth.users row itself.
  const { error } = await adminClient.rpc('delete_user', { user_id })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ success: true })
}
