// What an organisation sees about its trial and, once it lapses, about being
// read-only.
//
// Nothing here is the enforcement. org_write_locked() in the database refuses
// the writes; this explains the refusal before the user hits it, which is the
// difference between "the trial ended, here's what to do" and a save button
// that mysteriously errors.
import React, { useState } from 'react'
import { trialDaysRemaining } from '../../lib/moduleAccess'
import { useIsMobile } from '../../hooks/useIsMobile'

// Under this many days the banner stops being informational and starts being a
// prompt.
const URGENT_DAYS = 3

export function TrialBanner({ org, isAdmin, onChoosePlan }) {
  const isMobile = useIsMobile()
  const days = trialDaysRemaining(org)
  if (days === null || days <= 0) return null

  const urgent = days <= URGENT_DAYS
  const tone = urgent
    ? { bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.22)', text: '#DC2626' }
    : { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.16)', text: '#1D4ED8' }

  return (
    <div style={{ padding: '6px 20px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap', padding: '9px 14px', borderRadius: 10,
        background: tone.bg, border: `1px solid ${tone.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13 }} aria-hidden="true">{urgent ? '⏳' : '🚀'}</span>
          <span style={{ fontSize: 13, color: tone.text, fontWeight: 600 }}>
            {days === 1 ? 'Last day of your free trial' : `${days} days left on your free trial`}
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={onChoosePlan}
            style={{
              minHeight: 32, padding: '6px 14px', borderRadius: 8, border: 'none',
              background: tone.text, color: '#fff', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Choose a plan
          </button>
        )}
      </div>
    </div>
  )
}

// Stays on screen once the plan has ended, under the wall and after it is
// dismissed, so read-only never becomes a silent state.
export function ReadOnlyBanner({ isAdmin, onChoosePlan }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ padding: '6px 20px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap', padding: '9px 14px', borderRadius: 10,
        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13 }} aria-hidden="true">🔒</span>
          <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
            Read-only — your plan has ended. Nothing has been deleted.
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={onChoosePlan}
            style={{
              minHeight: 32, padding: '6px 14px', borderRadius: 8, border: 'none',
              background: '#DC2626', color: '#fff', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Choose a plan
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Shown over the app once the trial or subscription has ended.
 *
 * Dismissible on purpose. An organisation that has not paid still owns its
 * safeguarding records, and a wall it cannot get past would mean a DSL could
 * not read a concern during an incident because a card expired. Writes stay
 * blocked either way -- the database sees to that -- so letting them through
 * to read costs nothing and withholding it could cost a great deal.
 */
export function PlanEndedWall({ org, isAdmin, onChoosePlan, onDismiss }) {
  const isMobile = useIsMobile()
  const [busy, setBusy] = useState(false)
  const orgName = org?.name || 'This organisation'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ls-plan-ended-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(8,12,22,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? 16 : 24, overflowY: 'auto',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480, background: 'var(--surface, #fff)',
        borderRadius: 18, border: '1px solid var(--border, #E2E8F0)',
        padding: isMobile ? '26px 20px' : '32px 30px',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 34, marginBottom: 12 }} aria-hidden="true">🔒</div>
        <h2 id="ls-plan-ended-title" style={{ margin: '0 0 10px', fontSize: isMobile ? 20 : 23, fontWeight: 900, color: 'var(--text, #0F172A)', lineHeight: 1.25 }}>
          {org?.plan === 'trial' ? 'Your free trial has ended' : 'Your plan has ended'}
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 14.5, lineHeight: 1.65, color: 'var(--text3, #64748B)' }}>
          {orgName} is now read-only. Every register, concern, risk assessment and
          record is exactly where you left it — nothing has been deleted, and
          you can still open and export it. Choose a plan to start making
          changes again.
        </p>

        {isAdmin ? (
          <button
            onClick={() => { setBusy(true); onChoosePlan() }}
            disabled={busy}
            style={{
              width: '100%', minHeight: 48, borderRadius: 12, border: 'none',
              background: busy ? '#94A3B8' : 'var(--org-primary, #1B9AAA)', color: '#fff',
              fontSize: 15, fontWeight: 800, cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit', marginBottom: 10,
            }}
          >
            {busy ? 'Opening…' : 'See plans and pricing'}
          </button>
        ) : (
          <div style={{
            background: 'var(--bg, #F8FAFC)', border: '1px solid var(--border, #E2E8F0)',
            borderRadius: 12, padding: '13px 15px', marginBottom: 10,
            fontSize: 13.5, lineHeight: 1.6, color: 'var(--text3, #64748B)',
          }}>
            An owner or administrator of {orgName} can choose a plan from
            Settings → Billing.
          </div>
        )}

        <button
          onClick={onDismiss}
          style={{
            width: '100%', minHeight: 44, borderRadius: 12,
            border: '1.5px solid var(--border, #E2E8F0)', background: 'transparent',
            color: 'var(--text3, #64748B)', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Continue in read-only mode
        </button>
      </div>
    </div>
  )
}
