import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
export const flowButton = { minHeight: 44, padding: '10px 16px', borderRadius: 10, border: '1px solid #DCE2E9', background: '#fff', color: '#334155', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
export const flowInput = { width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', fontSize: 16, boxSizing: 'border-box' }
// A portal avoids clipping inside the dashboard's animated tab container.
export default function SessionSheet({ title, subtitle, onClose, children, footer, width = 600, busy = false, bodyStyle = {} }) {
  const mobile = useIsMobile(), panel = useRef(null), close = useRef(onClose), busyRef = useRef(busy), titleId = useId()
  close.current = onClose
  busyRef.current = busy
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow, node = panel.current
    document.body.style.overflow = 'hidden'
    node.focus()
    const key = e => {
      if (e.key === 'Escape' && !busyRef.current) { e.preventDefault(); close.current() }
      if (e.key !== 'Tab') return
      const items = [...node.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length)
      const first = items[0], last = items[items.length - 1]
      if (!first) { e.preventDefault(); return }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === node)) { e.preventDefault(); first.focus() }
    }
    node.addEventListener('keydown', key)
    return () => { node.removeEventListener('keydown', key); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(<div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 10800, background: 'rgba(15,23,42,.42)', display: 'flex', justifyContent: 'flex-end' }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()} style={{ width: mobile ? '100%' : width, maxWidth: '100%', height: '100dvh', minWidth: 0, boxSizing: 'border-box', background: '#fff', color: '#0F172A', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 50px #0F172A25', outline: 'none' }}>
      <header style={{ padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', gap: 12 }}><div style={{ minWidth: 0, flex: 1 }}><h2 id={titleId} style={{ fontSize: 20, margin: '4px 0', letterSpacing: '-.4px', overflowWrap: 'anywhere' }}>{title}</h2>{subtitle && <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>{subtitle}</p>}</div><button disabled={busy} aria-label="Close panel" onClick={onClose} style={{ ...flowButton, width: 44, flexShrink: 0, padding: 0, fontSize: 22 }}>×</button></header>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: mobile ? 16 : 24, ...bodyStyle }}>{children}</div>
      {footer && <footer style={{ borderTop: '1px solid #E2E8F0', padding: '14px 20px calc(14px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>{footer}</footer>}
    </section></div>, document.body)
}
