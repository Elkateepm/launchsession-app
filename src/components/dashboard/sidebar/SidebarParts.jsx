import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Sidebar primitives. Kept deliberately small: the previous nav repeated the
// same 25-line button ten times, so a change to hover, focus or active styling
// had to be made ten times and usually wasn't.

export function SidebarItem({
  icon, label, active, onClick, badge, primary, collapsed, indent, muted,
  expanded, hasPopup,
}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const highlight = hovered || focused

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-current={active && !hasPopup ? 'page' : undefined}
      aria-haspopup={hasPopup ? 'menu' : undefined}
      aria-expanded={hasPopup ? !!expanded : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '10px 0' : `8px 12px 8px ${indent ? 26 : 12}px`,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 10, border: 'none', fontFamily: 'inherit',
        // 3px indicator on the active row; a transparent one on every other row
        // so nothing shifts horizontally when the active item changes.
        borderLeft: active ? `3px solid ${primary}` : '3px solid transparent',
        background: active
          ? `${primary}1F`
          : highlight ? 'rgba(255,255,255,0.045)' : 'transparent',
        color: active ? '#fff' : highlight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.5)',
        fontSize: 13, fontWeight: active ? 650 : 500,
        marginBottom: 1, cursor: 'pointer', textAlign: 'left',
        outline: focused ? `2px solid ${primary}88` : 'none',
        outlineOffset: -2,
        position: 'relative',
        transition: 'background 180ms ease, color 180ms ease',
      }}
    >
      <span style={{
        fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0,
        opacity: active ? 1 : muted ? 0.7 : 0.9,
        filter: active ? 'none' : 'grayscale(0.25)',
      }}>{icon}</span>

      {!collapsed && (
        <span style={{
          flex: 1, fontSize: 13, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</span>
      )}

      {badge != null && badge !== 0 && (
        <SidebarBadge value={badge} collapsed={collapsed} />
      )}
    </button>
  )
}

// Badges mark things needing action, never totals. A count of how many young
// people exist is not something anyone can act on, and a sidebar full of such
// numbers trains people to ignore the ones that matter.
export function SidebarBadge({ value, tone = 'urgent', collapsed }) {
  const colours = {
    urgent: '#E5484D',
    attention: '#F79009',
    neutral: 'rgba(255,255,255,0.16)',
  }
  const bg = colours[tone] || colours.urgent

  if (collapsed) {
    return (
      <span style={{
        position: 'absolute', top: 6, right: 12,
        width: 7, height: 7, borderRadius: 7, background: bg,
      }} />
    )
  }

  return (
    <span style={{
      background: bg, color: '#fff', borderRadius: 99,
      padding: '1px 7px', fontSize: 10, fontWeight: 800, flexShrink: 0,
      minWidth: 16, textAlign: 'center',
    }}>{typeof value === 'number' && value > 9 ? '9+' : value}</span>
  )
}

export function SidebarSection({ title, children, collapsed }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {title && !collapsed && (
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.1,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
          padding: '0 12px', marginBottom: 6,
        }}>{title}</div>
      )}
      {title && collapsed && (
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 14px 8px' }} />
      )}
      {children}
    </div>
  )
}

