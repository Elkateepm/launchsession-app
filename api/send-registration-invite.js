import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

    const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
    if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_ANON_KEY || !REACT_APP_SUPABASE_SERVICE_KEY) {
      console.error('send-registration-invite: missing required env vars')
      return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' })
    }

    // Verify the calling user is authenticated
    const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

    const { emails, parent_name } = req.body || {}
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Missing emails' })
    }

    const cleanEmails = [...new Set(emails.map(e => String(e).trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))]
    if (cleanEmails.length === 0) return res.status(400).json({ error: 'No valid email addresses provided' })
    if (cleanEmails.length > 50) return res.status(400).json({ error: 'Too many recipients — please send in smaller batches' })

    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    const { data: profile, error: profileErr } = await adminClient.from('user_profiles').select('org_id, full_name').eq('id', user.id).maybeSingle()
    if (profileErr || !profile?.org_id) return res.status(403).json({ error: 'No organisation found for this account' })

    const { data: org, error: orgErr } = await adminClient.from('organisations')
      .select('name, slug, primary_color, secondary_color, logo_url, email_logo_url, email_footer_text, email_sender_name, contact_email')
      .eq('id', profile.org_id).maybeSingle()
    if (orgErr || !org?.slug) return res.status(404).json({ error: 'Organisation not found' })

    const registrationUrl = `https://app.launchsession.co.uk/register-child/${org.slug}`

    const results = await Promise.allSettled(cleanEmails.map(email =>
      adminClient.functions.invoke('send-registration-invite', {
        body: {
          email,
          org_name: org.name,
          org_color: org.primary_color,
          org_color2: org.secondary_color,
          org_logo: org.email_logo_url || org.logo_url,
          org_sender_name: org.email_sender_name,
          org_footer_text: org.email_footer_text,
          org_reply_to: org.contact_email,
          registration_url: registrationUrl,
          sender_name: profile.full_name,
          parent_name: parent_name || null,
        },
      })
    ))

    const failed = []
    results.forEach((r, i) => {
      if (r.status === 'rejected' || r.value?.error) failed.push(cleanEmails[i])
    })

    return res.status(200).json({ success: true, sent: cleanEmails.length - failed.length, failed })
  } catch (err) {
    console.error('send-registration-invite: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
