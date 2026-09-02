import React, { useState, useEffect, useCallback, useRef } from 'react'
import { verifyBiometric } from '../../lib/biometricLock'

// Shown over the whole app when the lock is engaged. Deliberately gives away
// nothing about what's behind it -- no session names, no counts -- since the
// point is that the phone may not be in its owner's hands.
export default function BiometricLockScreen({ org, userName, onUnlocked, onSignOut }) {
  const [status, setStatus] = useState('idle') // idle | prompting | error
  const [message, setMessage] = useState('')
  const primary = org?.primary_color || '#7C3AED'

  const attempt = useCallback(async () => {
    setStatus('prompting')
    setMessage('')
    const res = await verifyBiometric()
    if (res.ok) { onUnlocked(); return }
    setStatus('error')
    setMessage(res.message || 'Could not verify. Try again.')
  }, [onUnlocked])

  // Try once automatically on mount so the common case is: open app, glance,
  // you're in. Guarded with a ref because React 18 StrictMode double-invokes
  // effects in development, and firing two overlapping WebAuthn prompts makes
  // the browser abort the first one.
  const autoTried = useRef(false)
  useEffect(() => {
    if (autoTried.current) return
    autoTried.current = true
    attempt()
  }, [attempt])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      background: 'linear-gradient(165deg, #0B1020 0%, #141A33 60%, #0B1020 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 28, textAlign: 'center', color: '#fff',
    }}>
      <style>{`
        @keyframes ls-lock-pulse { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.06); opacity: 0.85 } }
        @media (prefers-reduced-motion: reduce) { [data-lock-anim] { animation: none !important } }
      `}</style>

      {org?.logo_url ? (
        <img src={org.logo_url} alt="" style={{ width: 62, height: 62, borderRadius: 16, objectFit: 'contain', background: '#fff', padding: 6, boxSizing: 'border-box', marginBottom: 22 }} />
      ) : (
        <div style={{ width: 62, height: 62, borderRadius: 16, marginBottom: 22, background: `linear-gradient(135deg, ${primary}, var(--org-a60))` }} />
      )}

      <div
        data-lock-anim
        style={{
          width: 84, height: 84, borderRadius: '50%', marginBottom: 22,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          animation: status === 'prompting' ? 'ls-lock-pulse 1.6s ease-in-out infinite' : 'none',
        }}>
        {status === 'error' ? '🔒' : '🙂'}
      </div>

      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3, marginBottom: 6 }}>
        {org?.name || 'LaunchSession'} is locked
      </div>
      <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 26, maxWidth: 300, lineHeight: 1.5 }}>
        {status === 'prompting'
          ? 'Waiting for your device to verify you...'
          : message || `Unlock to continue${userName ? ` as ${userName}` : ''}.`}
      </div>

      <button onClick={attempt} disabled={status === 'prompting'}
        style={{
          width: '100%', maxWidth: 300, padding: '14px 20px', borderRadius: 13, border: 'none',
          background: status === 'prompting' ? 'rgba(255,255,255,0.15)' : `linear-gradient(135deg, ${primary}, var(--org-a85))`,
          color: '#fff', fontSize: 15, fontWeight: 800, cursor: status === 'prompting' ? 'default' : 'pointer',
          boxShadow: status === 'prompting' ? 'none' : `0 10px 26px -10px ${primary}`,
        }}>
        {status === 'prompting' ? 'Verifying...' : 'Unlock'}
      </button>

      {/* Always reachable. A failed sensor, a cut finger, or a colleague's
          device must never leave someone stranded with no way into their work. */}
      <button onClick={onSignOut}
        style={{
          marginTop: 14, padding: '11px 18px', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.18)', background: 'transparent',
          color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          width: '100%', maxWidth: 300,
        }}>
        Sign in with password instead
      </button>
    </div>
  )
}
