import { createClient } from '@supabase/supabase-js'

// Shown whenever an org hasn't set its own icon/logo (or the org can't be
// resolved) — keeps the manifest valid and installable either way.
const FALLBACK_ICON = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

export default async function handler(req, res) {
  const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY } = process.env
  const slug = (req.query.org || '').toString().trim()

  let name = 'LaunchSession'
  let icon = FALLBACK_ICON
  let themeColor = '#06091A'

  if (slug && REACT_APP_SUPABASE_URL && REACT_APP_SUPABASE_ANON_KEY) {
    try {
      // "organisations" has a public read policy for active/trial orgs, so
      // the anon key is enough here — no service role needed for this.
      const supabase = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
      const { data } = await supabase
        .from('organisations')
        .select('name, icon_url, logo_url, primary_color')
        .eq('slug', slug)
        .in('status', ['active', 'trial'])
        .single()
      if (data) {
        name = data.name || name
        icon = data.icon_url || data.logo_url || FALLBACK_ICON
        themeColor = data.primary_color || themeColor
      }
    } catch (e) {
      // Falls through to the generic LaunchSession defaults above.
    }
  }

  const manifest = {
    short_name: name,
    name,
    icons: [
      { src: icon, sizes: '192x192', type: 'image/png' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    start_url: slug ? `/?org=${encodeURIComponent(slug)}` : '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone', 'minimal-ui', 'browser'],
    theme_color: themeColor,
    background_color: '#06091A',
  }

  res.setHeader('Content-Type', 'application/manifest+json')
  // Short cache so a rebranding shows up on the next reinstall reasonably
  // quickly, without hitting Supabase on every single manifest fetch.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  return res.status(200).json(manifest)
}
