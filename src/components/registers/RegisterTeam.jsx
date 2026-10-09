import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useNow } from '../../hooks/useNow'
import { londonNow } from '../../lib/sessionPhase'
import { formatDuration, isCounting, londonInstant, teamMinutes } from '../../lib/volunteerHours'

// The session's team on the register: who is here, since when, and for how
// long. Time between being signed in here and being signed out is what counts
// towards a volunteer's hours (lib/volunteerHours.js), so the counter on each
// row is the number that lands on their Hours tab.
//
// Signing the team in and out stays with whoever runs the register. A
// volunteer sees the team and their own time ticking, but cannot set their
// own hours.

const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit' }) : ''
const isVolunteer = (row, person) => row.role === 'volunteer' || person?.role === 'volunteer' || (!row.user_id && !!row.volunteer_id)
const multiDay = session => !!session?.end_date && session.end_date > session.session_date

const btn = {
  minHeight: 44, minWidth: 44, padding: '0 14px', borderRadius: 11, border: '1.5px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
}
const primaryBtn = { ...btn, border: 'none', background: 'var(--org-primary, #1B9AAA)', color: 'var(--org-on-primary, #fff)' }

export default function RegisterTeam({ session, staffRows = [], people = {}, authUserId, canManage, closed = false, onChanged, onError }) {
  const counting = !closed && staffRows.some(row => isCounting(row, session))
  const now = useNow(counting, 1000)
  const [busy, setBusy] = useState(null)
  const [editing, setEditing] = useState(null)

  const here = staffRows.filter(row => row.signed_in_at && (closed || !row.signed_out_at)).length
  const volunteerMinutes = staffRows
    .filter(row => isVolunteer(row, people[row.user_id || row.volunteer_id]))
    .reduce((sum, row) => sum + teamMinutes(row, session, now), 0)

  const save = async (row, patch) => {
    setBusy(row.id)
    const { error } = await supabase.from('session_staff').update(patch).eq('id', row.id).eq('session_id', session.id)
    setBusy(null)
    if (error) { onError?.('That did not save. Check your connection and try again.'); return false }
    onChanged?.()
    return true
  }

  // Back from a break: carry on from the first sign-in rather than starting
  // again, which would throw away the time before the break.
  const signIn = row => save(row, row.signed_in_at && row.signed_out_at
    ? { signed_out_at: null }
    : { signed_in_at: new Date().toISOString(), signed_out_at: null })
  const signOut = row => save(row, { signed_out_at: new Date().toISOString() })

  return (
    <section aria-labelledby="register-team-title" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <header style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h3 id="register-team-title" style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>
            Team <span style={{ color: 'var(--text3)', fontWeight: 700 }}>· {here} of {staffRows.length} {closed ? 'came' : 'here'}</span>
          </h3>
          {volunteerMinutes > 0 && (
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--org-ink)', fontVariantNumeric: 'tabular-nums' }}>
              Volunteer time {closed ? '' : 'so far '}{formatDuration(volunteerMinutes)}
            </span>
          )}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}>
          {canManage
            ? 'Time from signing in here to signing out counts towards each volunteer’s hours.'
            : 'Your session lead signs the team in and out. Your time here counts towards your hours.'}
        </p>
      </header>

      {staffRows.length === 0 ? (
        <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)' }}>No one is on this session’s team yet. Add people to the session in Sessions.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {staffRows.map(row => {
            const pid = row.user_id || row.volunteer_id
            const person = people[pid]
            const name = person?.full_name || (row.volunteer_id ? 'Volunteer' : 'Team member')
            return (
              <TeamRow key={row.id} row={row} name={name} volunteer={isVolunteer(row, person)} you={!!authUserId && row.user_id === authUserId}
                session={session} now={now} closed={closed} canManage={canManage} busy={busy === row.id}
                editing={editing === row.id} onEdit={() => setEditing(row.id)} onCancelEdit={() => setEditing(null)}
                onSaveTimes={async patch => { if (await save(row, patch)) setEditing(null) }}
                onSignIn={() => signIn(row)} onSignOut={() => signOut(row)} />
            )
          })}
        </ul>
      )}
    </section>
  )
}

