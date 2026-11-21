import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import SessionSheet, { flowButton } from '../sessions/SessionSheet'
import SignedImg from '../shared/SignedImg'
import Icon from '../../lib/icons'
import { ageFrom, childChronology, childFlags, chronologyText, formatDay, fullName, moodOf, relativeDay } from './sgModel'
import { SG_RED } from './ConcernSheet'

// A child's safeguarding file: everything the hub knows about one child, in
// date order. Statutory guidance expects a chronology per child, and before
// this the pieces lived on four tabs -- the concern list, Case Management, the
// accident book and the wellbeing check-ins -- with no single place to read
// them together or hand them to a social worker.

const KIND = {
  concern: { label: 'Concerns', icon: '🛡️', dot: '#DC2626' },
  case:    { label: 'Cases', icon: '📁', dot: '#7C3AED' },
  injury:  { label: 'Injuries', icon: '🩹', dot: '#D97706' },
  check:   { label: 'Check-ins', icon: '💬', dot: '#2563EB' },
}
const TONE = {
  danger: ['var(--danger-bg)', 'var(--danger-text)'],
  warn: ['var(--warn-bg)', 'var(--warn-text)'],
  info: ['var(--info-bg)', 'var(--info-text)'],
  ok: ['var(--ok-bg)', 'var(--ok-text)'],
}
const MEDICAL = ['epipen', 'allergies', 'asthma', 'diabetes', 'medication']
const sectionHead = { fontSize: 12, fontWeight: 850, color: 'var(--text2)', letterSpacing: .4, textTransform: 'uppercase', margin: '0 0 10px' }

