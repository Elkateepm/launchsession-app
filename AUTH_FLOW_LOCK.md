# LaunchSession Auth Flow Lock

This workflow must not be changed without intentional review.

Correct user journey:

1. Landing page
2. Sign In button (every one on the website goes to app.launchsession.co.uk/members)
3. Organisation search
4. Email/password login
5. Dashboard
6. Sign out
7. Back to that organisation's sign-in page (/login?org=<slug>), or
   /org-search when no organisation is known

Rules:
- /org-search must always clear any saved organisation.
- /login must only load after an organisation has been selected.
- Sign out must clear the Supabase session. It returns to the organisation's
  own sign-in page rather than the landing page (src/lib/authRedirect.js):
  someone who has just signed out is usually signing back in, and inside the
  Capacitor shell the landing page's Sign in button left the app for Safari.
  The slug travels as an explicit ?org= param; /login still never falls back
  to the saved launchsession_org_slug on its own.
- After signing in on /login the address becomes /dashboard?org=<slug>, so a
  reload or a shared link does not reopen the sign-in screen.
- Do not default users into Solidarity Sports or any other organisation.
- Do not bypass organisation search for existing users.

/members (added 23 Oct 2026) is the dedicated members' sign-in page. It is the
organisation search with sign-in help, and behaves exactly like the app's bare
root: org search, unless the device opted in to "remember this organisation".
/signin, /sign-in and /member redirect to it, and so does /members on the
marketing hosts (vercel.json), so the session stays on the app host. It does
not bypass organisation search and never defaults anyone into an organisation.
