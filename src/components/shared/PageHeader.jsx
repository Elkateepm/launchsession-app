import React from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * PageHeader — premium animated header for every module page
 *
 * Props:
 *   icon       — emoji or string
 *   title      — main heading
 *   subtitle   — supporting line
 *   primary    — brand colour
 *   orgName    — org name shown as brand watermark
 *   stats      — array of { label, value, icon, color? }
 *   actions    — array of { label, icon, onClick, variant: 'primary'|'ghost' }
 *   badge      — { text, color? } small pill next to title
 *   gradient   — override gradient string
 */
export default function PageHeader({ icon, title, subtitle, primary = '#1B9AAA', orgName, stats = [], actions = [], badge, gradient }) {
  const isMobile = useIsMobile()
  const grad = gradient || `linear-gradient(135deg, ${primary}18 0%, ${primary}08 60%, transparent 100%)`

  return (
    <div className="ls-page-header" style={{ background: 'var(--surface, #fff)', borderBottom: `2px solid ${primary}18`, padding: '0', position: 'relative', overflow: 'hidden', flexShrink: 0, boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 28px -20px ${primary}45` }}>

      {/* Brand colour strip at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${primary}, ${primary}66, transparent)` }} />

      {/* Background decorations */}
      <div style={{ position: 'absolute', inset: 0, background: grad, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: primary + '0C', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -20, width: 140, height: 140, borderRadius: '50%', background: primary + '06', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '20px 24px 0' }}>
        {/* Top row */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: isMobile ? 12 : 16, marginBottom: stats.length ? 16 : 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            {/* Icon */}
            <div className="ls-page-header-icon" style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${primary}, ${primary}BB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: `0 1px 0 rgba(255,255,255,0.35) inset, 0 -2px 0 rgba(0,0,0,0.1) inset, 0 10px 22px -8px ${primary}55` }}>
              {icon}
            </div>
            {/* Title block */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                <h1 className="ls-header-title" style={{ fontSize: 'clamp(18px, 3vw, 24px)', color: 'var(--text, #111)', margin: 0, lineHeight: 1.1 }}>{title}</h1>
                {badge && (
                  <span className="ls-header-badge" style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: (badge.color || primary) + '18', color: badge.color || primary, textTransform: 'uppercase', letterSpacing: 0.6, border: `1px solid ${(badge.color || primary)}30`, whiteSpace: 'nowrap' }}>
                    {badge.text}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="ls-header-sub" style={{ fontSize: 13, color: 'var(--text3, #6B7280)', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>{subtitle}</p>
              )}
              {orgName && (
                <div style={{ fontSize: 10, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, opacity: 0.8 }}>{orgName}</div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end', width: isMobile ? '100%' : 'auto' }}>
              {actions.map((a, i) => (
                <button key={i} onClick={a.onClick} style={{
                  padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-display, sans-serif)',
                  ...(isMobile ? { flex: '1 1 0', minWidth: 0 } : {}),
                  ...(a.variant === 'ghost'
                    ? { border: `1.5px solid var(--border, #e5e7eb)`, background: 'var(--surface, #fff)', color: 'var(--text, #111)', boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px -2px rgba(15,23,42,0.08)' }
                    : { border: 'none', background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, color: '#fff', boxShadow: `0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.12) inset, 0 8px 20px -8px ${primary}55` }
                  )
                }}>
                  {a.icon && <span>{a.icon}</span>}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats row */}
        {stats.length > 0 && (
          <div style={{ display: 'flex', gap: 0, margin: '0 -24px', borderTop: '1px solid var(--border, #e5e7eb)' }}>
            {stats.map((s, i) => (
              <div key={i} className="ls-stat-card" style={{ flex: 1, padding: '12px 16px', borderRight: i < stats.length - 1 ? '1px solid var(--border, #e5e7eb)' : 'none', minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #9CA3AF)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {s.icon && <span>{s.icon}</span>}{s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color || primary, lineHeight: 1, fontFamily: 'var(--font-display, sans-serif)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
