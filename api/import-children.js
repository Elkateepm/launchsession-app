import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co'
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify caller session
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const anonClient = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })

  // Verify caller belongs to the org they're importing into
  const { data: profile } = await anonClient
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  const { org_id, records } = req.body

  if (!org_id || !records?.length) return res.status(400).json({ error: 'org_id and records required' })
  if (profile?.org_id !== org_id) return res.status(403).json({ error: 'Cannot import into another org' })
  if (!['admin', 'owner', 'staff'].includes(profile?.role)) return res.status(403).json({ error: 'Insufficient permissions' })

  // Use service key to bypass RLS
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data, error } = await adminClient
    .from('children')
    .insert(records.map(r => ({ ...r, org_id })))
    .select('id')

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ inserted: data.length })
}