export function SidebarCollapsibleGroup({
  label, icon, open, onToggle, children, primary, collapsed, hasActiveChild, items, onSelect, tab,
}) {
  const [hovered, setHovered] = useState(false)
  const [flyout, setFlyout] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!flyout) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setFlyout(false) }
    const onEsc = e => { if (e.key === 'Escape') setFlyout(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [flyout])

  // Collapsed rail has no room for children, so the group opens sideways.
  if (collapsed) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <SidebarItem
          icon={icon}
          label={label}
          active={hasActiveChild}
          collapsed
          primary={primary}
          expanded={flyout}
          hasPopup
          onClick={() => setFlyout(f => !f)}
        />
        <AnimatePresence>
          {flyout && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.16 }}
              style={{
                position: 'absolute', left: '100%', top: 0, marginLeft: 8, zIndex: 30,
                background: '#141B26', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 12, padding: 6, minWidth: 190,
                boxShadow: '0 18px 44px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                padding: '4px 10px 6px',
              }}>{label}</div>
              {items.map(item => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={item.tab === tab}
                  primary={primary}
                  onClick={() => { onSelect(item); setFlyout(false) }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 10, border: 'none',
          borderLeft: '3px solid transparent',
          background: hovered ? 'rgba(255,255,255,0.045)' : 'transparent',
          color: hasActiveChild ? 'rgba(255,255,255,0.9)' : hovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
          fontSize: 13, fontWeight: hasActiveChild ? 650 : 500,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          transition: 'background 180ms ease, color 180ms ease',
        }}
      >
        <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0, filter: 'grayscale(0.25)' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{
          fontSize: 11, color: 'rgba(255,255,255,0.3)',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 180ms ease',
        }}>›</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 2 }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CreateMenu({ actions, onSelect, primary, collapsed }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  if (!actions.length) return null

  return (
    <div ref={ref} style={{ position: 'relative', padding: collapsed ? '10px 8px' : '10px 12px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Create"
        title={collapsed ? 'Create' : undefined}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 7, padding: collapsed ? '9px 0' : '9px 12px', borderRadius: 10,
          border: `1px solid ${primary}55`, background: `${primary}22`,
          color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 180ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${primary}33` }}
        onMouseLeave={e => { e.currentTarget.style.background = `${primary}22` }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
        {!collapsed && <span>Create</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            style={{
              position: 'absolute', top: '100%', left: collapsed ? '100%' : 12, right: collapsed ? 'auto' : 12,
              marginTop: 4, marginLeft: collapsed ? 8 : 0, zIndex: 40,
              background: '#141B26', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12, padding: 6, minWidth: 200,
              boxShadow: '0 18px 44px rgba(0,0,0,0.5)',
            }}
          >
            {actions.map(a => (
              <SidebarItem
                key={a.id}
                icon={a.icon}
                label={a.label}
                primary={primary}
                onClick={() => { onSelect(a); setOpen(false) }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Compact profile control with a popover, replacing the permanent full-width
 * Sign Out button. Sign out moves inside the popover: it is the least frequent
 * action in the sidebar and did not deserve permanent space, but it stays one
 * click from a visible control.
 */
export function ProfileMenu({
  userName, roleLabel, photoUrl, primary, collapsed, items, onSelect,
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', padding: '10px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? userName : undefined}
        title={collapsed ? userName : undefined}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 10, border: 'none',
          background: hovered || open ? 'rgba(255,255,255,0.05)' : 'transparent',
          cursor: 'pointer', fontFamily: 'inherit',
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'background 180ms ease',
        }}
      >
        <span style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: `linear-gradient(135deg, ${primary}99, #6366F199)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#fff',
          border: `1.5px solid ${primary}55`,
        }}>
          {photoUrl
            ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (userName?.[0]?.toUpperCase() || '?')}
        </span>

        {!collapsed && (
          <>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{
                display: 'block', fontSize: 12.5, fontWeight: 700, color: '#f1f5f9',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{userName}</span>
              <span style={{
                display: 'block', fontSize: 10.5, color: 'rgba(255,255,255,0.35)',
                textTransform: 'capitalize',
              }}>{roleLabel}</span>
            </span>
            <span style={{
              fontSize: 12, color: 'rgba(255,255,255,0.25)',
              transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease',
            }}>›</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
            style={{
              position: 'absolute', bottom: '100%', left: collapsed ? '100%' : 10,
              right: collapsed ? 'auto' : 10, marginBottom: 6, marginLeft: collapsed ? 8 : 0,
              zIndex: 40, minWidth: 200,
              background: '#141B26', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12, padding: 6,
              boxShadow: '0 18px 44px rgba(0,0,0,0.5)',
            }}
          >
            {items.map(item => (
              <React.Fragment key={item.id}>
                {item.dividerBefore && (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '5px 8px' }} />
                )}
                <SidebarItem
                  icon={item.icon}
                  label={item.label}
                  primary={item.danger ? '#E5484D' : primary}
                  onClick={() => { onSelect(item); setOpen(false) }}
                />
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
