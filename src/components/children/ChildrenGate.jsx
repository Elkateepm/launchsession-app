import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ChildrenGate({ org, session, children }) {
  const [status, setStatus] = useState('checking') // checking | locked | open
  // Tracks whether the org has actually configured a password, independent of
  // `status` -- 'open' can mean "unlocked with a real password" or "no
  // password required at all", and only the former should offer a Lock button.
  const [hasPassword, setHasPassword] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const sessionKey = `ch_unlocked_${org?.id || 'none'}_${session?.user?.id || 'anon'}`

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { data, error } = await supabase.rpc('children_password_status')
      if (cancelled) return
      if (error) {
        // Fail open rather than accidentally locking everyone out if the RPC isn't reachable
        setHasPassword(false)
        setStatus('open')
        return
      }
      setHasPassword(!!data)
      if (!data) {
        setStatus('open')
        return
      }
      setStatus(sessionStorage.getItem(sessionKey) === '1' ? 'open' : 'locked')
    }
    check()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, session?.user?.id])

  const handleUnlock = async (e) => {
    e.preventDefault()
    setVerifying(true)
    setError('')
    const { data, error } = await supabase.rpc('verify_children_password', { input_password: pw })
    setVerifying(false)
    if (error || !data) {
      setError('Incorrect password. Please try again.')
      return
    }
    sessionStorage.setItem(sessionKey, '1')
    setStatus('open')
  }

  const handleLock = () => {
    sessionStorage.removeItem(sessionKey)
    setStatus('locked')
    setPw('')
    setError('')
  }

  if (status === 'checking') {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
        Loading Children...
      </div>
    )
  }

  if (status === 'open') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {hasPassword && (
          <button
            onClick={handleLock}
            title="Lock Children"
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 50,
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
              borderRadius: 99, border: 'none', background: 'linear-gradient(90deg,#2563EB,#1D4ED8)',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
            }}
          >
            🔒 Lock Children
          </button>
        )}
        {children}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px',
          }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>
            Children is locked
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
                background: verifying || !pw ? '#9ca3af' : '#2563EB', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: verifying || !pw ? 'default' : 'pointer', width: '100%',
              }}
            >
              {verifying ? 'Checking...' : 'Unlock Children'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