function TeamRow({ row, name, volunteer, you, session, now, closed, canManage, busy, editing, onEdit, onCancelEdit, onSaveTimes, onSignIn, onSignOut }) {
  const reduceMotion = useReducedMotion()
  const live = !closed && isCounting(row, session, now)
  const minutes = teamMinutes(row, session, now)
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  let status
  if (!row.signed_in_at) status = closed ? 'Did not sign in' : 'Not signed in yet'
  else if (live) status = `Here since ${fmtTime(row.signed_in_at)}`
  else status = `${fmtTime(row.signed_in_at)} to ${row.signed_out_at ? fmtTime(row.signed_out_at) : closed ? 'close' : 'session end'}`

  return (
    <li style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--org-a10, #1B9AAA1a)', color: 'var(--org-ink, #0E5E66)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 }}>{initials || '?'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{name}</span>
            {volunteer && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--org-ink)', background: 'var(--org-a10, #1B9AAA1a)', borderRadius: 99, padding: '2px 8px' }}>Volunteer</span>}
            {you && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', background: 'var(--surface2)', borderRadius: 99, padding: '2px 8px' }}>You</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 12.5, color: 'var(--text3)', flexWrap: 'wrap' }}>
            <span>{status}</span>
            {row.signed_in_at && (
              <span aria-label={live ? `${formatDuration(minutes)} so far` : `${formatDuration(minutes)} in total`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: live ? 'var(--ok-text)' : 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                {live && (
                  <motion.span aria-hidden="true"
                    animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: 7, height: 7, borderRadius: 99, background: 'currentColor', display: 'inline-block' }} />
                )}
                {formatDuration(minutes)}
              </span>
            )}
          </div>
        </div>
        {canManage && !editing && (
          closed ? (
            <button onClick={onEdit} style={btn}>Edit times</button>
          ) : !row.signed_in_at ? (
            <button onClick={onSignIn} disabled={busy} style={primaryBtn}>{busy ? 'Saving…' : 'Sign in'}</button>
          ) : !row.signed_out_at ? (
            <button onClick={onSignOut} disabled={busy} style={btn}>{busy ? 'Saving…' : 'Sign out'}</button>
          ) : (
            <button onClick={onSignIn} disabled={busy} style={btn}>{busy ? 'Saving…' : 'Sign back in'}</button>
          )
        )}
      </div>
      {canManage && !closed && !editing && row.signed_in_at && (
        <button onClick={onEdit} style={{ marginTop: 2, marginLeft: 52, padding: '0 2px', minHeight: 44, border: 'none', background: 'none', color: 'var(--org-ink)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Fix the times</button>
      )}
      {editing && <TimesEditor row={row} session={session} closed={closed} onCancel={onCancelEdit} onSave={onSaveTimes} busy={busy} />}
    </li>
  )
}

// For when someone was not signed in on the day, or was signed in late: set
// the times they were actually there. Times are London times on the session's
// date, or full dates and times for a session that runs over several days.
function TimesEditor({ row, session, closed, onCancel, onSave, busy }) {
  const spans = multiDay(session)
  const toInput = value => {
    if (!value) return ''
    const local = londonNow(new Date(value))
    return spans ? local.slice(0, 16) : local.slice(11, 16)
  }
  const fallbackIn = spans ? `${session.session_date}T${(session.start_time || '09:00').slice(0, 5)}` : (session.start_time || '').slice(0, 5)
  const fallbackOut = spans ? `${session.end_date}T${(session.end_time || '17:00').slice(0, 5)}` : (session.end_time || '').slice(0, 5)
  const [arrived, setArrived] = useState(toInput(row.signed_in_at) || fallbackIn)
  const [left, setLeft] = useState(toInput(row.signed_out_at) || (closed ? fallbackOut : ''))
  const [problem, setProblem] = useState('')

  const instant = value => {
    if (!value) return null
    const [date, time] = spans ? value.split('T') : [session.session_date, value]
    return londonInstant(date, `${time}:00`)
  }

  const submit = () => {
    const inAt = instant(arrived)
    const outAt = instant(left)
    if (!inAt) { setProblem('Add the time they arrived.'); return }
    if (closed && !outAt) { setProblem('Add the time they left.'); return }
    if (outAt && outAt <= inAt) { setProblem('They have to leave after they arrive.'); return }
    if (outAt && outAt > new Date()) { setProblem('That leaving time has not happened yet.'); return }
    onSave({ signed_in_at: inAt.toISOString(), signed_out_at: outAt ? outAt.toISOString() : null })
  }

  const field = { width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '8px 10px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit' }
  const type = spans ? 'datetime-local' : 'time'
  return (
    <div style={{ marginTop: 10, marginLeft: 52, display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', display: 'grid', gap: 4 }}>
          Arrived
          <input type={type} value={arrived} onChange={e => { setArrived(e.target.value); setProblem('') }} style={field} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', display: 'grid', gap: 4 }}>
          Left{closed ? '' : ' (leave empty if still here)'}
          <input type={type} value={left} onChange={e => { setLeft(e.target.value); setProblem('') }} style={field} />
        </label>
      </div>
      {problem && <div role="alert" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--danger-text)' }}>{problem}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={btn}>Cancel</button>
        <button onClick={submit} disabled={busy} style={{ ...primaryBtn, flex: 1 }}>{busy ? 'Saving…' : 'Save times'}</button>
      </div>
    </div>
  )
}
