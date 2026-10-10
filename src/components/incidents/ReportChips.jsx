import React, { useState } from 'react'
import InjuryForm from './InjuryForm'
import ReportShareSheet from './ReportShareSheet'
import OverlayPortal from '../shared/OverlayPortal'
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
// The third chip, Share, is the hub's too: the same two reports for someone
// with no account, as a link to send or a code to print. It opens
// ReportShareSheet; public forms marked creates_record = 'injury' or 'concern'
// turn each submission into the matching record (20261009_public_reports.sql).

export default function ReportChips({
  org, userProfile, people, linkedSession = null,
  onRaiseConcern, canRaiseConcern = true, isMobile, variant = 'onDark', compact = false,
  onOpenAccidentBook = null,
}) {
  const [injuryOpen, setInjuryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // The database lets owner, admin, manager and staff write to the accident
  // book and refuses volunteers. Showing a volunteer a button that will fail is
  // worse than not showing it.
  const canLogInjury = ['owner', 'admin', 'manager', 'staff'].includes(userProfile?.role)

  if (!canRaiseConcern && !canLogInjury) return null

  const onDark = variant === 'onDark'
  const chip = {
    // Compact chips grow to 44px on touch screens through .ls-tap.
    minHeight: compact ? 30 : 44,
    padding: compact ? '5px 11px 5px 9px' : '8px 14px 8px 11px',
    borderRadius: compact ? 99 : 10,
    cursor: 'pointer', fontFamily: 'inherit',
    fontSize: compact ? 10.5 : 12.5,
    fontWeight: compact ? 800 : 700,
    display: 'inline-flex', alignItems: 'center', gap: compact ? 5 : 7,
    ...(onDark
      ? { border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.10)', color: '#fff' }
      : { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)' }),
  }
  // On a dark card the meaning-carrying reds and ambers are unreadable at chip
  // size, so the icon lifts to a tint that holds against the background.
  const concernColour = onDark ? 'var(--danger-border)' : '#C0392B'
  const injuryColour = onDark ? '#FCD34D' : 'var(--warn-text)'

  // These sit inside a card that is itself a button. Without this, reporting an
  // injury would also open the register behind the form.
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  return (
    <>
      <div style={{ display: 'flex', gap: compact ? 6 : 8, flexWrap: 'wrap' }}>
        {canRaiseConcern && (
          <button onClick={stop(() => onRaiseConcern(linkedSession))} className="ls-tap" style={chip}>
            <span style={{ fontSize: compact ? 13 : 15, color: concernColour, display: 'inline-flex' }}><Icon name="🛡" /></span>
            {compact ? 'Concern' : 'Raise a concern'}
          </button>
        )}
        {canLogInjury && (
          <button onClick={stop(() => setInjuryOpen(true))} className="ls-tap" style={chip}>
            <span style={{ fontSize: compact ? 13 : 15, color: injuryColour, display: 'inline-flex' }}><Icon name="🩹" /></span>
            {compact ? 'Injury' : 'Log an injury'}
          </button>
        )}
        {/* Staff and up, the same people who can log an injury. Handing out a
            public link is harmless; setting the forms up is admin-only, and the
            sheet says so. */}
        {canLogInjury && (
          <button onClick={stop(() => setShareOpen(true))} className="ls-tap" style={chip} title="A link or QR code for people without an account">
            <span style={{ fontSize: compact ? 13 : 15, display: 'inline-flex', opacity: 0.85 }}><Icon name="🔗" /></span>
            Share
          </button>
        )}
      </div>

      {shareOpen && <ReportShareSheet org={org} userProfile={userProfile} onClose={() => setShareOpen(false)} />}

      {/* Portalled to the body. On the day hero these chips sit inside a
          blurred, clipped box, which traps a position:fixed overlay inside it:
          the form opened in the hero's own footprint, under the stat cards. */}
      {injuryOpen && (
        <OverlayPortal>
          {/* No backdrop-dismiss: a half-written account of an incident must not
              be lost to a stray tap. Closing is the Cancel button or the X. */}
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10699, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', zIndex: 10700, background: 'var(--surface, #fff)',
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
              onOpenBook={onOpenAccidentBook && (() => { setInjuryOpen(false); onOpenAccidentBook() })}
            />
          </div>
        </OverlayPortal>
      )}
    </>
  )
}
