import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzYWhjcWVxcnhhd213dGpwd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDYyNTEsImV4cCI6MjA5MzcyMjI1MX0.HYCzuHe5C1cWoxh7yYUZuLWG0bxvy_9xTE1bmlwJweQ'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzYWhjcWVxcnhhd213dGpwd3ZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE0NjI1MSwiZXhwIjoyMDkzNzIyMjUxfQ.L0KZdc1qK3AtMO0lPSaRN6LpnD_lUy_Zy_9QD8XUd2w'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const anonClient = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })

  const { org_id, records } = req.body
  if (!org_id || !records?.length) return res.status(400).json({ error: 'org_id and records required' })

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data, error } = await adminClient
    .from('children')
    .insert(records.map(r => ({ ...r, org_id })))
    .select('id')

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ inserted: data.length, records: data })
}
