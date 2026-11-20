import React, { useEffect, useState } from 'react'
import Icon from '../../lib/icons'

// "Needs attention" on Home.
//
// It used to be a row of cards that each said a number ("61 reflections to
// write up", "90 HR items to deal with") with an arrow: no word on what to do,
// where to start or how much it mattered, so a long backlog just sat there.
// Each item now says what it is in plain words, how urgent it is, and has one
// button that does the next step. Anything that isn't safety-critical can be
// put aside until tomorrow, so the list shows what someone can act on today.

export const URGENCY = {
  urgent: { label: 'Urgent', rank: 0, bg: 'var(--danger-bg, #FEE2E2)', fg: 'var(--danger-text, #B91C1C)', icon: { bg: '#FFE4E6', fg: '#BE123C' } },
  soon: { label: 'This week', rank: 1, bg: 'var(--warn-bg, #FEF3C7)', fg: 'var(--warn-text, #92400E)', icon: { bg: '#FEF3C7', fg: '#B45309' } },
  later: { label: 'When you can', rank: 2, bg: 'var(--info-bg, #E0F2FE)', fg: 'var(--info-text, #075985)', icon: { bg: '#E0F2FE', fg: '#0369A1' } },
}

/** Most urgent first; the order items were given breaks ties. */
export function sortAttention(items) {
  return items.map((item, i) => ({ item, i }))
    .sort((a, b) => (URGENCY[a.item.urgency]?.rank ?? 9) - (URGENCY[b.item.urgency]?.rank ?? 9) || a.i - b.i)
    .map(x => x.item)
}

/** The one line at the top: how much there is, and whether any of it is urgent. */
export function attentionSummary(items) {
  const urgent = items.filter(i => i.urgency === 'urgent').length
  const rest = items.length - urgent
  if (!items.length) return ''
  if (urgent && rest) return `${urgent} urgent ${urgent === 1 ? 'thing' : 'things'} first, then ${rest} more when you can.`
  if (urgent) return `${urgent} urgent ${urgent === 1 ? 'thing' : 'things'} to deal with.`
  return `Nothing urgent. ${rest} ${rest === 1 ? 'thing' : 'things'} when you have a moment.`
}

function readSnoozed(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} } catch (e) { return {} }
}

export default function AttentionList({ items, today, storageKey, isMobile }) {
  const [snoozed, setSnoozed] = useState(() => readSnoozed(storageKey))
  const [showHidden, setShowHidden] = useState(false)
  useEffect(() => { setSnoozed(readSnoozed(storageKey)) }, [storageKey])

  const isHidden = (item) => item.snoozable !== false && snoozed[item.key] && snoozed[item.key] >= today
  const sorted = sortAttention(items)
  const visible = sorted.filter(i => showHidden || !isHidden(i))
  const hiddenCount = sorted.filter(isHidden).length

  const hide = (key) => {
    // Until the end of today: it comes back tomorrow whatever happens.
    const next = { ...snoozed, [key]: today }
    setSnoozed(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch (e) { /* storage blocked: it stays visible */ }
  }
  const unhideAll = () => {
    setSnoozed({}); setShowHidden(false)
    try { localStorage.removeItem(storageKey) } catch (e) { /* nothing to clear */ }
  }

  const summary = attentionSummary(sorted.filter(i => !isHidden(i)))

  return (
    <section aria-label="Needs attention" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: isMobile ? 14 : 18, boxShadow: '0 1px 2px rgba(20,26,46,.04), 0 8px 24px -14px rgba(20,26,46,.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: visible.length ? 12 : 0 }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 17, color: '#fff', background: sorted.some(i => i.urgency === 'urgent' && !isHidden(i)) ? 'linear-gradient(135deg, #F43F5E, #E11D48)' : 'linear-gradient(135deg, #F59E0B, #F97316)', flexShrink: 0 }}><Icon name="bell" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 850, color: 'var(--text)', fontFamily: 'var(--font-display, inherit)' }}>Needs attention</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{summary || "You're all caught up."}</div>
        </div>
      </div>

      {visible.length === 0 && (
        <div className="ls-rise" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--ok-bg)', border: '1px solid var(--ok-border)', color: 'var(--ok-text)', fontSize: 13, fontWeight: 700 }}>
          <span className="ls-pop" style={{ display: 'inline-flex' }}><Icon name="✅" size={16} /></span>
          {hiddenCount ? 'Nothing else needs you today.' : 'Nothing needs you right now.'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {visible.map((item, i) => {
          const u = URGENCY[item.urgency] || URGENCY.later
          const hidden = isHidden(item)
          return (
            <article key={item.key} className="ls-rise" aria-label={item.title}
              style={{ animationDelay: `${100 + i * 60}ms`, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap', padding: isMobile ? 12 : '12px 14px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', opacity: hidden ? .6 : 1 }}>
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 18, background: u.icon.bg, color: u.icon.fg, flexShrink: 0 }}><Icon name={item.icon} /></span>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 850, color: 'var(--text)' }}>{item.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: u.bg, color: u.fg, whiteSpace: 'nowrap' }}>{u.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3, lineHeight: 1.45 }}>{item.detail}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: isMobile ? '100%' : undefined }}>
                <button type="button" onClick={item.onAction} className="ls-act"
                  style={{ flex: isMobile ? 1 : undefined, minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 850, whiteSpace: 'nowrap',
                    background: item.urgency === 'urgent' ? '#BE123C' : 'var(--org-solid, var(--org-primary))', color: item.urgency === 'urgent' ? '#fff' : 'var(--org-on-solid, #fff)', transition: 'transform .18s ease, box-shadow .18s ease' }}>
                  {item.action} <Icon name="→" />
                </button>
                {item.secondary && <button type="button" onClick={item.secondary.onClick}
                  style={{ minHeight: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 750, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{item.secondary.label}</button>}
                {item.snoozable !== false && !hidden && <button type="button" onClick={() => hide(item.key)} aria-label={`Hide "${item.title}" until tomorrow`} title="Hide until tomorrow"
                  style={{ minWidth: 44, height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 750, fontFamily: 'inherit', flexShrink: 0 }}><Icon name="clock" />Later</button>}
              </div>
            </article>
          )
        })}
      </div>

      {hiddenCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, color: 'var(--text3)' }}>
          <Icon name="clock" />
          <span>{hiddenCount} hidden until tomorrow.</span>
          <button type="button" onClick={() => showHidden ? unhideAll() : setShowHidden(true)} style={{ minHeight: 44, padding: '0 4px', border: 'none', background: 'none', color: 'var(--org-ink)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{showHidden ? 'Bring them back' : 'Show them'}</button>
        </div>
      )}
    </section>
  )
}
