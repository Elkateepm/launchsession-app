import React, { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  subscribe, hasDeferredPrompt, promptInstall, isStandalone, isNativeShell, platformOf,
  shouldOffer, readDismissed, rememberDismissed,
} from '../../lib/installPrompt'
import { OrgLogo } from './OrgPageHero'

// The card that gets LaunchSession onto a phone's home screen, so it opens
// full screen like an app instead of inside the browser. See
// lib/installPrompt.js for when it appears and why.

// iOS's own Share glyph, so the instruction matches the button on screen.
function ShareGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const btn = { minHeight: 44, padding: '0 16px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }

export default function InstallAppPrompt({ org, bottom = 'calc(88px + env(safe-area-inset-bottom, 0px))', delayMs = 3500, win = typeof window !== 'undefined' ? window : null }) {
  const reduced = useReducedMotion()
  const [, setTick] = useState(0)
  const [ready, setReady] = useState(delayMs === 0)
  const [closed, setClosed] = useState(false)

  useEffect(() => subscribe(() => setTick(t => t + 1)), [])
  // Not the moment the page appears: let people see where they are first.
  useEffect(() => {
    if (delayMs === 0) return undefined
    const timer = setTimeout(() => setReady(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  const platform = platformOf(win?.navigator?.userAgent || '', win?.navigator?.maxTouchPoints || 0)
  const show = ready && !closed && shouldOffer({
    standalone: isStandalone(win),
    native: isNativeShell(win),
    narrow: (win?.innerWidth || 0) < 768,
    platform,
    hasPrompt: hasDeferredPrompt(),
    dismissedAt: readDismissed(),
  })
  if (!show) return null

  const name = org?.name || 'LaunchSession'
  const dismiss = () => { rememberDismissed(); setClosed(true) }
  const install = async () => {
    const accepted = await promptInstall()
    if (accepted) setClosed(true)
  }

  return (
    <div role="dialog" aria-label={`Open ${name} full screen`}
      style={{
        position: 'fixed', left: 12, right: 12, bottom, zIndex: 900,
        background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 20,
        boxShadow: '0 18px 48px -12px rgba(15,23,42,0.35)', padding: 16,
        animation: reduced ? 'none' : 'lsInstallUp .45s cubic-bezier(.22,1,.36,1) both',
      }}>
      <style>{'@keyframes lsInstallUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}'}</style>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <OrgLogo org={org} height={44} maxWidth={88} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 850, lineHeight: 1.3 }}>Open {name} full screen</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3, lineHeight: 1.45 }}>
            {platform === 'ios-inapp'
              ? 'Open this page in Safari, then add it to your home screen. It opens like an app, with no browser bars.'
              : 'Add it to your home screen. It opens like an app, with no browser bars.'}
          </div>
        </div>
      </div>

      {platform === 'ios' && (
        <ol style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
          {[
            <>Tap <strong style={{ whiteSpace: 'nowrap' }}><ShareGlyph /> Share</strong> in Safari's toolbar</>,
            <>Choose <strong>Add to Home Screen</strong></>,
          ].map((text, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text)', padding: '8px 10px', borderRadius: 12, background: 'var(--surface2)' }}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900, background: 'var(--org-solid, var(--org-primary))', color: 'var(--org-on-solid, #fff)', flexShrink: 0 }}>{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={dismiss} style={{ ...btn, flex: 1, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)' }}>Not now</button>
        {platform === 'android'
          ? <button type="button" onClick={install} style={{ ...btn, flex: 2, border: 'none', background: 'var(--org-solid, var(--org-primary))', color: 'var(--org-on-solid, #fff)' }}>Install</button>
          : <button type="button" onClick={() => setClosed(true)} style={{ ...btn, flex: 1, border: 'none', background: 'var(--org-solid, var(--org-primary))', color: 'var(--org-on-solid, #fff)' }}>Got it</button>}
      </div>
    </div>
  )
}

/**
 * On an installed iPhone app the status bar is drawn over the page
 * ("black-translucent", so the app can use the whole screen), and its clock
 * and battery are white. Over the app's light background they were invisible.
 * A strip in the organisation's dark brand colour sits behind them -- only
 * when installed, and only as tall as the status bar (0 everywhere else).
 */
export function StatusBarStrip({ color, win = typeof window !== 'undefined' ? window : null }) {
  if (!isStandalone(win) || isNativeShell(win)) return null
  return <div aria-hidden="true" data-status-strip style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'env(safe-area-inset-top, 0px)', background: color, zIndex: 10900, pointerEvents: 'none' }} />
}
