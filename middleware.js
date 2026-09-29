// Serving the marketing page at the marketing root.
//
// vercel.json rewrites are evaluated AFTER the filesystem, and "/" resolves to
// index.html as a real file in the build output, so a rewrite on "/" never
// runs — the same rule that lets robots.txt and sitemap.xml serve as
// themselves despite the SPA catch-all. Middleware runs before the filesystem,
// which is the only layer that can tell www from app.
//
// The app keeps "/" on app.launchsession.co.uk, and every other path on every
// host is untouched: the matcher below is the bare root only, so /login and
// /signup still reach the React app from any host.
export const config = { matcher: '/' }

const MARKETING_HOSTS = new Set(['launchsession.co.uk', 'www.launchsession.co.uk'])

export default async function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0]
  if (!MARKETING_HOSTS.has(host)) return undefined

  const landing = await fetch(new URL('/landing.html', request.url))
  if (!landing.ok) return undefined   // fall through to the app shell rather than erroring

  return new Response(landing.body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
