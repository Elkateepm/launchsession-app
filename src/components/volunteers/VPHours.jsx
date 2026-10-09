import React, { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'
import { orgBrand } from '../shared/OrgPageHero'
import { useNow } from '../../hooks/useNow'
import { HOUR_MILESTONES, formatDuration, formatHours, milestoneProgress, summariseHours } from '../../lib/volunteerHours'

// A volunteer's hours, counted by the register (lib/volunteerHours.js): from
// when their session lead signs them in to when they are signed out. Nothing
// here is typed in by the volunteer, which is what makes the total worth
// putting on a CV, a DofE record or a reference.

const fmtDay = d => new Date(d).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = d => new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit' })
const fmtMonth = day => new Date(`${day.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export default function VPHours({ org, profile, teamRows = [], sessionsById = {}, onNavigate }) {
  const brand = orgBrand(org)
  const reduceMotion = useReducedMotion()
  const live = teamRows.some(row => row.signed_in_at && !row.signed_out_at)
  const now = useNow(live, 1000)
  const summary = useMemo(() => summariseHours(teamRows, sessionsById, now), [teamRows, sessionsById, now])
  const milestone = milestoneProgress(summary.totalMinutes)
  const [copied, setCopied] = useState('')

  const months = useMemo(() => {
    const groups = []
    summary.entries.forEach(entry => {
      const key = entry.day.slice(0, 7)
      if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, label: fmtMonth(entry.day), minutes: 0, entries: [] })
      const group = groups[groups.length - 1]
      group.entries.push(entry)
      group.minutes += entry.minutes
    })
    return groups
  }, [summary.entries])

  const name = profile?.full_name || 'I'
  const first = summary.entries.length ? summary.entries[summary.entries.length - 1].day : null
  const statement = `${name} has volunteered ${formatHours(summary.totalMinutes)} hours with ${org?.name || 'us'} across ${summary.sessionCount} session${summary.sessionCount === 1 ? '' : 's'}${first ? ` since ${fmtMonth(first)}` : ''}, as recorded on the session registers.`
  const copy = async () => {
    try { await navigator.clipboard.writeText(statement); setCopied('Copied. Paste it into a CV, a DofE record or an email.') }
    catch (e) { setCopied(statement) }
  }

  return (
    <div style={{ padding: '18px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>Your hours</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.5 }}>Counted from the register at every session you help with.</p>
      </header>

      {/* The counter */}
      <section aria-label="Hours volunteered" style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: brand.hero, color: '#fff', padding: '20px 20px 18px', boxShadow: `0 18px 40px -26px ${brand.primary}` }}>
        <div aria-hidden="true" style={{ position: 'absolute', width: 260, height: 260, right: -110, top: -130, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, '99')}` }} />
        <div aria-hidden="true" style={{ position: 'absolute', width: 200, height: 200, left: -120, bottom: -150, borderRadius: '50%', border: `2px solid ${withAlpha(brand.accent, '99')}` }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: '#ffffffd9' }}>Hours volunteered</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 56, lineHeight: 1, fontWeight: 900, letterSpacing: -2, fontVariantNumeric: 'tabular-nums' }}>{formatHours(summary.totalMinutes)}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffffd9' }}>{formatHours(summary.totalMinutes) === '1' ? 'hour' : 'hours'}</span>
          </div>
          <div style={{ fontSize: 13.5, color: '#ffffffe6', marginTop: 6 }}>with {org?.name || 'your organisation'}</div>

          {summary.live && (
            <div role="status" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff1f', border: '1px solid #ffffff38', borderRadius: 14, padding: '10px 12px' }}>
              <motion.span aria-hidden="true" animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
                style={{ width: 9, height: 9, borderRadius: 99, background: '#4ADE80', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.4 }}>
                Signed in at <strong>{summary.live.session?.title || 'a session'}</strong> since {fmtTime(summary.live.row.signed_in_at)}
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatDuration(summary.live.minutes)}</span>
            </div>
          )}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {[['This month', `${formatHours(summary.monthMinutes)}h`], ['This year', `${formatHours(summary.yearMinutes)}h`], ['Sessions', summary.sessionCount]].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 12px 10px' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Milestones */}
      <section aria-labelledby="vp-milestone" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <h2 id="vp-milestone" style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>
          {milestone.next ? `${formatHours(milestone.toGo * 60)} hours to go until ${milestone.next} hours` : `Over ${milestone.reached} hours. Thank you!`}
        </h2>
        <div role="progressbar" aria-label={milestone.next ? `Progress to ${milestone.next} hours` : 'All milestones reached'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(milestone.progress * 100)}
          style={{ height: 10, borderRadius: 99, background: 'var(--org-a10, #1B9AAA1a)', overflow: 'hidden', marginTop: 10 }}>
          <motion.div initial={false} animate={{ width: `${milestone.progress * 100}%` }} transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${brand.primary}, ${brand.secondary})` }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {HOUR_MILESTONES.map(m => {
            const done = summary.totalMinutes / 60 >= m
            return (
              <span key={m} style={{ fontSize: 12, fontWeight: 800, borderRadius: 99, padding: '5px 10px', border: `1.5px solid ${done ? 'transparent' : 'var(--border)'}`, background: done ? 'var(--org-a10, #1B9AAA1a)' : 'var(--surface)', color: done ? 'var(--org-ink)' : 'var(--text3)' }}>
                {done && <><Icon name="✓" /> </>}{m}h
              </span>
            )
          })}
        </div>
      </section>

      {/* History */}
      <section aria-labelledby="vp-history" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="vp-history" style={{ margin: 0, fontSize: 13, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text3)' }}>Your sessions</h2>
        {months.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>No hours yet</div>
            <p style={{ margin: '6px auto 0', maxWidth: 300, fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.5 }}>
              When your session lead signs you in on the register, your time starts counting here.
            </p>
            <button onClick={() => onNavigate?.('sessions')} style={{ marginTop: 14, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--org-primary, #1B9AAA)', color: 'var(--org-on-primary, #fff)', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Find a session</button>
          </div>
        ) : months.map(month => (
          <div key={month.key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface2)', fontSize: 12.5, fontWeight: 800, color: 'var(--text2)' }}>
              <span>{month.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDuration(month.minutes)}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {month.entries.map(entry => (
                <li key={entry.row.id || entry.row.session_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: '1px solid var(--border-soft)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.session?.title || 'Session'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                      {fmtDay(entry.row.signed_in_at)} · {fmtTime(entry.row.signed_in_at)}{entry.live ? ' until now' : entry.row.signed_out_at ? ` to ${fmtTime(entry.row.signed_out_at)}` : ''}
                    </div>
                  </div>
                  {entry.live && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ok-text)', background: 'var(--ok-bg)', borderRadius: 99, padding: '3px 8px' }}>Counting</span>}
                  <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatDuration(entry.minutes)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {summary.totalMinutes > 0 && (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>Need proof of your hours?</h2>
          <p style={{ margin: '6px 0 12px', fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.5 }}>{statement}</p>
          <button onClick={copy} style={{ width: '100%', minHeight: 46, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Copy this summary</button>
          {copied && <p role="status" style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>{copied}</p>}
        </section>
      )}

      <section style={{ display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)', lineHeight: 1.55 }}>
          Your hours run from when your session lead signs you in on the register until they sign you out. If you were not signed out, they stop when the register closes. If something looks wrong, the team can correct the times.
        </p>
        <button onClick={() => onNavigate?.('messages')} style={{ minHeight: 44, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--org-ink)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Message the team</button>
      </section>
    </div>
  )
}
