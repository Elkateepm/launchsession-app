import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { supabase } from './lib/supabase'
import { OrgProvider, useOrg } from './context/OrgContext'
import SplashScreen from './components/common/SplashScreen'
import { useBreakpoint } from './hooks/useIsMobile'
import { isEnrolledFor, isLocked, setLocked, getLockAfterMs, isAppLockPlatform } from './lib/biometricLock'
import BiometricLockScreen from './components/auth/BiometricLockScreen'
import { redirectToSignIn } from './lib/authRedirect'
import { ModuleAccessProvider } from './context/ModuleAccessContext'

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
function RouteLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A1A' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #1B9AAA', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'ls-route-spin 0.8s linear infinite' }} />
      <style>{`@keyframes ls-route-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000 // 8 hours — a full working day
const MOBILE_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const LAST_ACTIVITY_KEY = 'ls_last_activity'

// Signs the user out and returns them to their organisation's sign-in screen
// after a sustained period with no interaction. Only active while `enabled` (a live
// session) is true AND on desktop widths - mobile/iPad users stay signed in
// until they explicitly log out, since idle timeouts on personal devices
// mostly just cause unwanted logouts (app backgrounded, phone locked, etc.)
// rather than the shared-desktop security case this was built for.
//
// The window is 8 hours of inactivity: long enough to cover a working day
// without re-authenticating, short enough that a machine left unattended
// overnight in a shared office does not stay signed in.
//
// Last activity is persisted rather than held only in memory. A reload used to
// reset the in-memory clock, so closing the laptop and reopening the tab the
// next morning restarted the countdown and the timeout never actually fired —
// which made the desktop session effectively unbounded.
function useIdleLogout(enabled) {
  const timerRef = useRef(null)
  const { isDesktop } = useBreakpoint()
  const active = enabled && isDesktop

  useEffect(() => {
    if (!active) return

    // Guards against the timer and the visibilitychange handler both firing a
    // sign-out, and against repeated attempts while one is in flight.
    let loggingOut = false
    const logout = async () => {
      if (loggingOut) return
      loggingOut = true
      try { await supabase.auth.signOut() } catch (e) { /* sign out best-effort */ }
      try { localStorage.removeItem(LAST_ACTIVITY_KEY) } catch (e) { /* ignore */ }
      redirectToSignIn()
    }

    // The session is shared across tabs, so a background tab reaching its
    // deadline must not sign out a tab that is actively in use. Re-read the
    // shared clock and reschedule rather than acting on this tab's timer alone.
    const expireIfIdle = () => {
      const last = readLast()
      if (!last || Date.now() - last >= IDLE_TIMEOUT_MS) { logout(); return }
      scheduleFrom(last)
    }

    const scheduleFrom = last => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const remaining = Math.max(IDLE_TIMEOUT_MS - (Date.now() - last), 0)
      timerRef.current = setTimeout(expireIfIdle, remaining)
    }

    const readLast = () => {
      try {
        const v = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY), 10)
        return Number.isNaN(v) ? null : v
      } catch (e) { return null }
    }
    const writeLast = () => {
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())) } catch (e) { /* storage unavailable */ }
    }

    // Writing on every mousemove would hammer localStorage, so throttle: the
    // resolution that matters here is minutes, not milliseconds.
    let lastWrite = 0
    const markActivity = () => {
      const now = Date.now()
      if (now - lastWrite > 60 * 1000) { lastWrite = now; writeLast() }
    }

    const reset = () => {
      markActivity()
      scheduleFrom(readLast() || Date.now())
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Re-check on tab focus: if the machine was asleep or backgrounded past the
    // timeout, setTimeout may not have fired reliably, so verify elapsed time.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      expireIfIdle()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Another tab signing out, or recording activity, should be reflected here
    // immediately rather than at this tab's next scheduled wake-up.
    const onStorage = e => {
      if (e.key !== LAST_ACTIVITY_KEY) return
      if (e.newValue === null) return          // another tab logged out; it handles redirect
      const last = parseInt(e.newValue, 10)
      if (!Number.isNaN(last)) scheduleFrom(last)
    }
    window.addEventListener('storage', onStorage)

    // On mount, honour a clock that was already running before this reload
    // instead of starting a fresh 8 hours.
    const existing = readLast()
    if (existing && Date.now() - existing >= IDLE_TIMEOUT_MS) { logout(); return }
    if (!existing) writeLast()
    reset()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(e => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  }, [active])
}

// Mobile/iPad counterpart to useIdleLogout: these users stay signed in
// indefinitely across app opens, backgrounding, and device sleep - EXCEPT
// they're auto-signed-out if the app hasn't been opened/used at all in 7
// days (abandoned installs, lost/stolen devices, staff who've left). In-memory
// timers don't survive a killed app process on mobile, so "last used" is
// persisted to localStorage and checked whenever the app loads or resumes.
function useMobileInactivityLogout(enabled) {
  const { isDesktop } = useBreakpoint()
  const active = enabled && !isDesktop

  useEffect(() => {
    if (!active) return

    let loggingOut = false
    const logout = async () => {
      if (loggingOut) return
      loggingOut = true
      try { await supabase.auth.signOut() } catch (e) { /* sign out best-effort */ }
      try { localStorage.removeItem(LAST_ACTIVITY_KEY) } catch (e) { /* ignore */ }
      redirectToSignIn()
    }

    const markActivity = () => {
      // Never renew a clock that has already been judged stale -- doing so
      // makes an expiring session look freshly active while sign-out is still
      // in flight.
      if (loggingOut) return
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())) } catch (e) { /* storage unavailable */ }
    }

    // Returns true when the session is stale, so callers can stop rather than
    // continuing on to write a new timestamp.
    const checkStale = () => {
      if (loggingOut) return true
      let last = null
      try { last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY), 10) } catch (e) { /* storage unavailable */ }
      if (!last || Number.isNaN(last)) { markActivity(); return false }
      if (Date.now() - last >= MOBILE_INACTIVITY_MS) { logout(); return true }
      return false
    }

    // Check immediately on mount (covers reopening the app after days away)
    // then stamp fresh activity so the 7-day clock restarts from now. The
    // stamp is skipped when the session is already stale, otherwise the write
    // would renew the very clock that just failed the check.
    if (!checkStale()) markActivity()

    const events = ['touchstart', 'mousedown', 'keydown', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, markActivity, { passive: true }))

    // Re-check whenever the app comes back to the foreground, since that's
    // the moment a long-dormant install would otherwise silently stay signed in.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!checkStale()) markActivity()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      events.forEach(e => window.removeEventListener(e, markActivity))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])
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

function AuthedApp({ session, org, onReady }) {
  const [onboardingDone, setOnboardingDone] = React.useState(null)
  const [userRole, setUserRole] = React.useState(null)
  const { locked, unlock } = useBiometricLock(session?.user?.id)

  React.useEffect(() => {
    supabase.from('user_profiles')
      .select('onboarding_complete, role')
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
        const isOwnerOrAdmin = role === 'owner' || role === 'admin'
        const orgAlreadyOnboarded = org?.onboarding_complete === true
        const needsOnboarding = !orgAlreadyOnboarded && (!data || (!data.onboarding_complete && isOwnerOrAdmin))
        setOnboardingDone(!needsOnboarding)
      })
  }, [session.user.id, session.user.email, org?.id, org?.onboarding_complete])

  React.useEffect(() => {
    if (onboardingDone !== null && userRole !== null && onReady) onReady()
  }, [onboardingDone, userRole, onReady])

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

  if (onboardingDone === null || userRole === null) return null

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, newSession) => {
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

