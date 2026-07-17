import React, { useMemo, useState, useRef, useEffect } from 'react'
import { LS, IconGlyph, AnimatedNumber, PurpleProgress } from '../fundraisingShared'
import { useIsMobile } from '../../../hooks/useIsMobile'

const PERIODS = [
  { key: 'year', label: 'This Year' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
]

function raisedForPeriod(donationHistory, period) {
  if (period === 'all') return donationHistory.reduce((s, d) => s + (Number(d.amount) || 0), 0)
  const now = new Date()
  return donationHistory.reduce((s, d) => {
    const dt = new Date(d.created_at)
    if (period === 'year' && dt.getFullYear() === now.getFullYear()) return s + (Number(d.amount) || 0)
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      const dq = Math.floor(dt.getMonth() / 3)
      if (dt.getFullYear() === now.getFullYear() && dq === q) return s + (Number(d.amount) || 0)
    }
    if (period === 'month' && dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()) return s + (Number(d.amount) || 0)
    return s
  }, 0)
}

function TimeFilterDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  const current = PERIODS.find(p => p.key === value)
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
        border: `1.5px solid ${LS.lavenderBorder}`, background: '#fff', color: LS.text, fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
      }}>
        <IconGlyph name="clock" color={LS.muted} size={13} /> {current?.label}
        <span style={{ fontSize: 9, color: LS.muted, marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 10, boxShadow: '0 12px 28px rgba(76,50,200,0.14)', zIndex: 20, minWidth: 140, overflow: 'hidden' }}>
          {PERIODS.map(p => (
            <div key={p.key} onClick={() => { onChange(p.key); setOpen(false) }}
              style={{ padding: '9px 14px', fontSize: 12.5, fontWeight: p.key === value ? 700 : 500, color: p.key === value ? LS.purpleDark : LS.text, cursor: 'pointer', background: p.key === value ? LS.lavender : 'transparent' }}>
              {p.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FundraisingHero({ campaigns, donationHistory, totalTarget, focusItems, onReviewFocus }) {
  const isMobile = useIsMobile()
  const [period, setPeriod] = useState('year')
  const raised = useMemo(() => raisedForPeriod(donationHistory, period), [donationHistory, period])
  const pct = totalTarget > 0 ? Math.min(Math.round((raised / totalTarget) * 100), 100) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr', gap: 16, marginBottom: 20 }}>
      {/* Total raised */}
      <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 20, padding: '24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: LS.muted, fontWeight: 700 }}>Total Raised</div>
          <TimeFilterDropdown value={period} onChange={setPeriod} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 40, lineHeight: 1, fontWeight: 800, color: LS.text, letterSpacing: '-0.01em' }}>
            £<AnimatedNumber value={raised} />
          </div>
          {totalTarget > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: LS.purpleDark }}>{pct}% of annual target</div>}
        </div>

        <div style={{ marginTop: 18 }}>
          {totalTarget > 0 ? (
            <>
              <PurpleProgress raised={raised} target={totalTarget} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12.5, color: LS.muted, flexWrap: 'wrap', gap: 6 }}>
                <span>£{raised.toLocaleString()} raised</span>
                <span>£{Math.max(totalTarget - raised, 0).toLocaleString()} still needed</span>
                <span>£{totalTarget.toLocaleString()} target</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: LS.muted }}>Set a target on a campaign to track progress here.</div>
          )}
        </div>
      </div>

      {/* Today's focus */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '22px 24px',
        background: LS.softGradient, border: `1px solid ${LS.lavenderBorder}`,
      }}>
        <div style={{ position: 'absolute', right: -18, top: -10, opacity: 0.9, pointerEvents: 'none' }}>
          <RocketDoodle />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: LS.text, marginBottom: 14, position: 'relative' }}>Today's Focus</div>

        {focusItems.length === 0 ? (
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: LS.text, marginBottom: 4 }}>Everything is on track ✓</div>
            <div style={{ fontSize: 12.5, color: LS.muted, marginBottom: 16, lineHeight: 1.5 }}>No urgent items right now — a great time to check in on Discover Funding for new opportunities.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, position: 'relative', maxWidth: '78%' }}>
            {focusItems.slice(0, 3).map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, boxShadow: '0 2px 6px rgba(76,50,200,0.15)' }}>
                  <IconGlyph name={f.icon} color={LS.purpleDark} size={12} />
                </div>
                <span style={{ fontSize: 13, color: LS.text, lineHeight: 1.4, fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onReviewFocus} style={{
          position: 'relative', padding: '9px 18px', borderRadius: 10, border: 'none',
          background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          boxShadow: `0 6px 14px ${LS.purple}35`,
        }}>
          {focusItems.length === 0 ? 'View Discover Funding' : 'Review Now'}
        </button>
      </div>
    </div>
  )
}

function RocketDoodle() {
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
      <circle cx="55" cy="55" r="52" fill="#fff" opacity="0.25" />
      <circle cx="30" cy="22" r="2.5" fill="#fff" opacity="0.7" />
      <circle cx="90" cy="35" r="1.8" fill="#fff" opacity="0.6" />
      <circle cx="85" cy="80" r="2.2" fill="#fff" opacity="0.5" />
      <g transform="translate(38 20) rotate(35)">
        <path d="M18 0C24 6 26 16 24 28C22 30 14 30 12 28C10 16 12 6 18 0Z" fill="#fff" opacity="0.95" />
        <circle cx="18" cy="14" r="4" fill="#8B6CFF" />
        <path d="M12 22 L4 30 L10 30 Z" fill="#fff" opacity="0.8" />
        <path d="M24 22 L32 30 L26 30 Z" fill="#fff" opacity="0.8" />
        <path d="M14 28 L18 42 L22 28 Z" fill="#FFD27A" opacity="0.9" />
      </g>
    </svg>
  )
}
