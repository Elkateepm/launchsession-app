import React, { useState, useRef, useEffect } from 'react'
import OverlayPortal from '../shared/OverlayPortal'
import PublicChildRegistration from './PublicChildRegistration'

// ─── HAND THE PHONE OVER ─────────────────────────────────────
// Staff pass their own phone to a parent, who fills in the same form the
// public registration link opens. It submits through the same function, so
// whatever is entered lands in Registration Requests for approval exactly as
// a link submission would; nothing goes straight onto the roster.
//
// The phone is signed in as staff, and behind this screen is every young
// person's record. So the way out is a press-and-hold, which a parent filling
// in a form will not do by accident, rather than a close button they would
// reasonably tap when they finish.

const HOLD_MS = 1200

function HoldToExit({ onExit }) {
  const [progress, setProgress] = useState(0)
  const frame = useRef(null)
  const started = useRef(null)

  const stop = () => {
    cancelAnimationFrame(frame.current)
    started.current = null
    setProgress(0)
  }
  const tick = () => {
    const p = Math.min(1, (performance.now() - started.current) / HOLD_MS)
    setProgress(p)
    if (p >= 1) { stop(); onExit(); return }
    frame.current = requestAnimationFrame(tick)
  }
  const start = (e) => {
    e.preventDefault()
    started.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return (
    <button
      type="button"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      aria-label="Staff: press and hold to return to the app"
      style={{
        position: 'relative', overflow: 'hidden', minHeight: 36, padding: '0 14px', borderRadius: 99,
        border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.10)', color: '#fff',
        fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none',
      }}>
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: 'rgba(255,255,255,0.28)' }} />
      <span style={{ position: 'relative' }}>{progress > 0 ? 'Keep holding…' : 'Staff: hold to exit'}</span>
    </button>
  )
}

export default function HandoverRegistration({ org, onExit }) {
  // Remounting clears the last family's answers before the next one starts.
  const [round, setRound] = useState(0)

  return (
    <OverlayPortal>
      <div role="dialog" aria-modal="true" aria-label="Register a young person"
        style={{ position: 'fixed', inset: 0, zIndex: 10900, background: 'var(--surface2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: 'calc(8px + env(safe-area-inset-top)) 14px 8px', background: '#0f172a', color: '#fff',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>Filling in for {org.name}</span>
          <HoldToExit onExit={onExit} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <PublicChildRegistration key={round} slug={org.slug} onRegisterAnother={() => setRound(r => r + 1)} />
        </div>
      </div>
    </OverlayPortal>
  )
}
