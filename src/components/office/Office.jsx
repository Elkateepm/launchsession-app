import React from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme'
import { getOfficeBranding } from './officeBranding'
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

export default function Office({ org, tabs, subTab, onSelect, badges = {}, children }) {
  const isMobile = useIsMobile()
  const dark = useIsDarkTheme()
  const brand = getOfficeBranding(org, dark)

  return (
    <div style={{ ...brand.style, flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'radial-gradient(ellipse at 100% 0%, var(--office-glow), transparent 48%), var(--bg)' }}>
      <div style={{
        display: 'flex', gap: 6, padding: isMobile ? '12px' : '14px 24px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }} role="tablist" aria-label="Office">
        {/* Overview first, and it is a real destination rather than a label:
            without it, the only way back out of a module was the sidebar, and
            the sidebar row was already highlighted, so nothing looked
            clickable. */}
        {[{ id: '__overview', label: 'Overview', icon: 'operations', tab: 'office' }, ...tabs].map(t => {
          const active = subTab === t.tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(t.tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                padding: '9px 16px', borderRadius: 11, cursor: 'pointer', minHeight: 44, outlineOffset: -3,
                fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
                border: `1px solid ${active ? 'var(--office-border)' : 'var(--border)'}`,
                background: active ? 'var(--office-tint)' : 'transparent',
                color: active ? 'var(--office-ink)' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              <span aria-hidden="true"><Icon name={t.icon} /></span>
              {t.label}
              {/* Unread form submissions. Moving Forms in here would otherwise
                  have taken its sidebar badge with it, hiding the one thing in
                  Office that arrives on its own. */}
              {t.badgeKey && badges[t.badgeKey] > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 99, padding: '0 5px',
                  background: '#DC2626', color: '#fff', fontSize: 10.5, fontWeight: 900,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{badges[t.badgeKey]}</span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
