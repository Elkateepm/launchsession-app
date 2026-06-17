import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { OrgProvider, useOrg } from './context/OrgContext'
import Login from './components/auth/Login'
import CreatePassword from './components/auth/CreatePassword'
import Signup from './components/auth/Signup'
import OrgLookup from './components/auth/OrgLookup'
import Dashboard from './components/dashboard/Dashboard'

function AppContent() {
  const pathname = window.location.pathname
  if (pathname === '/create-password') return <CreatePassword />
  const { org, loading: orgLoading, error: orgError, noOrg } = useOrg()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (window.location.pathname === '/') {
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

  return session ? <Dashboard session={session} org={org} /> : <Login org={org} />
}

export default function App() {
  return (
    <OrgProvider>
      <AppContent />
    </OrgProvider>
  )
}
