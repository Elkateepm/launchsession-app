import React from 'react'
import Icon from '../../lib/icons'
import SignedImg from '../shared/SignedImg'
import AttentionList from '../hub/AttentionList'
import { useCountUp } from '../hub/HubHomeSections'
import { signOne } from '../../lib/storageUrl'
import { childrenToWatch, fullName, moodOf, recentActivity, relativeDay } from './sgModel'

// The hub's front page: what needs someone, where every open concern sits on
// its way to becoming a case or being closed, which children most need a
// look, and the people and places a safeguarding conversation leads to.

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,26,46,.04), 0 8px 24px -16px rgba(20,26,46,.18)' }
const cardHead = { margin: 0, fontSize: 16, fontWeight: 850, color: 'var(--text)', fontFamily: 'var(--font-display, inherit)' }
const quietBtn = { minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none', boxSizing: 'border-box' }
const rise = (n) => ({ animationDelay: `${80 + n * 70}ms` })

const KIND_ICON = { concern: '🛡️', case: '📁', injury: '🩹', check: '💬' }

// ── From concern to case ────────────────────────────────────────
const STEPS = [
  { key: 'raised', label: 'Lead not told yet', hint: 'Reported, nobody has told the safeguarding lead', colour: '#DC2626', bg: 'var(--danger-bg)', fg: 'var(--danger-text)' },
  { key: 'withLead', label: 'With the lead', hint: 'Open concerns the lead knows about', colour: '#D97706', bg: 'var(--warn-bg)', fg: 'var(--warn-text)' },
  { key: 'cases', label: 'Open cases', hint: 'Concerns that became cases, and cases opened directly', colour: '#7C3AED', bg: 'var(--violet-bg, #EDE9FE)', fg: 'var(--violet-text, #5B21B6)' },
  { key: 'closed', label: 'Closed this month', hint: 'Concerns and cases closed since the 1st', colour: '#16A34A', bg: 'var(--ok-bg)', fg: 'var(--ok-text)' },
]

function FlowStep({ step, value, onClick, index, mobile }) {
  const shown = useCountUp(value, 900)
  return (
    <button type="button" onClick={onClick} className="ls-rise ls-stat" title={step.hint}
      style={{ ...rise(index), position: 'relative', textAlign: 'left', minHeight: 96, padding: mobile ? '12px 12px 12px 14px' : '14px 16px 14px 18px', borderRadius: 16, border: '1px solid var(--border)', background: value && step.key !== 'closed' ? step.bg : 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', overflow: 'hidden', transition: 'transform .18s ease' }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: step.colour }} />
      <span style={{ display: 'block', fontSize: mobile ? 26 : 30, fontWeight: 900, lineHeight: 1, color: value ? step.fg : 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 850, color: 'var(--text)', marginTop: 6 }}>{step.label}</span>
      {!mobile && <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.35 }}>{step.hint}</span>}
    </button>
  )
}

function FlowStrip({ flow, onFlow, mobile }) {
  return (
    <section aria-labelledby="sg-flow-head" style={{ ...card, padding: mobile ? 14 : 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 id="sg-flow-head" style={cardHead}>From concern to case</h2>
        <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>Where every open concern is right now</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : '1fr auto 1fr auto 1fr auto 1fr', gap: mobile ? 8 : 6, alignItems: 'center' }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <FlowStep step={s} value={flow[s.key]} index={i} mobile={mobile} onClick={() => onFlow(s.key)} />
            {!mobile && i < STEPS.length - 1 && <span aria-hidden="true" style={{ color: 'var(--text3)', fontSize: 16 }}><Icon name="→" /></span>}
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

// ── Children to watch ────────────────────────────────────────
function Avatar({ child, size = 40 }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size * .3, background: 'var(--danger-bg)', color: 'var(--danger-text)', display: 'grid', placeItems: 'center', fontSize: size * .4, fontWeight: 900, overflow: 'hidden', flexShrink: 0 }}>
      {child.photo_url ? <SignedImg bucket="gallery" src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (child.first_name?.[0] || '?')}
    </span>
  )
}

export function signalChips(s) {
  if (!s) return []
  const out = []
  if (s.openCases) out.push({ label: s.openCases === 1 ? 'Open case' : `${s.openCases} open cases`, bg: 'var(--violet-bg, #EDE9FE)', fg: 'var(--violet-text, #5B21B6)' })
  if (s.openConcerns) out.push({ label: s.openConcerns === 1 ? 'Open concern' : `${s.openConcerns} open concerns`, bg: 'var(--danger-bg)', fg: 'var(--danger-text)' })
  if (s.lowMoods) out.push({ label: s.lowMoods === 1 ? 'Worried lately' : `Low ${s.lowMoods} times lately`, bg: 'var(--warn-bg)', fg: 'var(--warn-text)' })
  if (s.injuries30) out.push({ label: s.injuries30 === 1 ? 'Injury this month' : `${s.injuries30} injuries this month`, bg: 'var(--warn-bg)', fg: 'var(--warn-text)' })
  return out
}

function ChildrenToWatch({ children, signals, onOpenChild, onSeeAll, mobile }) {
  const watch = childrenToWatch(children, signals, 6)
  return (
    <section aria-labelledby="sg-watch-head" style={{ ...card, padding: mobile ? 14 : 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <h2 id="sg-watch-head" style={cardHead}>Children to keep an eye on</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>Open concerns or cases, low moods and injuries, most first</div>
        </div>
        <button type="button" onClick={onSeeAll} style={{ ...quietBtn, border: 'none', color: 'var(--danger-text)', padding: '0 6px' }}>All children</button>
      </div>
      {watch.length === 0 ? (
        <div style={{ padding: '14px', borderRadius: 14, background: 'var(--ok-bg)', color: 'var(--ok-text)', fontSize: 13.5, fontWeight: 700 }}>
          No child has anything open or worrying on file right now.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {watch.map((ch, i) => (
            <button key={ch.id} type="button" onClick={() => onOpenChild(ch.id)} className="ls-rise ls-row"
              style={{ ...rise(i), display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '8px 10px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'transform .18s ease, border-color .18s ease' }}>
              <Avatar child={ch} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 850, color: 'var(--text)' }}>{fullName(ch)}</span>
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
                  {signalChips(signals[ch.id]).map(c => <span key={c.label} style={{ fontSize: 11.5, fontWeight: 800, color: c.fg, background: c.bg, padding: '2px 8px', borderRadius: 999 }}>{c.label}</span>)}
                </span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 850, color: 'var(--danger-text)', whiteSpace: 'nowrap' }}>Open file <Icon name="→" /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Latest activity ────────────────────────────────────────
function LatestActivity({ data, today, onOpen, mobile }) {
  const items = recentActivity(data, 8)
  return (
    <section aria-labelledby="sg-latest-head" style={{ ...card, padding: mobile ? 14 : 18 }}>
      <h2 id="sg-latest-head" style={{ ...cardHead, marginBottom: 10 }}>Latest</h2>
      {items.length === 0 ? <div style={{ fontSize: 13.5, color: 'var(--text2)' }}>Nothing recorded yet.</div> : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {items.map(e => {
            const mood = e.kind === 'check' ? moodOf(e.mood) : null
            return (
              <li key={e.key}>
                <button type="button" onClick={() => onOpen(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '6px 8px', borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)', color: 'var(--text2)', display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>
                    {mood ? mood.emoji : <Icon name={KIND_ICON[e.kind]} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.child || 'Unnamed'} · {e.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)' }}>{relativeDay(e.at, today)}{e.status ? ` · ${e.status}` : ''}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ── Side column ────────────────────────────────────────
function LeadCard({ org, isAdmin, onNavigate }) {
  const openPolicy = async () => {
    const url = await signOne('safeguarding-docs', org.safeguarding_policy_url, 300)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  return (
    <section aria-labelledby="sg-lead-head" style={{ ...card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #E11D48, #9F1239)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}><Icon name="🛡️" /></span>
        <div style={{ minWidth: 0 }}>
          <h2 id="sg-lead-head" style={{ margin: 0, fontSize: 12, fontWeight: 850, color: 'var(--text2)', letterSpacing: .4, textTransform: 'uppercase' }}>Safeguarding lead</h2>
          <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--text)', overflowWrap: 'anywhere' }}>{org.dsl_name || 'Not set yet'}</div>
        </div>
      </div>
      {org.dsl_name ? (
        <div style={{ display: 'grid', gridTemplateColumns: org.dsl_phone && org.dsl_email ? '1fr 1fr' : '1fr', gap: 8 }}>
          {org.dsl_phone && <a href={`tel:${org.dsl_phone.replace(/\s+/g, '')}`} style={{ ...quietBtn, background: '#B91C1C', color: '#fff', border: 'none' }}><Icon name="📞" /> Call</a>}
          {org.dsl_email && <a href={`mailto:${org.dsl_email}`} style={quietBtn}><Icon name="✉️" /> Email</a>}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
          Everyone needs to know who to tell.{' '}
          {isAdmin ? <button type="button" onClick={() => onNavigate && onNavigate('settings', { section: 'safeguarding' })} style={{ ...quietBtn, marginTop: 8, width: '100%' }}>Set the lead in Settings</button>
            : 'Ask an admin to add them in Settings.'}
        </div>
      )}
      {org.safeguarding_policy_url && (
        <button type="button" onClick={openPolicy} style={{ ...quietBtn, width: '100%', marginTop: 8, justifyContent: 'flex-start' }}><Icon name="📄" /> Read our safeguarding policy</button>
      )}
    </section>
  )
}

const hhmm = (t) => (t ? String(t).slice(0, 5) : '')

function TodayCard({ sessions, access, onNavigate, onReport }) {
  return (
    <section aria-labelledby="sg-today-head" style={{ ...card, padding: 16 }}>
      <h2 id="sg-today-head" style={{ ...cardHead, fontSize: 15, marginBottom: 4 }}>Sessions today</h2>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10 }}>Raise a concern against the session it happened at.</div>
      {sessions.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text2)' }}>No sessions on today.</div> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {sessions.map(s => (
            <div key={s.id} style={{ padding: 10, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{s.title || 'Session'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{[s.start_time && `${hhmm(s.start_time)}${s.end_time ? `–${hhmm(s.end_time)}` : ''}`, s.location].filter(Boolean).join(' · ')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: access.registers ? '1fr 1fr' : '1fr', gap: 6 }}>
                {access.registers && <button type="button" onClick={() => onNavigate && onNavigate('registers', { sessionId: s.id })} style={{ ...quietBtn, fontSize: 13 }}><Icon name="📋" /> Register</button>}
                <button type="button" onClick={() => onReport({ session: s })} style={{ ...quietBtn, fontSize: 13, color: 'var(--danger-text)' }}><Icon name="🛡️" /> Concern</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export const EMERGENCY_NUMBERS = [
  { label: 'Emergency services', number: '999', note: 'A child is in immediate danger' },
  { label: 'NSPCC helpline', number: '0808 800 5000', note: 'Advice on a concern' },
  { label: 'Police, non-emergency', number: '101', note: 'Report something that has happened' },
]

function EmergencyCard({ onEmergency }) {
  return (
    <section aria-labelledby="sg-help-head" style={{ ...card, padding: 16 }}>
      <h2 id="sg-help-head" style={{ ...cardHead, fontSize: 15, marginBottom: 8 }}>Urgent help</h2>
      <div style={{ display: 'grid', gap: 6 }}>
        {EMERGENCY_NUMBERS.map(n => (
          <a key={n.number} href={`tel:${n.number.replace(/\s+/g, '')}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '6px 10px', borderRadius: 12, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            <span aria-hidden="true" style={{ color: 'var(--danger-text)' }}><Icon name="📞" /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 850 }}>{n.label}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text2)' }}>{n.note}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--danger-text)', whiteSpace: 'nowrap' }}>{n.number}</span>
          </a>
        ))}
      </div>
      <button type="button" onClick={onEmergency} style={{ ...quietBtn, width: '100%', marginTop: 8 }}>What to do if a child tells you something</button>
    </section>
  )
}

function ConnectedCard({ access, terms, onNavigate, onTab }) {
  const links = [
    { key: 'injuries', show: true, icon: '🩹', label: 'Accident book', hint: 'Injuries and first aid', go: () => onTab('injuries') },
    { key: 'medical', show: access.medical, icon: '❤️', label: 'Medical alerts', hint: 'Who needs what on site', go: () => onNavigate('medical_alerts') },
    { key: 'risk', show: access.risk, icon: '⚠️', label: 'Risk assessments', hint: 'Hazards for each activity', go: () => onNavigate('risk_assessments') },
    { key: 'people', show: access.people, icon: '👥', label: terms?.People || 'Young people', hint: 'Profiles, contacts, consents', go: () => onNavigate('children') },
    { key: 'registers', show: access.registers, icon: '📋', label: 'Registers', hint: 'Who was where, and when', go: () => onNavigate('registers') },
  ].filter(l => l.show)
  return (
    <section aria-labelledby="sg-links-head" style={{ ...card, padding: 16 }}>
      <h2 id="sg-links-head" style={{ ...cardHead, fontSize: 15, marginBottom: 8 }}>Connected</h2>
      <div style={{ display: 'grid', gap: 4 }}>
        {links.map(l => (
          <button key={l.key} type="button" onClick={l.go}
            style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '4px 8px', borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)', color: 'var(--text2)', display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}><Icon name={l.icon} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 850, color: 'var(--text)' }}>{l.label}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text2)' }}>{l.hint}</span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--text3)' }}><Icon name="→" /></span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function SafeguardingOverview({
  org, data, attention, flow, signals, today, isAdmin, access, terms, mobile, loading,
  onAttention, onFlow, onOpenChild, onOpenActivity, onReport, onEmergency, onNavigate, onTab,
}) {
  const items = attention.map(a => ({ ...a, snoozable: false, onAction: () => onAttention(a) }))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 330px', gap: mobile ? 14 : 18, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: mobile ? 14 : 18, minWidth: 0 }}>
        {/* Not "all caught up" before anything has loaded: on this page that
            would be the most misleading thing it could say. */}
        {loading
          ? <section aria-label="Needs attention" aria-busy="true" style={{ ...card, padding: mobile ? 14 : 18, color: 'var(--text2)', fontSize: 13.5 }}>Checking what needs you…</section>
          : <AttentionList items={items} today={today} storageKey={`ls_sg_attention_${org.id}`} isMobile={mobile} />}
        <FlowStrip flow={flow} onFlow={onFlow} mobile={mobile} />
        <ChildrenToWatch children={data.children} signals={signals} onOpenChild={onOpenChild} onSeeAll={() => onTab('children')} mobile={mobile} />
        <LatestActivity data={data} today={today} onOpen={onOpenActivity} mobile={mobile} />
      </div>
      <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
        <LeadCard org={org} isAdmin={isAdmin} onNavigate={onNavigate} />
        <TodayCard sessions={data.todaySessions} access={access} onNavigate={onNavigate} onReport={onReport} />
        <EmergencyCard onEmergency={onEmergency} />
        <ConnectedCard access={access} terms={terms} onNavigate={onNavigate} onTab={onTab} />
      </div>
    </div>
  )
}

