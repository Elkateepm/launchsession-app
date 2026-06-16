import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Login({ org }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'LaunchSession'

  const handleLogin = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0A0A1A 0%, #12122A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {org?.logo_url ? (
            <img src={org.logo_url} alt={orgName} style={{ height: 64, objectFit: 'contain', marginBottom: 12 }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 18, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 12px', color: '#fff', fontWeight: 800 }}>{orgName[0]}</div>
          )}
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{orgName}</div>
          {org?.slogan && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{org.slogan}</div>}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Staff and volunteer access</div>
          {error && <div style={{ background: '#FDE8E8', color: '#D0021B', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@organisation.com"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: primary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Powered by LaunchSession</div>
      </div>
    </div>
  )
}
