import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { OrgProvider, useOrg } from './context/OrgContext'
import Login from './components/auth/Login'
import CreatePassword from './components/auth/CreatePassword'
import ResetPassword from './components/auth/ResetPassword'
import Signup from './components/auth/Signup'
import OrgLookup from './components/auth/OrgLookup'
import Dashboard from './components/dashboard/Dashboard'
import Onboarding from './components/onboarding/Onboarding'
import VolunteerPortal from './components/volunteers/VolunteerPortal'
import VolunteerAcceptInvite from './components/volunteers/VolunteerAcceptInvite'
import PublicForm from './components/forms/PublicForm'
import SplashScreen from './components/common/SplashScreen'
import { useBreakpoint } from './hooks/useIsMobile'

const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours

// Signs the user out and returns them to the marketing landing page after a
// sustained period with no interaction. Only active while `enabled` (a live
// session) is true AND on desktop widths - mobile/iPad users stay signed in
// until they explicitly log out, since idle timeouts on personal devices
// mostly just cause unwanted logouts (app backgrounded, phone locked, etc.)
// rather than the shared-desktop security case this was built for.
function useIdleLogout(enabled) {
  const timerRef = useRef(null)
  const { isDesktop } = useBreakpoint()
  const active = enabled && isDesktop

  useEffect(() => {
    if (!active) return

    const logout = async () => {
      try { await supabase.auth.signOut() } catch (e) { /* sign out best-effort */ }
      window.location.replace('/landing.html')
    }

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Re-check on tab focus: if the machine was asleep/backgrounded past the
    // timeout, setTimeout may not have fired reliably, so verify elapsed time.
    let lastActivity = Date.now()
    const markActivity = () => { lastActivity = Date.now() }
    events.forEach(e => window.addEventListener(e, markActivity, { passive: true }))
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity >= IDLE_TIMEOUT_MS) logout()
    }
    document.addEventListener('visibilitychange', onVisible)

    reset()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(e => { window.removeEventListener(e, reset); window.removeEventListener(e, markActivity) })
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])
}

function AuthedApp({ session, org, onReady }) {
  const [onboardingDone, setOnboardingDone] = React.useState(null)
  const [userRole, setUserRole] = React.useState(null)

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
  return <Dashboard session={session} org={org} />
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
  if (isStandalonePWA()) return false
  const pathname = window.location.pathname
  const hostname = window.location.hostname
  const hasOrg = new URLSearchParams(window.location.search).get('org')
  const isDashboard = pathname === '/dashboard'
  const isSpecialRoute = ['/login', '/signup', '/create-password', '/org-search', '/reset-password'].includes(pathname) || pathname.startsWith('/volunteer') || pathname.startsWith('/forms/')
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

  if (error) return <OrgLookup />

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

  // Redirect to landing immediately if this looks like a bare/fresh visit.
  if (shouldGoToLanding() && !checkedSession) {
    window.location.replace('/landing.html')
    return null
  }

  // Special routes that bypass the org/session splash entirely.
  if (pathname === '/create-password') return <CreatePassword />
  if (pathname === '/reset-password') return <ResetPassword />
  if (window.location.pathname === '/signup') return <Signup />

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
      {body}
      {!splashGone && <SplashScreen ready={appReady} onExited={() => setSplashGone(true)} />}
    </>
  )
}

export default function App() {
  const pathname = window.location.pathname
  if (pathname === '/volunteer/accept-invite') return <VolunteerAcceptInvite />
  if (pathname.startsWith('/volunteer')) return <VolunteerPortal />
  if (pathname.startsWith('/forms/')) return <PublicForm />
  if (pathname === '/signup') return <Signup />
  if (pathname === '/create-password') return <CreatePassword />
  return (
    <OrgProvider>
      <AppContent />
    </OrgProvider>
  )
}
