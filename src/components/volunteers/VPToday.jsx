import React, { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Icon from '../../lib/icons'
import { useNow } from '../../hooks/useNow'
import { formatDuration, formatHours, summariseHours } from '../../lib/volunteerHours'

// The volunteer's home screen.
//
// A volunteer opens this on a phone, usually in the ten minutes before a
// session or while standing in a hall. It has to answer one question — what am
// I doing, and where — and give them the one thing they might need in a hurry,
// which is how to report a concern.
//
// What it used to carry, and why none of it is here now:
//
//   A countdown to the session, ticking every second. The start time is two
//   lines above it.
//
//   "Today's Overview": sessions today, young people expected, hours
//   scheduled. The first restates the card above it, the second read 0 because
//   it summed max_capacity which few sessions set, and the third is a number no
//   volunteer has ever needed.
//
//   Six "Quick Actions" tiles, three of which — My Sessions, Messages, Profile
//   — were the bottom navigation again, two rows further down the page.
//
//   A badge shelf: First Session, 10 Sessions, 50 Sessions, 50 Hours, 100
//   Young People, all greyed out until earned, and a streak counter. These are
//   adults giving up a Tuesday evening. Scoring them against a locked trophy
//   case is the wrong register, and it sat above the announcement telling them
//   who their new safeguarding lead is.
//
//   A checklist whose first item, "Confirm attendance for today", was pushed
//   with done: true hardcoded — struck through on arrival, every day, wired to
//   nothing.
//
// Hours earn a single line rather than a dashboard: the running total, and
// while the volunteer is signed in on a register, the time ticking up. The
// full picture is on the Hours tab.
//
// Safeguarding stays, deliberately, and stays reachable without scrolling. It
// is styled as a plain high-contrast row rather than the red alarm banner it
// was: something that shouts every single day stops being read by the third
// week, and this is the one thing on the screen that must still be seen in
// month six.

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
}

const fmtWhen = (s) => {
  if (!s?.session_date) return ''
  const start = (s.start_time || '').slice(0, 5)
  const end = (s.end_time || '').slice(0, 5)
  const date = new Date(`${s.session_date}T12:00:00`)
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const days = Math.round((date - today) / 86400000)
  const label =
    days === 0 ? 'Today' :
    days === 1 ? 'Tomorrow' :
    days > 1 && days < 7 ? date.toLocaleDateString('en-GB', { weekday: 'long' })
      : date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return [label, start && end ? `${start}–${end}` : start].filter(Boolean).join(' · ')
}

function Row({ icon, title, detail, action, onClick, tone }) {
  const colour = tone === 'danger' ? 'var(--danger-text)' : 'var(--text)'
  return (
    <button
      onClick={onClick}
      style={{
        ...CARD, width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 14px', minHeight: 56, cursor: 'pointer', textAlign: 'left', font: 'inherit',
        borderColor: tone === 'danger' ? 'var(--danger-border)' : 'var(--border)',
        background: tone === 'danger' ? 'var(--danger-bg)' : 'var(--surface)',
      }}
    >
      <span style={{ fontSize: 17, flexShrink: 0, color: colour }}><Icon name={icon} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: colour }}>{title}</span>
        {detail && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 1 }}>{detail}</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, color: colour, flexShrink: 0 }}>{action}</span>
    </button>
  )
}

const actionBtn = {
  flex: 1, minHeight: 46, padding: '0 12px', borderRadius: 12, border: 'none',
  background: 'var(--org-primary, #1B9AAA)', color: 'var(--org-on-primary, #fff)', fontSize: 14, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
}
const quietBtn = { ...actionBtn, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }

