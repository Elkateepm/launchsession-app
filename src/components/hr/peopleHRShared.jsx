import React, { useEffect, useRef } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

export const HR = {
  ink: '#182238', muted: '#66758B', line: '#E6EAF0', canvas: '#F6F8FB',
  card: { background: '#fff', border: '1px solid #E6EAF0', borderRadius: 18, padding: 22, minWidth: 0 },
  button: { minHeight: 44, padding: '10px 15px', borderRadius: 11, border: '1px solid #E6EAF0', background: '#fff', color: '#35445B', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  input: { minHeight: 44, padding: '11px 13px', borderRadius: 11, border: '1px solid #DDE3EC', background: '#fff', color: '#182238', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' },
}

export function Avatar({ name, primary, size = 42 }) {
  const initials = (name || '?').trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return <span aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, borderRadius: 13, background: 'var(--org-a10, #EEF2F7)', color: primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.32 }}>{initials}</span>
}

export function Badge({ children, tone = HR.muted, bg = '#F1F4F8' }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, color: tone, background: bg, lineHeight: 1.4 }}>{children}</span>
}

export function Empty({ title, detail, action }) {
  return <div style={{ padding: '26px 16px', textAlign: 'center', color: HR.muted }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: HR.ink }}>{title}</div>
    {detail && <p style={{ fontSize: 13, lineHeight: 1.6, margin: '7px 0 12px' }}>{detail}</p>}
    {action}
  </div>
}

export function LoadError({ message = 'These records could not be loaded.', onRetry }) {
  return <div role="alert" style={{ padding: 16, background: '#FFF5F3', border: '1px solid #F6D6D0', borderRadius: 12, color: '#A53327', fontSize: 13, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ flex: 1 }}>{message}</span>
    {onRetry && <button style={HR.button} onClick={onRetry}>Try again</button>}
  </div>
}

export function useDialogFocus(ref, onClose) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const keydown = e => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); return }
      if (e.key !== 'Tab') return
      const items = Array.from(ref.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(n => n.getClientRects().length)
      if (!items.length) { e.preventDefault(); ref.current?.focus(); return }
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keydown)
      previous?.focus?.()
    }
  }, [ref])
}

export function PeopleDialog({ title, onClose, children }) {
  const mobile = useIsMobile()
  const ref = useRef(null)
  useDialogFocus(ref, onClose)
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: '#101A2D80', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: mobile ? 12 : 24 }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ ...HR.card, width: 500, maxWidth: '100%', maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, margin: 0, color: HR.ink }}>{title}</h2>
        <button onClick={onClose} disabled={!onClose} aria-label="Close dialog" style={HR.button}>Close</button>
      </div>
      {children}
    </div>
  </div>
}
