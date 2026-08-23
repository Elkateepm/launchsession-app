import { createClient } from '@supabase/supabase-js'

// Columns a CSV import is allowed to write.
//
// Enforced here rather than trusting the browser, because this route uses the
// service key and therefore bypasses RLS. Without it, `{ ...record }` let a
// caller set any column on the children table -- including `active`,
// `photo_url`, `collection_contacts` and `collection_restricted`, which govern
// who is allowed to collect a child.
const IMPORTABLE = new Set([
  'first_name', 'last_name', 'date_of_birth', 'group_name', 'school',
  'allergies', 'medical_notes', 'sen',
  'has_asthma', 'has_diabetes', 'has_epipen', 'takes_medication',
  'medication_details', 'has_behaviour_plan', 'behaviour_plan_notes',
  'parent_name', 'parent_phone', 'parent_email',
  'emergency_contact_name', 'emergency_contact_phone',
  'travel_consent', 'notes',
])

const BOOLEAN_FIELDS = new Set([
  'has_asthma', 'has_diabetes', 'has_epipen', 'takes_medication',
  'has_behaviour_plan', 'travel_consent',
])

const truthy = (v) => ['yes', 'y', 'true', '1', 'x'].includes(String(v).trim().toLowerCase())

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
  if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server is not configured for imports.' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })

  const { org_id, records } = req.body
  if (!org_id || !records?.length) return res.status(400).json({ error: 'org_id and records required' })
  if (records.length > 2000) return res.status(400).json({ error: 'Too many rows in one import — split the file.' })

  const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

  // Membership check. Previously the route authenticated the caller but never
  // checked they belonged to org_id, so any signed-in user of any organisation
  // could post another org's id and write children into it.
  const { data: profile } = await adminClient
    .from('user_profiles').select('org_id, role, status').eq('id', user.id).single()
  if (!profile || profile.org_id !== org_id) {
    return res.status(403).json({ error: 'You do not have access to this organisation' })
  }
  if (profile.status !== 'active' || !['admin', 'staff'].includes(profile.role)) {
    return res.status(403).json({ error: 'Only active staff or admins can import children' })
  }

  const clean = []
  for (const r of records) {
    const row = { org_id, active: true }
    for (const [k, v] of Object.entries(r || {})) {
      if (!IMPORTABLE.has(k)) continue
      if (v === '' || v === null || v === undefined) continue
      row[k] = BOOLEAN_FIELDS.has(k) ? truthy(v) : String(v).slice(0, 4000)
    }
    if (!row.first_name || !row.last_name) continue
    clean.push(row)
  }
  if (clean.length === 0) return res.status(400).json({ error: 'No rows had both a first and last name.' })

  const { data, error } = await adminClient
    .from('children')
    .upsert(clean, { onConflict: 'org_id,first_name,last_name', ignoreDuplicates: true })
    .select('id')

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ inserted: data?.length || 0, skipped: records.length - clean.length })
}
