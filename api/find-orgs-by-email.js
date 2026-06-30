import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email required' })

  const adminClient = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_SERVICE_KEY
  )

  const { data, error } = await adminClient
    .from('user_profiles')
    .select('role, status, organisations(id, name, slug, logo_url, primary_color, status)')
    .eq('email', email.trim().toLowerCase())

  if (error) return res.status(500).json({ error: error.message })

  const orgs = (data || [])
    .filter(row => row.organisations && ['active', 'trial'].includes(row.organisations.status))
    .map(row => ({
      id: row.organisations.id,
      name: row.organisations.name,
      slug: row.organisations.slug,
      logo_url: row.organisations.logo_url,
      primary_color: row.organisations.primary_color,
      role: row.role,
    }))

  return res.status(200).json({ orgs })
}
