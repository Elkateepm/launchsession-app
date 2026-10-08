import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../lib/icons'

// Next steps for a new organisation, on Home, for the people who set it up.
// After the welcome tour closed, day-one Home showed four tiles reading 0 and
// nothing about what to do first. Each step ticks itself off from real data,
// and the card goes once every step is done (or someone hides it).
const hiddenKey = orgId => `ls_getting_started_hidden_${orgId}`

export function gettingStartedSteps(org, counts) {
  return [
    org?.branding_enabled && { key: 'brand', done: !!org?.logo_url, icon: '🎨', label: 'Add your logo and colours', hint: 'The whole app, and your emails, follow', tab: 'branding' },
    { key: 'session', done: counts.sessions > 0, icon: '📅', label: 'Plan your first session', hint: 'Its register is ready the moment you save', tab: 'planner', payload: { autoOpenWizard: true } },
    { key: 'people', done: counts.children > 0, icon: '🧒', label: 'Add your young people', hint: 'One at a time, or import a spreadsheet', tab: 'registers' },
    { key: 'team', done: counts.people > 1, icon: '👋', label: 'Invite your team', hint: 'Staff and volunteers, each with the right access', tab: 'team' },
  ].filter(Boolean)
}

export default function GettingStarted({ org, userRole, onNavigate, pad = 16 }) {
  const canSetUp = userRole === 'owner' || userRole === 'admin'
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(hiddenKey(org?.id)) === '1' } catch (e) { return false } })
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    if (!org?.id || !canSetUp || hidden) return
    let cancelled = false
    const count = table => supabase.from(table).select('id', { count: 'exact', head: true }).eq('org_id', org.id)
    Promise.all([count('sessions'), count('children'), count('user_profiles')])
      .then(([s, c, p]) => { if (!cancelled) setCounts({ sessions: s.count || 0, children: c.count || 0, people: p.count || 0 }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [org?.id, canSetUp, hidden])

  if (!canSetUp || hidden || !counts) return null
  const steps = gettingStartedSteps(org, counts)
  const done = steps.filter(s => s.done).length
  if (done === steps.length) return null

  const hide = () => {
    try { localStorage.setItem(hiddenKey(org.id), '1') } catch (e) { /* hide for this visit only */ }
    setHidden(true)
  }

  return (
    <div style={{ padding: `${pad}px ${pad}px 0` }}>
      <section aria-labelledby="ls-getting-started" className="ls-rise" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 18, boxShadow: '0 10px 30px -24px rgba(15,23,42,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <h2 id="ls-getting-started" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display, inherit)' }}>Getting started</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text3)' }}>{done} of {steps.length} done. Each step ticks itself off.</p>
          </div>
          <button onClick={hide} style={{ minHeight: 44, padding: '0 12px', border: 'none', background: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Hide</button>
        </div>
        <div aria-hidden="true" style={{ height: 6, borderRadius: 99, background: 'var(--border-soft, var(--border))', overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${(done / steps.length) * 100}%`, height: '100%', borderRadius: 99, background: 'var(--org-primary)', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
          {steps.map(step => step.done ? (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, padding: '8px 12px', borderRadius: 14, background: 'var(--ok-bg)', color: 'var(--ok-text)' }}>
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--surface)', flexShrink: 0 }}><Icon name="✓" /></span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{step.label} <span style={{ fontWeight: 500 }}>· done</span></span>
            </div>
          ) : (
            <button key={step.key} onClick={() => onNavigate(step.tab, step.payload)} style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, padding: '8px 12px', textAlign: 'left',
              borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 15, background: 'var(--org-a10)', color: 'var(--org-ink)', flexShrink: 0 }}><Icon name={step.icon} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{step.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{step.hint}</span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--org-ink)', fontWeight: 800 }}>→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