export default function VPToday({
  org, profile, todaySessions = [], futureSessions = [], announcements = [],
  teamRows = [], sessionsById = {}, onOpenSession, onOpenRegister, onNavigate, onRaiseConcern,
}) {
  const reduceMotion = useReducedMotion()
  const signedIn = teamRows.some(row => row.signed_in_at && !row.signed_out_at)
  const now = useNow(signedIn, 1000)
  const hours = useMemo(() => summariseHours(teamRows, sessionsById, now), [teamRows, sessionsById, now])
  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const next = todaySessions[0] || futureSessions[0] || null
  const isToday = !!todaySessions[0]

  // Only things the person can actually do something about. An empty list is
  // the normal state and renders nothing rather than an empty card.
  const needsYou = []
  if (!profile?.dbs_number) {
    needsYou.push({ key: 'dbs', icon: '🪪', title: 'Add your DBS details', detail: 'Needed before you can be put on a session', action: 'Add', onClick: () => onNavigate?.('profile') })
  }
  const pinned = announcements.find(a => a.pinned)
  if (pinned) {
    needsYou.push({ key: 'pinned', icon: '📣', title: pinned.title || 'Pinned announcement', detail: 'From your team', action: 'Read', onClick: () => onNavigate?.('messages') })
  }

  const recent = announcements.filter(a => !a.pinned).slice(0, 3)

  return (
    <div style={{ padding: '18px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>
          {greeting}, {firstName}
        </h1>
        <div style={{ fontSize: 13.5, color: 'var(--text3)', marginTop: 2 }}>Thank you for helping at {org?.name}.</div>
      </header>

      {next ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          style={{ ...CARD, overflow: 'hidden' }}
        >
          <div style={{ padding: '15px 16px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text3)' }}>
              {isToday ? 'On today' : 'Next session'}
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--text)', marginTop: 5, lineHeight: 1.2 }}>
              {next.title || 'Session'}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 4 }}>{fmtWhen(next)}</div>
            {next.location && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 2 }}>
                <Icon name="📍" /> {next.location}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '0 16px 15px' }}>
            {next.location && (
              <a href={`https://maps.apple.com/?q=${encodeURIComponent(next.location)}`} target="_blank" rel="noreferrer" style={quietBtn}>Directions</a>
            )}
            {isToday && onOpenRegister
              ? <button onClick={() => onOpenRegister(next)} style={actionBtn}>Open register</button>
              : <button onClick={() => onOpenSession?.(next)} style={actionBtn}>View details</button>}
          </div>
        </motion.div>
      ) : (
        <div style={{ ...CARD, padding: '26px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Nothing booked yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            Sessions you can help with appear under Sessions.
          </div>
          <button onClick={() => onNavigate?.('sessions')} style={{ ...actionBtn, flex: 'none', marginTop: 14, padding: '0 18px' }}>Find a session</button>
        </div>
      )}

      {hours.live ? (
        <button onClick={() => onNavigate?.('hours')}
          style={{ ...CARD, width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', cursor: 'pointer', textAlign: 'left', font: 'inherit', borderColor: 'var(--ok-border, var(--border))', background: 'var(--ok-bg)' }}>
          <motion.span aria-hidden="true" animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}
            style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--ok-text)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--ok-text)' }}>You're signed in at {hours.live.session?.title || 'your session'}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text2)', marginTop: 1 }}>Your hours are counting</span>
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--ok-text)', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(hours.live.minutes)}</span>
        </button>
      ) : (
        <Row icon="⏱️" title={`${formatHours(hours.totalMinutes)} hours volunteered`} detail={hours.monthMinutes ? `${formatHours(hours.monthMinutes)} this month` : 'Counted from the register at each session'} action="See all" onClick={() => onNavigate?.('hours')} />
      )}

      {/* Always here, never below the fold, and never dressed as an emergency. */}
      <Row
        icon="🛡️"
        tone="danger"
        title="Report a concern"
        detail="Goes straight to the safeguarding lead"
        action="Report"
        onClick={() => onRaiseConcern?.()}
      />

      {needsYou.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text3)' }}>
            Needs you
          </div>
          {needsYou.map(item => <Row key={item.key} {...item} />)}
        </section>
      )}

      {recent.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text3)' }}>
            From your team
          </div>
          {recent.map(a => (
            <div key={a.id} style={{ ...CARD, padding: '13px 14px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{a.title}</div>
              {a.body && (
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>{a.body}</div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
