import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify the request comes from an authenticated admin
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')

  // Verify caller's session using anon client
  const anonClient = createClient(
    process.env.REACT_APP_SUPABASE_URL || 'https://ssahcqeqrxawmwtjpwvh.supabase.co',
    process.env.REACT_APP_SUPABASE_ANON_KEY || ''
  )
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })

  // Verify caller is admin/owner in their org
  const { data: profile } = await anonClient
    .from('user_profiles')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden: admin role required' })
  }

  const { user_id, org_id } = req.body
  if (!user_id || !org_id) return res.status(400).json({ error: 'user_id and org_id required' })

  // Verify target user belongs to same org
  const { data: targetProfile } = await anonClient
    .from('user_profiles')
    .select('org_id')
    .eq('id', user_id)
    .single()

  if (!targetProfile || targetProfile.org_id !== profile.org_id) {
    return res.status(403).json({ error: 'Cannot delete user from another org' })
  }

  // Now use service key to delete
  const adminClient = createClient(
    process.env.REACT_APP_SUPABASE_URL || 'https://ssahcqeqrxawmwtjpwvh.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || ''
  )

  const { error } = await adminClient.rpc('delete_user', { user_id })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ success: true })
}
