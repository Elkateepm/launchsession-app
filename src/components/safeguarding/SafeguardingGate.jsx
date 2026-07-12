import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function SafeguardingGate({ org, isAdmin, children }) {
  const [status, setStatus] = useState('checking') // checking | locked | open
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const sessionKey = `sg_unlocked_${org?.id || 'none'}`

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      // Staff only ever see the "raise a concern" screen (no case data), so the
      // access password only needs to gate the full admin dashboard.
      if (!isAdmin) {
        if (!cancelled) setStatus('open')
        return
      }
      if (sessionStorage.getItem(sessionKey) === '1') {
        if (!cancelled) setStatus('open')
        return
      }
      const { data, error } = await supabase.rpc('safeguarding_password_status')
      if (cancelled) return
      if (error) {
        // Fail open rather than accidentally locking everyone out if the RPC isn't reachable
        setStatus('open')
        return
      }
      setStatus(data ? 'locked' : 'open')
    }
    check()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, isAdmin])

  const handleUnlock = async (e) => {
    e.preventDefault()
    setVerifying(true)
    setError('')
    const { data, error } = await supabase.rpc('verify_safeguarding_password', { input_password: pw })
    setVerifying(false)
    if (error || !data) {
      setError('Incorrect password. Please try again.')
      return
    }
    sessionStorage.setItem(sessionKey, '1')
    setStatus('open')
  }

  if (status === 'checking') {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
        Loading Safeguarding...
      </div>
    )
  }

  if (status === 'open') return children

  return (
    <div style={{ maxWidth: 380, margin: '10vh auto', textAlign: 'center', padding: '0 20px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px',
      }}>🔒</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>
        Safeguarding is locked
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--text3)', margin: '0 0 24px', lineHeight: 1.5 }}>
        This area requires an access password set by your organisation's admin. Enter it below to continue.
      </p>
      <form onSubmit={handleUnlock}>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="Access password"
          autoFocus
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
            fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)',
            color: 'var(--text)', marginBottom: 12, textAlign: 'center',
          }}
        />
        {error && (
          <div style={{ color: '#DC2626', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={verifying || !pw}
          style={{
            padding: '11px 28px', borderRadius: 10, border: 'none',
            background: verifying || !pw ? '#9ca3af' : '#DC2626', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: verifying || !pw ? 'default' : 'pointer', width: '100%',
          }}
        >
          {verifying ? 'Checking...' : 'Unlock Safeguarding'}
        </button>
      </form>
    </div>
  )
}
