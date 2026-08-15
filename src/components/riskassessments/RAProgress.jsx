import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { safetyStateOf, SAFETY_META } from './ra_safety'

// Completeness and approval.
//
// The old workspace gave no answer to "what is left to do on this?" -- you had
// to open each tab and judge for yourself. These two strips answer it directly:
// what is still missing, and whether anyone has signed it off.

const CARD = { background: '#fff', border: '1px solid #ECE9F5', borderRadius: 14 }

/**
 * Which sections of an assessment are actually finished.
 *
 * Deliberately judged from content rather than a stored checklist: a flag saying
 * "emergency complete" that nobody maintains is worse than no flag, because it
 * reads as reassurance.
 */
export function assessmentProgress({ assessment, hazards = [], outstandingControls = 0, attachmentCount = 0 }) {
  const a = assessment || {}

  const emergencyFilled = [
    a.emergency_contacts, a.meeting_point, a.nearest_hospital,
    a.emergency_procedures, a.evacuation_plan, a.missing_child_procedure,
  ].filter(v => v && String(v).trim()).length

  return [
    {
      key: 'overview',
      label: 'Overview',
      done: !!(a.name && a.activity_type && (a.location || a.venue_id)),
      hint: 'Name, activity type and location',
    },
    {
      key: 'hazards',
      label: 'Hazards',
      done: hazards.length > 0,
      hint: 'At least one hazard identified',
    },
    {
      key: 'controls',
      label: 'Controls',
      // Not just "controls exist" -- controls that are still outstanding mean
      // the mitigation isn't actually in place yet.
      done: hazards.length > 0 && outstandingControls === 0,
      hint: outstandingControls > 0
        ? `${outstandingControls} control${outstandingControls === 1 ? '' : 's'} not yet in place`
        : 'Every control in place',
    },
    {
      key: 'emergency',
      label: 'Emergency',
      // Two fields is a low bar on purpose: enough to be useful in an incident,
      // not so strict that nobody ever reaches "complete".
      done: emergencyFilled >= 2,
      hint: 'Emergency contacts and meeting point',
    },
    {
      key: 'attachments',
      label: 'Files',
      done: attachmentCount > 0,
      optional: true,
      hint: 'Venue or provider documents',
    },
    {
      key: 'approval',
      label: 'Approval',
      done: a.approval_required === false || !!a.manager_approved_at,
      hint: 'Signed off by a manager',
    },
  ]
}

