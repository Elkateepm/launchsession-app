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
export default function PageHeader({ icon, iconImg, title, subtitle, primary = '#1B9AAA', orgName, stats = [], actions = [], badge, gradient, illustration }) {
  const isMobile = useIsMobile()
  const grad = gradient || `linear-gradient(135deg, ${primary}18 0%, ${primary}08 60%, transparent 100%)`

  return (
    <div className="ls-page-header" style={{ background: 'var(--surface, #fff)', borderBottom: `2px solid ${primary}18`, padding: '0', position: 'relative', overflow: 'hidden', flexShrink: 0, boxShadow: `0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 28px -20px ${primary}45` }}>

      {/* Brand colour strip at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${primary}, ${primary}66, transparent)` }} />

      {/* Background decorations */}
      <div style={{ position: 'absolute', inset: 0, background: grad, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -70, right: -70, width: 180, height: 180, borderRadius: '50%', background: primary + '08', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -50, left: -30, width: 110, height: 110, borderRadius: '50%', background: primary + '05', pointerEvents: 'none' }} />

      {/* Decorative illustration, top-right — sits behind the title/actions row */}
      {illustration && (
        <img src={illustration} alt="" style={{ position: 'absolute', top: isMobile ? -10 : -16, right: isMobile ? -10 : 4, width: isMobile ? 68 : 96, height: isMobile ? 68 : 96, objectFit: 'contain', pointerEvents: 'none', zIndex: 0, opacity: 0.9 }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '14px 16px 0' : '16px 22px 0' }}>
        {/* Top row */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 14, marginBottom: stats.length ? 12 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {/* Icon */}
            {iconImg ? (
              <img src={iconImg} alt="" className="ls-page-header-icon" style={{ width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0, boxShadow: `0 6px 14px -6px ${primary}55` }} />
            ) : (
              <div className="ls-page-header-icon" style={{ width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: 12, background: `linear-gradient(135deg, ${primary}, ${primary}BB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: `0 1px 0 rgba(255,255,255,0.35) inset, 0 -2px 0 rgba(0,0,0,0.1) inset, 0 6px 14px -6px ${primary}55` }}>
                {icon}
              </div>
            )}
            {/* Title block */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                <h1 className="ls-header-title" style={{ fontSize: 'clamp(15px, 2.4vw, 19px)', color: 'var(--text, #111)', margin: 0, lineHeight: 1.15 }}>{title}</h1>
                {badge && (
                  <span className="ls-header-badge" style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: (badge.color || primary) + '18', color: badge.color || primary, textTransform: 'uppercase', letterSpacing: 0.6, border: `1px solid ${(badge.color || primary)}30`, whiteSpace: 'nowrap' }}>
                    {badge.text}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="ls-header-sub" style={{ fontSize: 12.5, color: 'var(--text3, #6B7280)', margin: 0, fontWeight: 500, lineHeight: 1.35 }}>{subtitle}</p>
              )}
              {orgName && (
                <div style={{ fontSize: 9.5, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 3, opacity: 0.8 }}>{orgName}</div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end', width: isMobile ? '100%' : 'auto' }}>
              {actions.map((a, i) => (
                <button key={i} onClick={a.onClick} style={{
                  padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-display, sans-serif)',
                  ...(isMobile ? { flex: '1 1 0', minWidth: 0 } : {}),
                  ...(a.variant === 'ghost'
                    ? { border: `1.5px solid var(--border, #e5e7eb)`, background: 'var(--surface, #fff)', color: 'var(--text, #111)', boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 6px -2px rgba(15,23,42,0.08)' }
                    : { border: 'none', background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, color: '#fff', boxShadow: `0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.12) inset, 0 6px 16px -8px ${primary}55` }
                  )
                }}>
                  {a.icon && <span>{a.icon}</span>}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats row — individual premium cards instead of a flat divided strip */}
        {stats.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${stats.length}, minmax(0, 1fr))`,
            gap: isMobile ? 7 : 9, marginTop: 2, marginBottom: 14,
          }}>
            {stats.map((s, i) => {
              const c = s.color || primary
              const isLastOdd = isMobile && stats.length % 2 !== 0 && i === stats.length - 1
              return (
                <div key={i} className="ls-stat-card" style={{
                  gridColumn: isLastOdd ? 'span 2' : undefined,
                  display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 9,
                  background: `${c}0C`, border: `1px solid ${c}22`, borderRadius: 12,
                  padding: isMobile ? '8px 10px' : '9px 12px', minWidth: 0,
                  boxShadow: `0 1px 0 rgba(255,255,255,0.5) inset`,
                }}>
                  {s.icon && (
                    <span style={{
                      width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: 8, flexShrink: 0,
                      background: `linear-gradient(135deg, ${c}, ${c}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isMobile ? 12 : 13.5, boxShadow: `0 3px 8px -3px ${c}70, inset 0 1px 0 rgba(255,255,255,0.35)`,
                    }}>{s.icon}</span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 900, color: c, lineHeight: 1, fontFamily: 'var(--font-display, sans-serif)' }}>{s.value}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3, #6B7280)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
