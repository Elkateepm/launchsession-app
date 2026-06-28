import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { OrgProvider, useOrg } from './context/OrgContext'
import Login from './components/auth/Login'
import CreatePassword from './components/auth/CreatePassword'
import Signup from './components/auth/Signup'
import OrgLookup from './components/auth/OrgLookup'
import Dashboard from './components/dashboard/Dashboard'
import Onboarding from './components/onboarding/Onboarding'
import VolunteerPortal from './components/volunteers/VolunteerPortal'

function AuthedApp({ session, org }) {
  const [onboardingDone, setOnboardingDone] = React.useState(null)
  const [userRole, setUserRole] = React.useState(null)

  React.useEffect(() => {
    supabase.from('user_profiles')
      .select('onboarding_complete, role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setUserRole(data?.role || null)
        const isOwnerOrAdmin = data?.role === 'owner' || data?.role === 'admin'
        const needsOnboarding = data && !data.onboarding_complete && isOwnerOrAdmin
        setOnboardingDone(!needsOnboarding)
      })
  }, [session.user.id])

  if (onboardingDone === null || userRole === null) return null

  // Volunteers must use the volunteer portal, not the main dashboard
  if (userRole === 'volunteer') {
    const slug = org?.slug || ''
    window.location.replace('/volunteer/' + slug)
    return null
  }

  if (!onboardingDone) return <Onboarding session={session} org={org} onComplete={() => setOnboardingDone(true)} />
  return <Dashboard session={session} org={org} />
}

function AppContent() {
  const pathname = window.location.pathname
  const { org, loading: orgLoading, error: orgError, noOrg } = useOrg()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hasOrg = new URLSearchParams(window.location.search).get('org')
    const isDashboard = window.location.pathname === '/dashboard'
    if (window.location.pathname === '/' && !hasOrg && !isDashboard) {
      window.location.replace('/landing.html')
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (orgLoading || loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A1A', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 44, height: 44, border: '3px solid var(--org-primary, #1B9AAA)', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>LOADING...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (pathname === '/create-password') return <CreatePassword />
  if (window.location.pathname === '/signup') return <Signup />
  if (noOrg) return <OrgLookup />

  if (orgError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A1A', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>🚀</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Organisation Not Found</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{orgError}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>Powered by LaunchSession</div>
    </div>
  )

  return session
    ? <AuthedApp session={session} org={org} />
    : <Login org={org} />
}

export default function App() {
  const pathname = window.location.pathname
  if (pathname.startsWith('/volunteer')) return <VolunteerPortal />
  if (pathname === '/signup') return <Signup />
  if (pathname === '/create-password') return <CreatePassword />
  return (
    <OrgProvider>
      <AppContent />
    </OrgProvider>
  )
}
