import React from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'

// ─── OFFICE ──────────────────────────────────────────────────
// One sidebar row holding the desk jobs: HR, payments, resource booking,
// templates and the parent portal. Grouped by when they are used rather than by
// what they are -- an administrator does these between sessions, and none of
// them is opened on a phone during delivery.
//
// A shell, deliberately. Every module behind it keeps the guards it already had
// -- module gating, role restriction, the locked and coming-soon panels -- by
// staying where it was in Dashboard and being handed in as children. Moving
// five guarded routes in here to save a prop would have been five chances to
// get a permission check subtly wrong.
//
// The scroller is here, on the container, because the last hub built this way
// left its children to scroll themselves and none of them did: the case list
// was clipped at the fold for months.

export default function Office({ tabs, subTab, onSelect, children }) {
  const isMobile = useIsMobile()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', gap: 6, padding: isMobile ? '12px 12px 0' : '12px 16px 0',
        flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }} role="tablist" aria-label="Office">
        {tabs.map(t => {
          const active = subTab === t.tab
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(t.tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                padding: '9px 16px', borderRadius: 11, cursor: 'pointer', minHeight: 42,
                fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
                border: `1px solid ${active ? 'var(--org-a40, rgba(109,93,246,0.35))' : 'var(--border)'}`,
                background: active ? 'var(--org-a10)' : 'transparent',
                color: active ? 'var(--org-primary, #6D5DF6)' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              <span aria-hidden="true"><Icon name={t.icon} /></span>
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
