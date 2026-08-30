import React, { useState } from 'react'
import InjuryForm from './InjuryForm'
import Icon from '../../lib/icons'

// ─── REPORT CHIPS ─────────────────────────────────────────────
// Ported from the Solidarity Sports hub, where the reasoning is that these sit
// where they are reachable the moment someone opens the app rather than after
// scrolling past the day's sessions.
//
// They follow the session. While something is running they belong on that
// session's card, because an incident reported from there is an incident that
// happened in it -- the card passes the session down and both reports are
// filed against it without anyone having to remember to attach it. With
// nothing running there is no session to attribute anything to, so they sit on
// the day hero instead and whatever is reported is unattached until someone
// says otherwise.
//
// Two tinted pills read as alarms rather than actions, so the surface is
// neutral and the colour lives in the icon -- enough to find them in a hurry
// without the page looking like something is wrong. On a card that neutral
// surface is a translucent white rather than a solid one, since both the hero
// and the session card are dark.
//
// The hub's third chip, Share, is not ported: it hands out a public link and
// code for someone with no account, and it depends on public forms carrying a
// creates_record of 'injury' or 'concern', which this app's forms do not have.

export default function ReportChips({
  org, userProfile, people, linkedSession = null,
  onRaiseConcern, canRaiseConcern = true, isMobile, variant = 'onDark', compact = false,
}) {
  const [injuryOpen, setInjuryOpen] = useState(false)

  // The database lets owner, admin, manager and staff write to the accident
  // book and refuses volunteers. Showing a volunteer a button that will fail is
  // worse than not showing it.
  const canLogInjury = ['owner', 'admin', 'manager', 'staff'].includes(userProfile?.role)

  if (!canRaiseConcern && !canLogInjury) return null

  const onDark = variant === 'onDark'
  const chip = {
    minHeight: compact ? 30 : 40,
    padding: compact ? '5px 11px 5px 9px' : '8px 14px 8px 11px',
    borderRadius: compact ? 99 : 10,
    cursor: 'pointer', fontFamily: 'inherit',
    fontSize: compact ? 10.5 : 12.5,
    fontWeight: compact ? 800 : 700,
    display: 'inline-flex', alignItems: 'center', gap: compact ? 5 : 7,
    ...(onDark
      ? { border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.10)', color: '#fff' }
      : { border: '1px solid #E2E8F0', background: '#fff', color: '#475569' }),
  }
  // On a dark card the meaning-carrying reds and ambers are unreadable at chip
  // size, so the icon lifts to a tint that holds against the background.
  const concernColour = onDark ? '#FCA5A5' : '#C0392B'
  const injuryColour = onDark ? '#FCD34D' : '#B45309'

  // These sit inside a card that is itself a button. Without this, reporting an
  // injury would also open the register behind the form.
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  return (
    <>
      <div style={{ display: 'flex', gap: compact ? 6 : 8, flexWrap: 'wrap' }}>
        {canRaiseConcern && (
          <button onClick={stop(() => onRaiseConcern(linkedSession))} style={chip}>
            <span style={{ fontSize: compact ? 13 : 15, color: concernColour, display: 'inline-flex' }}><Icon name="🛡" /></span>
            {compact ? 'Concern' : 'Raise a concern'}
          </button>
        )}
        {canLogInjury && (
          <button onClick={stop(() => setInjuryOpen(true))} style={chip}>
            <span style={{ fontSize: compact ? 13 : 15, color: injuryColour, display: 'inline-flex' }}><Icon name="🩹" /></span>
            {compact ? 'Injury' : 'Log an injury'}
          </button>
        )}
      </div>

      {injuryOpen && (
        <div onClick={e => e.stopPropagation()}>
          {/* No backdrop-dismiss: a half-written account of an incident must not
              be lost to a stray tap. Closing is the Cancel button or the X. */}
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', zIndex: 100, background: 'var(--surface, #fff)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.4)', textAlign: 'left',
            ...(isMobile
              // Bottom sheet on a phone, which is where this gets filled in.
              ? { left: 0, right: 0, bottom: 0, top: 40, borderRadius: '20px 20px 0 0', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
              : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px,96vw)', maxHeight: '92dvh', overflowY: 'auto', borderRadius: 24 }),
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            <InjuryForm
              org={org}
              userProfile={userProfile}
              session={linkedSession}
              people={people}
              onClose={() => setInjuryOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