function Tile({ value, label, tone }) {
  const [bg, fg] = TONE[tone] || ['var(--surface2)', 'var(--text)']
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: fg, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 750, color: fg, marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function ChildFileSheet({
  child, data, signal, orgId, today, access = {},
  onClose, onReport, onCheckIn, onOpenConcern, onOpenCase, onOpenInjuries, onOpenProfile, onOpenMedical, onOpenRegister,
}) {
  const mobile = useIsMobile()
  const [kind, setKind] = useState('all')
  const [copied, setCopied] = useState('')
  const [seen, setSeen] = useState(null)

  // When the child was last at a session. Read on opening rather than with the
  // hub: it is one child's attendance, not everyone's.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: att } = await supabase.from('attendance').select('session_id, status, created_at')
        .eq('org_id', orgId).eq('child_id', child.id).order('created_at', { ascending: false }).limit(60)
      const present = (att || []).filter(a => a.status === 'signed_in' || a.status === 'signed_out')
      if (!present.length) { if (!cancelled) setSeen({ last: null, recent: 0 }); return }
      const { data: sess } = await supabase.from('sessions').select('id, title, session_date').in('id', [...new Set(present.map(a => a.session_id))])
      if (cancelled) return
      const byId = Object.fromEntries((sess || []).map(s => [s.id, s]))
      const dated = present.map(a => ({ ...a, session: byId[a.session_id] })).filter(a => a.session)
        .sort((a, b) => String(b.session.session_date).localeCompare(String(a.session.session_date)))
      const since = new Date(Date.parse(today + 'T12:00:00Z') - 30 * 864e5).toISOString().slice(0, 10)
      setSeen({ last: dated[0]?.session || null, recent: new Set(dated.filter(a => a.session.session_date >= since).map(a => a.session_id)).size })
    })()
    return () => { cancelled = true }
  }, [child.id, orgId, today])

  const entries = useMemo(() => childChronology(child, data), [child, data])
  const shown = kind === 'all' ? entries : entries.filter(e => e.kind === kind)
  const flags = childFlags(child)
  const age = ageFrom(child.date_of_birth, today)
  const name = fullName(child)
  const mood = signal?.lastCheck ? moodOf(signal.lastCheck.mood) : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(chronologyText(child, entries, today))
      setCopied('Copied. Paste it into a referral or an email to your lead.')
    } catch (e) {
      setCopied('Your browser blocked copying. Try again from a normal browser window.')
    }
  }

  const openEntry = (e) => {
    if (e.kind === 'concern') onOpenConcern && onOpenConcern(e.id)
    else if (e.kind === 'case') onOpenCase && onOpenCase(e.id)
    else if (e.kind === 'injury') onOpenInjuries && onOpenInjuries()
  }

  return (
    <SessionSheet title={name} subtitle={[age != null ? `Age ${age}` : null, child.group_name || null, 'Safeguarding file'].filter(Boolean).join(' · ')} onClose={onClose} width={720}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
        <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--danger-bg)', color: 'var(--danger-text)', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 900, overflow: 'hidden', flexShrink: 0 }}>
          {child.photo_url ? <SignedImg bucket="gallery" src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (child.first_name?.[0] || '?')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, flex: 1, minWidth: 0 }}>
          <Tile value={signal?.openConcerns || 0} label={signal?.openConcerns === 1 ? 'Open concern' : 'Open concerns'} tone={signal?.openConcerns ? 'danger' : null} />
          <Tile value={signal?.openCases || 0} label={signal?.openCases === 1 ? 'Open case' : 'Open cases'} tone={signal?.openCases ? 'warn' : null} />
          <Tile value={signal?.injuries30 || 0} label="Injuries, 30 days" tone={signal?.injuries30 ? 'warn' : null} />
          <Tile value={mood ? mood.emoji : '–'} label={mood ? `${mood.label}, ${relativeDay(signal.lastCheck.created_at, today)}` : 'No check-in yet'} tone={mood && ['worried', 'upset'].includes(mood.key) ? 'warn' : null} />
        </div>
      </div>

      {flags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {flags.map(f => {
            const [bg, fg] = TONE[f.tone]
            return <span key={f.key} style={{ fontSize: 12, fontWeight: 800, color: fg, background: bg, padding: '4px 10px', borderRadius: 999 }}>{f.label}</span>
          })}
        </div>
      )}
      {child.collection_restricted && child.collection_restriction_note && (
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
          <Icon name="⚠️" /> Collection restricted: {child.collection_restriction_note}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 16 }}>
        <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--text2)' }}><Icon name="📅" /></span>
        <div style={{ flex: '1 1 200px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.45 }}>
          {!seen ? 'Checking the registers…'
            : seen.last ? <>Last at <b>{seen.last.title || 'a session'}</b> {relativeDay(seen.last.session_date, today)}. {seen.recent} {seen.recent === 1 ? 'session' : 'sessions'} in the last 30 days.</>
              : 'Not signed in at any session yet.'}
        </div>
        {seen?.last && access.registers && onOpenRegister && (
          <button type="button" onClick={() => onOpenRegister(seen.last.id)} style={{ ...flowButton, fontSize: 13 }}>Open that register</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 6 }}>
        <button type="button" onClick={() => onReport && onReport(child)} style={{ ...flowButton, border: 'none', background: SG_RED, color: '#fff', fontWeight: 850, gridColumn: mobile ? '1 / -1' : undefined }}>
          <Icon name="🛡️" /> Report a concern
        </button>
        <button type="button" onClick={() => onCheckIn && onCheckIn(child)} style={flowButton}><Icon name="💬" /> Check-in</button>
        <button type="button" onClick={copy} style={flowButton}><Icon name="📋" /> Copy chronology</button>
        {access.people && onOpenProfile && <button type="button" onClick={() => onOpenProfile(child.id)} style={flowButton}><Icon name="👤" /> Full profile</button>}
        {access.medical && onOpenMedical && flags.some(f => MEDICAL.includes(f.key)) && <button type="button" onClick={onOpenMedical} style={flowButton}><Icon name="❤️" /> Medical alerts</button>}
      </div>
      {copied && <div role="status" style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 6 }}>{copied}</div>}

      <h3 style={{ ...sectionHead, marginTop: 18 }}>Chronology</h3>
      <div role="group" aria-label="Show" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10, scrollbarWidth: 'none' }}>
        {[['all', 'Everything'], ...Object.entries(KIND).map(([k, v]) => [k, v.label])].map(([k, lbl]) => {
          const n = k === 'all' ? entries.length : entries.filter(e => e.kind === k).length
          const on = kind === k
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => setKind(k)}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, border: `1px solid ${on ? 'var(--text)' : 'var(--border)'}`, background: on ? 'var(--text)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text2)' }}>
              {lbl} <span style={{ opacity: .75 }}>{n}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', borderRadius: 14, border: '1px dashed var(--border)', color: 'var(--text2)', fontSize: 13.5 }}>
          Nothing recorded{kind === 'all' ? ' for this child yet' : ' of this kind'}.
        </div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: 9, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
          {shown.map(e => {
            const k = KIND[e.kind]
            const opens = e.kind !== 'check'
            const body = (
              <>
                <span aria-hidden="true" style={{ position: 'absolute', left: 3, top: 16, width: 14, height: 14, borderRadius: '50%', background: k.dot, boxShadow: '0 0 0 3px var(--surface)' }} />
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{e.title}</span>
                  {e.status && <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', background: 'var(--surface2)', padding: '1px 8px', borderRadius: 999 }}>{e.status}</span>}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{formatDay(e.at)}{e.meta ? ` · ${e.meta}` : ''}</span>
                {e.detail && <span style={{ display: 'block', fontSize: 13, color: e.warn ? 'var(--warn-text)' : 'var(--text2)', marginTop: 4, lineHeight: 1.45 }}>{e.detail}</span>}
              </>
            )
            const style = { position: 'relative', display: 'block', width: '100%', textAlign: 'left', padding: '10px 10px 10px 30px', minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent', fontFamily: 'inherit', boxSizing: 'border-box' }
            return (
              <li key={e.key}>
                {opens
                  ? <button type="button" onClick={() => openEntry(e)} style={{ ...style, cursor: 'pointer' }}>{body}</button>
                  : <div style={style}>{body}</div>}
              </li>
            )
          })}
        </ol>
      )}
    </SessionSheet>
  )
}
