import React, { useState, useEffect, Suspense, lazy } from 'react'
import { supabase } from './lib/supabase'
import { OrgProvider, useOrg } from './context/OrgContext'
import SplashScreen from './components/common/SplashScreen'
import { useIdleLogout, useMobileInactivityLogout } from './hooks/useAutoLogout'
import { markSignedIn } from './lib/idleClock'
import { isEnrolledFor, isLocked, setLocked, getLockAfterMs, isAppLockPlatform } from './lib/biometricLock'
import BiometricLockScreen from './components/auth/BiometricLockScreen'
import { redirectToSignIn } from './lib/authRedirect'
import { ModuleAccessProvider } from './context/ModuleAccessContext'
import { applyTheme, watchSystemTheme } from './lib/theme'

// Route-level code splitting: each of these becomes its own JS chunk, only
// downloaded when that route is actually visited, instead of all being
// bundled into the single main.js the whole app used to ship upfront.
// Dashboard pulls in Hub (~4000 lines) plus every feature module, so this
// alone keeps the login/signup screens from having to download all of that
// before they can even render.
const Login = lazy(() => import('./components/auth/Login'))
const CreatePassword = lazy(() => import('./components/auth/CreatePassword'))
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'))
const Signup = lazy(() => import('./components/auth/Signup'))
const OrgLookup = lazy(() => import('./components/auth/OrgLookup'))
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
const Onboarding = lazy(() => import('./components/onboarding/Onboarding'))
const VolunteerPortal = lazy(() => import('./components/volunteers/VolunteerPortal'))
const VolunteerAcceptInvite = lazy(() => import('./components/volunteers/VolunteerAcceptInvite'))
const PublicForm = lazy(() => import('./components/forms/PublicForm'))
const PublicDonationPage = lazy(() => import('./components/fundraising/PublicDonationPage'))
const PublicChildRegistration = lazy(() => import('./components/children/PublicChildRegistration'))
const Unsubscribe = lazy(() => import('./components/messaging/Unsubscribe'))
const PublicVolunteerRegistration = lazy(() => import('./components/volunteers/PublicVolunteerRegistration'))
const VerifyVolunteerApplication = lazy(() => import('./components/volunteers/VerifyVolunteerApplication'))

// Minimal fallback shown while a lazy chunk downloads. Kept intentionally
// tiny/inline (no imports) since it needs to render before other chunks
// have loaded.
// index.html has already put the theme on <html> synchronously; this keeps it
// following the machine afterwards, so a laptop flipping to dark at sunset
// does not leave the app light until the next reload.
function useSystemTheme() {
  useEffect(() => {
    applyTheme()
    return watchSystemTheme()
  }, [])
}

function RouteLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A1A' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #1B9AAA', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'ls-route-spin 0.8s linear infinite' }} />
      <style>{`@keyframes ls-route-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


// Biometric app lock. Engages when the app has been backgrounded or unused for
// longer than the configured window, and is lifted by Face ID / fingerprint.
//
// This deliberately reuses the same "persist a timestamp" approach as the
// inactivity logout above, for the same reason: mobile kills the process
// freely, so an in-memory timer would silently stop locking after the first
// time iOS reclaimed the tab.
function useBiometricLock(userId) {
  const [locked, setLockedState] = React.useState(() => isAppLockPlatform() && isEnrolledFor(userId) && isLocked())
  const backgroundedAt = React.useRef(null)

  React.useEffect(() => {
    // Phones and tablets only. On a desktop the lock was firing on every cold
    // start and after three minutes in another window, for a machine that is
    // sitting on a desk behind an OS screen lock -- all of the interruption,
    // almost none of the benefit it was designed for.
    if (!isAppLockPlatform()) {
      // Clear any flag left by the previous behaviour, or this desktop stays
      // stuck behind a lock screen it can no longer be asked to lift.
      if (isLocked()) setLocked(false)
      setLockedState(false)
      return
    }
    if (!isEnrolledFor(userId)) { setLockedState(false); return }

    // Cold start with an enrolment present always locks. We can't know how long
    // the app was closed, and assuming it was brief is the wrong default for
    // an app holding children's data.
    if (!isLocked()) { setLocked(true) }
    setLockedState(true)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        backgroundedAt.current = Date.now()
        return
      }
      const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0
      backgroundedAt.current = null
      if (away >= getLockAfterMs()) { setLocked(true); setLockedState(true) }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [userId])

  const unlock = React.useCallback(() => { setLocked(false); setLockedState(false) }, [])
  return { locked, unlock }
}

// Shown to somebody whose account exists but has not been let in yet. The
// approval decision is made by an admin or manager in the Team tab; until then
// there is nothing here for them to do but wait or leave, so this screen offers
// exactly those two things.
function AwaitingApproval({ org, status, note, email }) {
  const declined = status === 'declined'
  const primary = org?.primary_color || '#1B9AAA'
  return (
    <div style={{
      minHeight: '100dvh', background: '#0A0A1A', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {org?.logo_url
          ? <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface)', borderRadius: 18, padding: '12px 16px',
              boxShadow: '0 10px 30px -18px rgba(0,0,0,0.9)',
              maxWidth: '100%', marginBottom: 20,
            }}>
              <img src={org.logo_url} alt="" style={{ height: 60, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
            </span>
          : <div style={{ fontSize: 44, marginBottom: 16 }}>{declined ? '🔒' : '⏳'}</div>}
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 10 }}>
          {declined ? 'This account was not approved' : 'Waiting for approval'}
        </div>
        <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: note ? 16 : 26 }}>
          {declined
            ? `${org?.name || 'Your organisation'} has declined access for ${email || 'this account'}. If you think that is a mistake, speak to your administrator.`
            : `Your account is set up. An admin or manager at ${org?.name || 'your organisation'} needs to approve it before you can sign in — you will not need to do anything else once they have.`}
        </div>
        {note && (
          <div style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: '12px 14px', marginBottom: 26,
            fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, textAlign: 'left',
          }}>{note}</div>
        )}
        <button
          onClick={async () => {
            try { await supabase.auth.signOut() } catch (e) { /* best effort */ }
            redirectToSignIn()
          }}
          style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none', background: primary,
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Sign out</button>
      </div>
    </div>
  )
}

function AuthedApp({ session, org, onReady }) {
  const [onboardingDone, setOnboardingDone] = React.useState(null)
  const [userRole, setUserRole] = React.useState(null)
  const [approval, setApproval] = React.useState(null)
  const { locked, unlock } = useBiometricLock(session?.user?.id)

  React.useEffect(() => {
    supabase.from('user_profiles')
      .select('onboarding_complete, role, approval_status, approval_note')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) console.warn('user_profiles fetch error:', error.message)

        if (!data) {
          // No profile row — create one so future queries work
          await supabase.from('user_profiles').upsert({
            id: session.user.id,
            email: session.user.email,
            org_id: org?.id || null,
            role: 'admin',
            onboarding_complete: false,
          }, { onConflict: 'id', ignoreDuplicates: true })
        }

        const role = data?.role || 'admin'
        setUserRole(role)
        setApproval({
          status: data?.approval_status || 'approved',
          note: data?.approval_note || null,
        })
        const isOwnerOrAdmin = role === 'owner' || role === 'admin'
        const orgAlreadyOnboarded = org?.onboarding_complete === true
        const needsOnboarding = !orgAlreadyOnboarded && (!data || (!data.onboarding_complete && isOwnerOrAdmin))
        setOnboardingDone(!needsOnboarding)
      })
  }, [session.user.id, session.user.email, org?.id, org?.onboarding_complete])

  React.useEffect(() => {
    if (onboardingDone !== null && userRole !== null && approval !== null && onReady) onReady()
  }, [onboardingDone, userRole, approval, onReady])

  // Gate before anything else renders, including the role redirects below --
  // otherwise a locked device would still bounce a volunteer into their portal.
  if (locked) {
    return (
      <BiometricLockScreen
        org={org}
        userName={session?.user?.email}
        onUnlocked={unlock}
        onSignOut={async () => {
          setLocked(false)
          try { await supabase.auth.signOut() } catch (e) { /* best effort */ }
          redirectToSignIn()
        }}
      />
    )
  }

  if (onboardingDone === null || userRole === null || approval === null) return null

  // Ahead of the role redirects below: an account still waiting on a decision
  // must not be bounced into a portal either.
  if (approval.status === 'pending' || approval.status === 'declined') {
    return (
      <AwaitingApproval
        org={org} status={approval.status} note={approval.note}
        email={session?.user?.email}
      />
    )
  }

  // Volunteers must use the volunteer portal, not the main dashboard
  if (userRole === 'volunteer') {
    const slug = org?.slug || ''
    window.location.replace('/volunteer/' + slug)
    return null
  }

  // Parents get their own dedicated portal (when it exists / module is enabled)
  if (userRole === 'parent') {
    const slug = org?.slug || ''
    window.location.replace('/parent/' + slug)
    return null
  }

  if (!onboardingDone) return <Onboarding session={session} org={org} onComplete={() => setOnboardingDone(true)} />
  return (
    <ModuleAccessProvider userId={session.user.id}>
      <Dashboard session={session} org={org} />
    </ModuleAccessProvider>
  )
}

// True when running as an installed home-screen app (iOS Safari's
// `navigator.standalone`, or the standard `display-mode` media query used
// by Android/desktop PWA installs). iOS ignores the manifest's start_url
// entirely for "Add to Home Screen" - it just bookmarks whatever URL was
// showing at the moment, so an icon can end up bound to the bare marketing
// domain instead of app.*. There's no legitimate case where someone
// installs the icon to browse marketing content, so treat any standalone
// launch as an app entry regardless of which domain/alias it lands on.
function isStandalonePWA() {
  try {
    return window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
  } catch (e) { return false }
}

// Decide up-front, before any rendering, whether this is a bare root visit
// that should go straight to the marketing landing page.
function shouldGoToLanding() {
  // The native shell IS the app. Its hostname is localhost, so the app-subdomain
  // check below never matches and it was redirecting to the marketing landing
  // page -- whose Sign in button is a hardcoded https://app.launchsession.co.uk,
  // which iOS then hands to Safari. The app effectively ejected users into the
  // browser on launch.
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return false
  if (isStandalonePWA()) return false
  const pathname = window.location.pathname
  const hostname = window.location.hostname
  const hasOrg = new URLSearchParams(window.location.search).get('org')
  const isDashboard = pathname === '/dashboard'
  const isSpecialRoute = ['/login', '/signup', '/create-password', '/org-search', '/reset-password'].includes(pathname) || pathname.startsWith('/volunteer') || pathname.startsWith('/forms/') || pathname.startsWith('/pay/') || pathname === '/verify-volunteer' || pathname.startsWith('/register-volunteer/') || pathname.startsWith('/unsubscribe/')
  // The app subdomain is the application itself — never redirect it to the
  // marketing landing page, regardless of path or org context.
  const isAppSubdomain = hostname.startsWith('app.')
  // The bare root path on the marketing domain always shows the landing
  // page first — even for returning visitors with a previously saved org.
  // A saved org only matters once they've actively chosen to go to
  // /dashboard or /login.
  return pathname === '/' && !hasOrg && !isDashboard && !isSpecialRoute && !isAppSubdomain
}

function AutoResolveOrg({ session }) {
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    supabase.from('user_profiles')
      .select('org_id, organisations(slug)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const slug = data?.organisations?.slug
        if (slug) {
          try { localStorage.setItem('launchsession_org_slug', slug) } catch (e) {}
          window.location.replace(window.location.origin + '/dashboard?org=' + slug)
        } else {
          setError(true)
        }
      })
    return () => { cancelled = true }
  }, [session.user.id])

  if (error) return <Suspense fallback={<RouteLoading />}><OrgLookup /></Suspense>

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A1A', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 44, height: 44, border: '3px solid #1B9AAA', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>FINDING YOUR WORKSPACE...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AppContent() {
  const pathname = window.location.pathname
  const { org, loading: orgLoading, error: orgError, noOrg } = useOrg()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkedSession, setCheckedSession] = useState(false)
  const [authedAppReady, setAuthedAppReady] = useState(false)
  const [splashGone, setSplashGone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      setCheckedSession(true)

      // Secondary check once we know for sure there's no session — covers any
      // edge case the synchronous check above might have missed.
      if (!session && shouldGoToLanding()) {
        window.location.replace('/landing.html')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Signing in IS activity, and nothing recorded it.
      //
      // ls_last_activity persists so that reloading does not restart the idle
      // clock -- without that, closing the laptop and reopening the tab next
      // morning meant the timeout never fired. But it survives a tab close,
      // and nothing reset it at sign-in, so both logout hooks read the
      // PREVIOUS visit's clock the moment a new session appeared. Log in more
      // than 8 hours after you last used it -- which on desktop is most
      // mornings -- and the successful login was undone immediately by a stale
      // timestamp, sending you back to sign in a second time. The second
      // attempt stuck only because the forced logout had cleared the key.
      //
      // SIGNED_IN is a real sign-in: supabase-js v2 reports a page load that
      // already had a session as INITIAL_SESSION, so stamping here cannot
      // renew the clock of a session that was merely reloaded. Written before
      // setSession so the hooks' mount check reads this value, not the old one.
      if (event === 'SIGNED_IN') markSignedIn()
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Auto-logout to landing after 2 hours of inactivity while signed in - desktop only.
  useIdleLogout(!!session)
  // Mobile/iPad: stay signed in until manual logout, or 7 days of no use.
  useMobileInactivityLogout(!!session)

  // Redirect to landing immediately if this looks like a bare/fresh visit.
  if (shouldGoToLanding() && !checkedSession) {
    window.location.replace('/landing.html')
    return null
  }

  // Special routes that bypass the org/session splash entirely.
  // /signup and /create-password are deliberately NOT here: App() returns those
  // before AppContent is ever mounted, so a copy at this level is dead code.
  // /reset-password is not handled up there, so it does belong here.
  if (pathname === '/reset-password') return <Suspense fallback={<RouteLoading />}><ResetPassword /></Suspense>

  const baseLoading = orgLoading || loading
  const willShowAuthedApp = !baseLoading && !noOrg && !orgError && session
  const appReady = !baseLoading && (!willShowAuthedApp || authedAppReady)

  let body = null

  if (!baseLoading) {
    if (noOrg && session && checkedSession) {
      body = <AutoResolveOrg session={session} />
    } else if (noOrg) {
      body = <OrgLookup />
    } else if (orgError) {
      body = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A1A', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40 }}>🚀</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Organisation Not Found</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{orgError}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>Powered by LaunchSession</div>
        </div>
      )
    } else if (session) {
      body = <AuthedApp session={session} org={org} onReady={() => setAuthedAppReady(true)} />
    } else {
      body = <Login org={org} />
    }
  }

  return (
    <>
      <Suspense fallback={null}>{body}</Suspense>
      {!splashGone && <SplashScreen ready={appReady} onExited={() => setSplashGone(true)} />}
    </>
  )
}

export default function App() {
  // Before the path branches: every return below is a render of this
  // component, so the hook has to run unconditionally.
  useSystemTheme()
  const pathname = window.location.pathname
  if (pathname === '/volunteer/accept-invite') return <Suspense fallback={<RouteLoading />}><VolunteerAcceptInvite /></Suspense>
  if (pathname.startsWith('/volunteer')) return <Suspense fallback={<RouteLoading />}><VolunteerPortal /></Suspense>
  if (pathname.startsWith('/forms/')) return <Suspense fallback={<RouteLoading />}><PublicForm /></Suspense>
  if (pathname.startsWith('/pay/')) return <Suspense fallback={<RouteLoading />}><PublicDonationPage /></Suspense>
  if (pathname.startsWith('/unsubscribe/')) return <Suspense fallback={<RouteLoading />}><Unsubscribe /></Suspense>
  if (pathname.startsWith('/register-child/')) return <Suspense fallback={<RouteLoading />}><PublicChildRegistration /></Suspense>
  if (pathname.startsWith('/register-volunteer/')) return <Suspense fallback={<RouteLoading />}><PublicVolunteerRegistration /></Suspense>
  if (pathname === '/verify-volunteer') return <Suspense fallback={<RouteLoading />}><VerifyVolunteerApplication /></Suspense>
  if (pathname === '/signup') return <Suspense fallback={<RouteLoading />}><Signup /></Suspense>
  if (pathname === '/create-password') return <Suspense fallback={<RouteLoading />}><CreatePassword /></Suspense>
  return (
    <OrgProvider>
      <AppContent />
    </OrgProvider>
  )
}

