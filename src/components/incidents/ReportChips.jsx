import React, { useState } from 'react'
import InjuryForm from './InjuryForm'
import Icon from '../../lib/icons'

// ─── REPORT CHIPS ─────────────────────────────────────────────
// Ported from the Solidarity Sports hub, where the reasoning is that these sit
// where they are reachable the moment someone opens the app rather than after
// scrolling past the day's sessions.
//
// Two tinted pills read as alarms rather than actions, so the surface is
// neutral and the colour lives in the icon -- enough to find them in a hurry
// without the page looking like something is wrong.
//
// The hub's third chip, Share, is not ported: it hands out a public link and
// code for someone with no account, and it depends on public forms carrying a
// creates_record of 'injury' or 'concern', which this app's forms do not have.
//
// Raising a concern reuses the modal Home already owns rather than mounting a
// second copy of the form; only the injury overlay belongs to this component.

export default function ReportChips({ org, session, userProfile, people, todaySession, onRaiseConcern, canRaiseConcern = true, isMobile }) {
  const [injuryOpen, setInjuryOpen] = useState(false)

  // The database lets owner, admin, manager and staff write to the accident
  // book and refuses volunteers. Showing a volunteer a button that will fail is
  // worse than not showing it.
  const canLogInjury = ['owner', 'admin', 'manager', 'staff'].includes(userProfile?.role)

  if (!canRaiseConcern && !canLogInjury) return null

  const chip = {
    minHeight: 40, padding: '8px 14px 8px 11px', borderRadius: 10, cursor: 'pointer',
    border: '1px solid #E2E8F0', background: '#fff', color: '#475569',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 7,
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canRaiseConcern && (
          <button onClick={onRaiseConcern} style={chip}>
            <span style={{ fontSize: 15, color: '#C0392B', display: 'inline-flex' }}><Icon name="🛡" /></span>
            Raise a concern
          </button>
        )}
        {canLogInjury && (
          <button onClick={() => setInjuryOpen(true)} style={chip}>
            <span style={{ fontSize: 15, color: '#B45309', display: 'inline-flex' }}><Icon name="🩹" /></span>
            Log an injury
          </button>
        )}
      </div>

      {injuryOpen && (
        <>
          {/* No backdrop-dismiss: a half-written account of an incident must not
              be lost to a stray tap. Closing is the Cancel button or the X. */}
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', zIndex: 100, background: 'var(--surface, #fff)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
            ...(isMobile
              // Bottom sheet on a phone, which is where this gets filled in.
              ? { left: 0, right: 0, bottom: 0, top: 40, borderRadius: '20px 20px 0 0', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
              : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px,96vw)', maxHeight: '92dvh', overflowY: 'auto', borderRadius: 24 }),
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            <InjuryForm
              org={org}
              userProfile={userProfile}
              session={todaySession}
              people={people}
              onClose={() => setInjuryOpen(false)}
            />
          </div>
        </>
      )}
    </>
  )
}