export function ProgressStrip({ steps, onJump }) {
  const isMobile = useIsMobile()

  return (
    <div style={{
      display: 'flex', gap: 6, marginBottom: 16,
      overflowX: isMobile ? 'auto' : 'visible',
      paddingBottom: isMobile ? 4 : 0,
      WebkitOverflowScrolling: 'touch',
    }}>
      {steps.map(step => {
        const tone = step.done
          ? { bg: '#E7F8ED', text: '#04713C', mark: '✓' }
          : step.optional
            ? { bg: '#F3F2F7', text: '#5A5772', mark: '○' }
            : { bg: '#FEF6E7', text: '#93500A', mark: '!' }

        return (
          <button
            key={step.key}
            onClick={() => onJump?.(step.key)}
            title={step.hint}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 999, border: 'none',
              background: tone.bg, color: tone.text,
              fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11 }}>{tone.mark}</span>
            {step.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Approval and review actions.
 *
 * Renewal creates an audit event rather than silently moving the review date:
 * "we looked and nothing had changed" is a decision someone made, and the
 * record should show who and when.
 */
export function ApprovalPanel({ assessment, org, authSession, staff = [], isManager, onChanged }) {
  const isMobile = useIsMobile()
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState(null)

  const primary = org?.primary_color || '#7C5CFC'
  const approved = !!assessment.manager_approved_at
  const state = safetyStateOf(assessment)
  const meta = SAFETY_META[state]

  const nameOf = id => staff.find(s => s.id === id)?.full_name || 'A manager'

  const logAudit = async (action, detail) => {
    await supabase.from('risk_assessment_audit').insert({
      assessment_id: assessment.id, org_id: org.id, action, detail,
      actor_id: authSession?.user?.id || null,
    })
  }

  async function approve() {
    setBusy(true); setError(null)
    const { error: e } = await supabase.from('risk_assessments').update({
      manager_approved_by: authSession?.user?.id || null,
      manager_approved_at: new Date().toISOString(),
      status: 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', assessment.id)
    setBusy(false)
    if (e) { setError(e.message); return }
    await logAudit('approved', 'Assessment approved')
    onChanged?.()
  }

  async function renew(changed) {
    setBusy(true); setError(null)
    const today = new Date()
    const next = new Date(today)
    next.setFullYear(next.getFullYear() + 1)
    const iso = d => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

    const patch = {
      last_reviewed_at: iso(today),
      updated_at: new Date().toISOString(),
    }

    if (changed) {
      // Something changed, so the sign-off no longer describes what will
      // actually happen. Clearing approval forces a fresh decision rather than
      // carrying the old one forward.
      patch.status = 'draft'
      patch.manager_approved_at = null
      patch.manager_approved_by = null
    } else {
      patch.next_review_date = iso(next)
      patch.status = 'active'
    }

    const { error: e } = await supabase.from('risk_assessments').update(patch).eq('id', assessment.id)
    setBusy(false); setReviewing(false)
    if (e) { setError(e.message); return }
    await logAudit(
      changed ? 'review_changes' : 'renewed',
      changed ? 'Reviewed — changes required, returned to draft' : 'Reviewed — no changes, renewed for 12 months'
    )
    onChanged?.()
  }

  return (
    <div style={{ ...CARD, padding: 16, marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '4px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: meta.bg, color: meta.text,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 7, background: meta.dot }} />
          {meta.label}
        </span>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Approval</div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10, marginBottom: 14,
      }}>
        {[
          ['Prepared by', nameOf(assessment.created_by)],
          ['Approved by', approved ? nameOf(assessment.manager_approved_by) : 'Not yet approved'],
          ['Approved on', approved ? new Date(assessment.manager_approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
          ['Next review', (assessment.next_review_date || assessment.review_date)
            ? new Date(assessment.next_review_date || assessment.review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Not set'],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B87A3', letterSpacing: 0.3 }}>
              {label.toUpperCase()}
            </div>
            <div style={{ fontSize: 13.5, color: '#0F172A', marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
          border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 12,
        }}>{error}</div>
      )}

      {!reviewing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!approved && assessment.approval_required !== false && isManager && (
            <button onClick={approve} disabled={busy} style={{
              padding: '10px 18px', borderRadius: 11, border: 'none', background: primary,
              color: '#fff', fontSize: 13.5, fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>{busy ? 'Approving…' : 'Approve assessment'}</button>
          )}

          {!approved && !isManager && assessment.approval_required !== false && (
            <div style={{ fontSize: 13, color: '#8B87A3' }}>
              A manager needs to approve this before it counts as ready.
            </div>
          )}

          {approved && (
            <button onClick={() => setReviewing(true)} style={{
              padding: '10px 18px', borderRadius: 11, border: '1px solid #ECE9F5',
              background: '#fff', color: '#0F172A', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Start review</button>
          )}
        </div>
      )}

      {reviewing && (
        <div style={{
          padding: 14, borderRadius: 12, background: '#FAF9FE', border: '1px solid #ECE9F5',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
            Has anything changed?
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.55, marginBottom: 12 }}>
            The activity, venue, participants, staffing, transport, equipment, provider,
            hazards, controls or emergency procedure.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => renew(false)} disabled={busy} style={{
              padding: '10px 16px', borderRadius: 11, border: 'none', background: '#12B76A',
              color: '#fff', fontSize: 13.5, fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>No changes — renew</button>
            <button onClick={() => renew(true)} disabled={busy} style={{
              padding: '10px 16px', borderRadius: 11, border: '1px solid #FDE2B5',
              background: '#FEF6E7', color: '#93500A', fontSize: 13.5, fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>Changes required</button>
            <button onClick={() => setReviewing(false)} style={{
              padding: '10px 16px', borderRadius: 11, border: 'none',
              background: 'transparent', color: '#8B87A3', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
