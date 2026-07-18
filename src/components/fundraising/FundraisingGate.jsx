import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { LS, IconGlyph } from './fundraisingShared'

export default function FundraisingGate({ org, session, children }) {
  const [status, setStatus] = useState('checking') // checking | locked | open
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const sessionKey = `fr_unlocked_${org?.id || 'none'}_${session?.user?.id || 'anon'}`

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (sessionStorage.getItem(sessionKey) === '1') {
        if (!cancelled) setStatus('open')
        return
      }
      const { data, error } = await supabase.rpc('fundraising_password_status')
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
  }, [org?.id, session?.user?.id])

  const handleUnlock = async (e) => {
    e.preventDefault()
    setVerifying(true)
    setError('')
    const { data, error } = await supabase.rpc('verify_fundraising_password', { input_password: pw })
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
      <div style={{ padding: 60, textAlign: 'center', color: LS.muted, fontSize: 14 }}>
        Loading Fundraising Hub...
      </div>
    )
  }

  if (status === 'open') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <button
          onClick={handleLock}
          title="Lock Fundraising Hub"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
            borderRadius: 99, border: 'none', background: LS.gradient,
            color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            boxShadow: `0 8px 24px ${LS.purple}40`,
          }}
        >
          <IconGlyph name="target" color="#fff" size={13} /> Lock Fundraising
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
            width: 64, height: 64, borderRadius: 18, background: LS.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            boxShadow: `0 10px 28px ${LS.purple}35`,
          }}>
            <IconGlyph name="coin" color="#fff" size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: LS.text, margin: '0 0 6px' }}>
            Fundraising Hub is locked
          </h2>
          <p style={{ fontSize: 13.5, color: LS.muted, margin: '0 0 24px', lineHeight: 1.5 }}>
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
                width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`,
                fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff',
                color: LS.text, marginBottom: 12, textAlign: 'center',
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
                background: verifying || !pw ? '#C4C1D6' : LS.gradient, color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: verifying || !pw ? 'default' : 'pointer', width: '100%',
                boxShadow: verifying || !pw ? 'none' : `0 6px 16px ${LS.purple}35`,
              }}
            >
              {verifying ? 'Checking...' : 'Unlock Fundraising Hub'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
