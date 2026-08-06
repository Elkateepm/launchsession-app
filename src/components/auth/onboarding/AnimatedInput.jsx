import React from 'react'
import { useReducedMotion } from './OnboardingLayout'

export default function AnimatedInput({ label, valid, error, inputProps, autoFocus }) {
  const reducedMotion = useReducedMotion()
  const [nudgeKey, setNudgeKey] = React.useState(0)
  const prevErrorRef = React.useRef(error)

  React.useEffect(() => {
    if (error && !prevErrorRef.current) setNudgeKey(k => k + 1)
    prevErrorRef.current = error
  }, [error])

  return (
    <div>
      {label && <label className="ls-input-label" style={{ ...labelStyle, color: error ? '#FCA5A5' : labelStyle.color }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          {...inputProps}
          autoFocus={autoFocus}
          key={reducedMotion ? undefined : nudgeKey}
          className={`ls-input${!reducedMotion && error ? ' ls-input-error' : ''}`}
          style={{ ...inp, paddingRight: valid ? 42 : 16, borderColor: error ? 'rgba(248,113,113,0.6)' : DEFAULT_BORDER }}
        />
        {valid && (
          <span aria-hidden="true" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'rgba(74,222,128,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: reducedMotion ? 'none' : 'ls-check-in 220ms cubic-bezier(0.34,1.56,0.64,1)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </span>
        )}
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 11.5, color: '#FCA5A5', marginTop: 6, animation: reducedMotion ? 'ls-fade-in 150ms ease' : 'ls-label-in 220ms cubic-bezier(0.16,1,0.3,1)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', marginBottom: 7, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }
const DEFAULT_BORDER = 'rgba(255,255,255,0.12)'
const inp = { width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${DEFAULT_BORDER}`, background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, outline: 'none', fontFamily: 'inherit' }
