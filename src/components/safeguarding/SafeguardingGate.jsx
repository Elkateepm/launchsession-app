import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CauseForConcernForm from './CauseForConcernForm'

export default function SafeguardingGate({ org, session, children }) {
  const [status, setStatus] = useState('checking') // checking | locked | open
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const sessionKey = `sg_unlocked_${org?.id || 'none'}`

  useEffect(() => {
    let cancelled = false
    const check = async () => {
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
  }, [org?.id])

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

  const handleLock = () => {
    sessionStorage.removeItem(sessionKey)
    setStatus('locked')
    setPw('')
    setError('')
  }

  if (status === 'checking') {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
        Loading Safeguarding...
      </div>
    )
  }

  if (status === 'open') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <button
          onClick={handleLock}
          title="Lock Safeguarding"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            borderRadius: 99, border: 'none', background: 'linear-gradient(90deg,#DC2626,#B91C1C)',
            color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(220,38,38,0.35)',
          }}
        >
          🔒 Lock Safeguarding
        </button>
        {children}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ background: 'rgba(220,38,38,0.06)', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(220,38,38,0.15)', textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Have an urgent concern?</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14 }}>
              You don't need the password to report a safeguarding concern. Submit it directly — it goes straight to your DSL.
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#DC2626,#B91C1C)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 18px rgba(220,38,38,0.3)' }}
            >
              🚨 Report a Cause for Concern
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px,96vw)', maxHeight: '92dvh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <CauseForConcernForm
              org={org}
              session={session}
              onClose={() => setShowForm(false)}
              onSubmitted={() => {}}
            />
          </div>
        </>
      )}
    </div>
  )
}
