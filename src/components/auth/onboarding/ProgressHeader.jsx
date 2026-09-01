import React from 'react'
import { useReducedMotion } from './OnboardingLayout'
import { DURATION } from './animations'
import Icon from '../../../lib/icons'

export default function ProgressHeader({ stepNumber, totalSteps, title, onBack, showBack, onSaveExit }) {
  const reducedMotion = useReducedMotion()
  const [saveState, setSaveState] = React.useState('idle') // idle | saving | saved

  const handleSaveExit = () => {
    if (!onSaveExit || saveState !== 'idle') return
    setSaveState('saving')
    setTimeout(() => {
      setSaveState('saved')
      setTimeout(onSaveExit, reducedMotion ? 50 : 900)
    }, reducedMotion ? 50 : 350)
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {showBack && (
            <button type="button" onClick={onBack} aria-label="Go back" style={backBtn}><Icon name="←" /></button>
          )}
          {/* Stepping is a client-side swap with no navigation, so a screen
              reader gets no signal that the step changed unless this region
              announces it. */}
          <div style={{ minWidth: 0, overflow: 'hidden' }} aria-live="polite" aria-atomic="true">
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
              Step {stepNumber} of {totalSteps}
            </div>
            {/* Keying on stepNumber remounts this node on every step change,
                retriggering the fade+slide-up keyframe -- a lightweight way
                to animate a label swap without a full transition library. */}
            <div key={stepNumber} style={{
              fontSize: 13.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              animation: reducedMotion ? 'ls-fade-in 150ms ease' : 'ls-label-in 320ms cubic-bezier(0.16,1,0.3,1)',
            }}>
              {title}
            </div>
          </div>
        </div>
        {onSaveExit && (
          <button type="button" onClick={handleSaveExit} className="ls-footlink" style={{ ...saveExitBtn, opacity: saveState === 'saving' ? 0.6 : 1 }}>
            {saveState === 'saved' ? '✓ Saved' : saveState === 'saving' ? 'Saving…' : 'Save & exit'}
          </button>
        )}
      </div>

      <div role="progressbar" aria-valuenow={stepNumber} aria-valuemin={1} aria-valuemax={totalSteps} style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i < stepNumber ? 'linear-gradient(90deg,#3B82F6,#8B5CF6)' : 'rgba(255,255,255,0.1)',
            transition: `background ${reducedMotion ? 50 : DURATION.progress}ms cubic-bezier(0.16,1,0.3,1)`,
          }} />
        ))}
      </div>
    </div>
  )
}

const backBtn = {
  width: 34, height: 34, borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)',
  color: '#fff', fontSize: 15, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'transform 0.15s ease, background 0.15s ease',
}

const saveExitBtn = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
