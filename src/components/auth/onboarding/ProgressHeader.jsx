import React from 'react'

export default function ProgressHeader({ stepNumber, totalSteps, title, onBack, showBack, onSaveExit }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {showBack && (
            <button type="button" onClick={onBack} aria-label="Go back" style={backBtn}>←</button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
              Step {stepNumber} of {totalSteps}
            </div>
            {title && <div style={{ fontSize: 13.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
          </div>
        </div>
        {onSaveExit && (
          <button type="button" onClick={onSaveExit} style={saveExitBtn}>Save &amp; exit</button>
        )}
      </div>

      <div role="progressbar" aria-valuenow={stepNumber} aria-valuemin={1} aria-valuemax={totalSteps} style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i < stepNumber ? 'linear-gradient(90deg,#3B82F6,#8B5CF6)' : 'rgba(255,255,255,0.1)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
    </div>
  )
}

const backBtn = {
  width: 34, height: 34, borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)',
  color: '#fff', fontSize: 15, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const saveExitBtn = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
