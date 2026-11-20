import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { riskStateLabel } from '../../lib/riskMatch'
import { EmergencyView } from './RALiveSafety'
import Icon from '../../lib/icons'

// A session's risk assessment, as one row on the session card and the
// register. It answers the question someone at the door actually has -- "is
// this covered, and where is the emergency info?" -- rather than the old
// "Risk Assessment Attached" pill, which looked the same for a finished,
// approved assessment and for a one-line draft nobody had opened.

// What the row needs to judge readiness, plus the emergency fields so the
// emergency view opens without a second request.
export const SESSION_RISK_SELECT = 'risk_assessments!ras_assessment_org_fk(id, name, risk_rating, status, next_review_date, review_date, manager_approved_at, approval_required, archived, location, meeting_point, nearest_hospital, emergency_contacts, first_aid_equipment, defibrillator_location, evacuation_plan, missing_child_procedure, safeguarding_escalation, emergency_procedures)'

const TONES = {
  ready: { fg: '#4ADE80', bg: 'rgba(34,197,94,0.14)', border: 'rgba(74,222,128,0.35)', icon: '✓' },
  review: { fg: '#FCD34D', bg: 'rgba(251,191,36,0.12)', border: 'rgba(252,211,77,0.35)', icon: '!' },
  draft: { fg: '#FCD34D', bg: 'rgba(251,191,36,0.12)', border: 'rgba(252,211,77,0.35)', icon: '✎' },
  action: { fg: '#FCA5A5', bg: 'rgba(248,113,113,0.14)', border: 'rgba(252,165,165,0.4)', icon: '!' },
  none: { fg: '#FCA5A5', bg: 'rgba(248,113,113,0.10)', border: 'rgba(252,165,165,0.4)', icon: '+' },
  optional: { fg: 'rgba(255,255,255,0.75)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.22)', icon: '+' },
}

/**
 * The row itself, for a dark card or banner. `assessment` undefined means
 * still loading (nothing is drawn, so the card does not jump), null means none.
 */
export function RiskRow({ assessment, required = true, onOpen, onAttach, compact = false }) {
  if (assessment === undefined) return null
  const { state, label } = riskStateLabel(assessment)
  const key = assessment ? state : required ? 'none' : 'optional'
  const tone = TONES[key]
  const clickable = assessment ? !!onOpen : !!onAttach
  const title = assessment ? assessment.name : required ? 'No risk assessment yet' : 'No risk assessment'
  const detail = assessment
    ? `${label}${assessment.risk_rating ? ` · ${assessment.risk_rating[0].toUpperCase()}${assessment.risk_rating.slice(1)} risk` : ''}`
    : onAttach ? (required ? 'Needed for this session · Attach one' : 'Optional · Attach one') : (required ? 'Needed for this session' : 'Not required')
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={clickable ? 'ls-tap' : undefined}
      onClick={clickable ? (e) => { e.stopPropagation(); assessment ? onOpen(assessment) : onAttach(e) } : undefined}
      aria-label={clickable ? `Risk assessment: ${title}. ${detail}` : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', minHeight: compact ? 44 : 50,
        padding: compact ? '6px 12px 6px 6px' : '7px 12px 7px 7px', borderRadius: 14, textAlign: 'left', fontFamily: 'inherit',
        background: tone.bg, border: `1px ${assessment || required ? 'solid' : 'dashed'} ${tone.border}`, color: '#fff',
        cursor: clickable ? 'pointer' : 'default',
      }}>
      <span aria-hidden="true" style={{ position: 'relative', width: compact ? 32 : 36, height: compact ? 32 : 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.08)', color: tone.fg, flexShrink: 0, fontSize: 17 }}>
        <Icon name="🛡️" />
        <span style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 900, background: tone.fg, color: '#0B1220' }}>{tone.icon}</span>
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: tone.fg, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
      </span>
      {clickable && <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, flexShrink: 0 }}><Icon name="→" /></span>}
    </Tag>
  )
}

/** Load the assessment linked to a session. undefined while loading, null if none. */
export function useSessionRisk(sessionId, orgId) {
  const [assessment, setAssessment] = useState(undefined)
  const load = useCallback(() => {
    if (!sessionId || !orgId) { setAssessment(null); return }
    let request
    try {
      request = supabase.from('risk_assessment_sessions').select(SESSION_RISK_SELECT).eq('org_id', orgId).eq('session_id', sessionId).limit(5)
    } catch (e) { setAssessment(null); return }
    Promise.resolve(request)
      .then(({ data, error }) => {
        if (error) { setAssessment(null); return }
        // Prefer a live assessment over an archived one if both are linked.
        const rows = (data || []).map(r => r.risk_assessments).filter(Boolean)
        setAssessment(rows.find(a => !a.archived) || null)
      })
      .catch(() => setAssessment(null))
  }, [sessionId, orgId])
  useEffect(() => { setAssessment(undefined); load() }, [load])
  // Polled, not a Realtime subscription (those crash iOS WebKit in this app),
  // and paused while the tab is hidden. Someone attaching an assessment on
  // another device shows up within half a minute.
  useEffect(() => {
    if (!sessionId) return undefined
    const timer = setInterval(() => { if (!document.hidden) load() }, 30000)
    return () => clearInterval(timer)
  }, [sessionId, load])
  return [assessment, load, setAssessment]
}

/**
 * Self-contained version for the register: loads the link itself, and opens
 * the emergency information on tap. Without an assessment it offers the Risk
 * Assessments page, where one can be attached.
 */
export default function SessionRiskRow({ session, orgId, org, onNavigate, compact }) {
  const [assessment] = useSessionRisk(session?.id, orgId)
  const [emergency, setEmergency] = useState(false)
  return (
    <>
      <RiskRow
        assessment={assessment}
        required={session?.risk_assessment_required !== false}
        compact={compact}
        onOpen={() => setEmergency(true)}
        onAttach={onNavigate ? () => onNavigate('risk_assessments') : null}
      />
      {emergency && assessment && createPortal(
        // Above the register and the dashboard's own overlays.
        <div style={{ position: 'relative', zIndex: 10500 }}>
          <EmergencyView open onClose={() => setEmergency(false)} assessment={assessment} org={org} />
        </div>,
        document.body,
      )}
    </>
  )
}
