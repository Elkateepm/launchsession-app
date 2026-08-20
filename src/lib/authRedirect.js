// Where to send someone after they sign out (or are signed out).
//
// This used to be '/landing.html' everywhere, which is wrong for anyone who
// reached the app through an organisation: it throws away the org context, so
// a member of a workspace has to go and find their organisation again just to
// sign back in. It's worse inside the Capacitor shell, where landing.html's
// "Sign in" button is a hardcoded https://app.launchsession.co.uk — tapping it
// hands the user off to Safari and out of the app entirely.
//
// The slug is carried as an explicit ?org= param rather than left to
// localStorage, because OrgContext deliberately does NOT fall back to
// 'launchsession_org_slug' on /login (see the auth flow lock at the top of
// OrgContext) — only an explicit param or the opt-in "remembered" key gets
// honoured there. Passing it through keeps the sign-in screen branded without
// weakening that rule.
//
// With no slug at all we go to /org-search, not the landing page: someone who
// has just been signed out is trying to get back in, not read marketing copy.
export function orgSignInPath() {
  let slug = null
  try {
    slug = new URLSearchParams(window.location.search).get('org')
      || localStorage.getItem('launchsession_org_slug')
      || localStorage.getItem('launchsession_remembered_org_slug')
  } catch (e) { /* storage or URL unavailable */ }
  return slug ? '/login?org=' + encodeURIComponent(slug) : '/org-search'
}

// replace() rather than assign() so the signed-out session isn't one Back tap
// away from a half-rendered authenticated screen.
export function redirectToSignIn() {
  window.location.replace(orgSignInPath())
}
