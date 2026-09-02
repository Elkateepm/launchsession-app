import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  useHrAccess, EMPLOYMENT_TYPES, EMPLOYMENT_STATUSES, CONTRACT_TYPES,
  PROBATION_STATUSES, statusChip, ukDate, daysUntil,
} from '../../lib/hrAccess'
import Icon from '../../lib/icons'
import { ComplianceTab, TrainingTab } from './StaffCompliance'
import StaffDocuments from './StaffDocuments'
import { SupervisionTab, ProbationTab } from './StaffSupervision'
import StaffAbsence from './StaffAbsence'
import StaffOnboarding from './StaffOnboarding'
import HRCasesTab from './HRCases'
import DisciplinaryRecord from './DisciplinaryRecord'

// A person's HR record, opened from Team.
//
// Team (user_profiles) owns identity. This screen owns employment, and the two
// are joined through hr_staff.user_id -- never copied. Opening a profile for
// someone who has no employment record yet creates one through
// hr_ensure_staff_record(), so the join is made server-side rather than by the
// client guessing at an org_id.

const card = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
  padding: 16, marginBottom: 12,
}
const field = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
  border: '1px solid #E2E8F0', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  background: '#fff',
}
const lbl = {
  display: 'block', fontSize: 11.5, fontWeight: 800, color: '#64748B',
  marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase',
}

function Chip({ tone, bg, children }) {
  return <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: 99,
    background: bg, color: tone, fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
  }}>{children}</span>
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 13, color: '#64748B', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: '#0F172A', fontWeight: 600, textAlign: 'right', minWidth: 0 }}>
        {value || <span style={{ color: '#CBD5E1', fontWeight: 500 }}>Not recorded</span>}
      </span>
    </div>
  )
}

export default function StaffHRProfile({ org, userProfile, person, onClose, initialTab }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#3B82F6'
  const access = useHrAccess(userProfile?.role)

  const [staff, setStaff] = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [onboarding, setOnboarding] = useState(null)
  // Opening a disciplinary from a case takes over the tab body rather than
  // stacking a third overlay on an already-nested drawer.
  const [discId, setDiscId] = useState(null)
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(initialTab || 'overview')

  // person is the user_profiles row from Team. It may or may not already have
  // an employment record behind it.
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      // Two ways in. From Team we hold a user_profiles id and may need the
      // employment record creating. From the HR directory we already hold the
      // hr_staff id -- and must use it, because most staff have no login at
      // all and there is no user_profiles row to resolve from.
      let staffId = person.hr_staff_id || null
      if (!staffId) {
        const { data, error: ensureErr } =
          await supabase.rpc('hr_ensure_staff_record', { p_user_id: person.id })
        if (ensureErr) throw ensureErr
        staffId = data
      }

      // The compliance summary is fetched here rather than by the Compliance
      // tab alone: the header chip and the Overview line both show it, and
      // they must not sit blank until somebody happens to open that tab.
      const [rec, mgrs, comp, onb] = await Promise.all([
        supabase.from('hr_staff').select('*').eq('id', staffId).maybeSingle(),
        supabase.from('hr_staff').select('id, full_name').eq('org_id', org.id)
          .eq('is_active', true).order('full_name'),
        supabase.from('hr_staff_compliance_summary').select('*')
          .eq('staff_id', staffId).maybeSingle(),
        supabase.from('hr_onboarding_progress').select('*')
          .eq('staff_id', staffId).maybeSingle(),
      ])
      if (rec.error) throw rec.error
      setStaff(rec.data)
      setManagers((mgrs.data || []).filter(m => m.id !== staffId))
      // A failed summary is not fatal -- the rest of the record still opens.
      setCompliance(comp.error ? null : comp.data)
      setOnboarding(onb.error ? null : onb.data)
    } catch (e) {
      setError(e.message || 'Could not open this HR record.')
    } finally {
      setLoading(false)
    }
  }, [person.id, person.hr_staff_id, org?.id])

  useEffect(() => { load() }, [load])

  const shell = (body) => (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(17,15,35,0.45)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#F8FAFC', width: isMobile ? '100%' : 720, maxWidth: '100%',
        maxHeight: isMobile ? '94vh' : '90vh', overflowY: 'auto',
        borderRadius: isMobile ? '20px 20px 0 0' : 18, padding: isMobile ? 16 : 20,
      }}>{body}</div>
    </div>
  )

  if (loading) {
    return shell(
      <div style={{ ...card, color: '#64748B', fontSize: 14, marginBottom: 0 }}>
        Opening {person.full_name || person.email}&apos;s HR record…
      </div>
    )
  }

  if (error || !staff) {
    return shell(
      <div style={{ ...card, marginBottom: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#B42318', marginBottom: 6 }}>
          Could not open this HR record
        </div>
        <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.55, marginBottom: 14 }}>
          {error || 'No employment record was returned.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{
            flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}>Try again</button>
          <button onClick={onClose} style={{
            flex: 1, minHeight: 44, borderRadius: 11, border: '1px solid #E2E8F0',
            background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Close</button>
        </div>
      </div>
    )
  }

  const chip = statusChip(staff.employment_status)
  const empType = EMPLOYMENT_TYPES.find(t => t.key === staff.employment_type)
  const lineManager = managers.find(m => m.id === staff.line_manager_id)
  const probationDays = staff.probation_status === 'in_progress' ? daysUntil(staff.probation_end) : null

  // Only the tabs that are actually built are offered. A tab that opens an
  // empty screen is worse than one that is not there yet.
  const TABS = [
    ['overview', 'Overview'], ['employment', 'Employment'],
    ['onboarding', 'Onboarding'],
    ['compliance', 'Compliance'], ['training', 'Training'],
    ['documents', 'Documents'], ['supervision', 'Supervision'],
    ['absence', 'Absence'], ['cases', 'HR cases'],
    ...(access.isAdmin ? [['offboarding', 'Offboarding']] : []),
    // Disciplinary material is a separate grant. Someone without it does not
    // get a tab that would only ever be empty.
    ...(access.sensitiveView ? [['disciplinary', 'Disciplinary']] : []),
    // Probation is only a tab where the role actually has one -- an empty
    // "not applicable" screen is a worse answer than no tab.
    ...(staff.probation_required ? [['probation', 'Probation']] : []),
  ]

  // A deep link can name a tab this viewer is not entitled to (a warning for
  // somebody without disciplinary access). Fall back rather than render a body
  // with nothing in it.
  const activeTab = TABS.some(([k]) => k === tab) ? tab : 'overview'

  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: primary,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 18, overflow: 'hidden',
        }}>
          {person.photo_url
            ? <img src={person.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (staff.full_name || '?').slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', letterSpacing: -0.4 }}>
            {staff.full_name}
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {staff.job_title || empType?.label || 'Staff'}{staff.email ? ` · ${staff.email}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Chip tone={chip.tone} bg={chip.bg}>{chip.label}</Chip>
            {empType && <Chip tone="#3730A3" bg="#EEF2FF">{empType.label}</Chip>}
            {onboarding && onboarding.required_outstanding > 0 && (
              <Chip tone="#93500A" bg="#FEF6E7">Onboarding {onboarding.percent}%</Chip>
            )}
            {compliance && compliance.percent !== null && (
              <Chip
                tone={compliance.overdue > 0 || compliance.missing > 0 ? '#B42318' : '#04713C'}
                bg={compliance.overdue > 0 || compliance.missing > 0 ? '#FEF2F2' : '#E7F8ED'}
              >Compliance {compliance.percent}%</Chip>
            )}
            {staff.probation_status === 'in_progress' && (
              <Chip tone="#93500A" bg="#FEF6E7">
                Probation{probationDays !== null ? ` · ${probationDays < 0 ? 'review overdue' : `${probationDays}d`}` : ''}
              </Chip>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8',
          minHeight: 44, minWidth: 44, fontFamily: 'inherit', fontSize: 15,
        }}><Icon name="✕" /></button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '9px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            border: `1px solid ${activeTab === k ? 'transparent' : '#E2E8F0'}`,
            background: activeTab === k ? primary : '#fff',
            color: activeTab === k ? '#fff' : '#64748B',
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Employment summary</div>
          <Row label="Employment type" value={empType?.label} />
          <Row label="Job title" value={staff.job_title} />
          <Row label="Department" value={staff.department} />
          <Row label="Line manager" value={lineManager?.full_name} />
          <Row label="Start date" value={ukDate(staff.start_date)} />
          <Row label="Contract" value={staff.contract_type} />
          <Row label="Status" value={chip.label} />
          {staff.employment_status === 'leaving' && <Row label="Leaving date" value={ukDate(staff.leaving_date)} />}
          <Row label="Emergency contact" value={
            staff.emergency_contact_name
              ? `${staff.emergency_contact_name}${staff.emergency_contact_phone ? ` · ${staff.emergency_contact_phone}` : ''}`
              : null
          } />
          <Row label="Account" value={staff.user_id ? 'Linked to a LaunchSession login' : 'No login — HR record only'} />
          <Row label="Onboarding" value={
            onboarding
              ? (onboarding.required_outstanding > 0
                  ? `${onboarding.percent}% — ${onboarding.required_outstanding} required item(s) left`
                  : 'Complete')
              : 'Not started'
          } />
          <Row label="Compliance" value={
            compliance
              ? (compliance.percent === null
                  ? 'No requirements apply'
                  : `${compliance.percent}% — ${compliance.overdue} overdue, ${compliance.missing} missing, ${compliance.due_soon} due soon`)
              : null
          } />
        </div>
      )}

      {activeTab === 'employment' && (
        <EmploymentForm
          staff={staff} managers={managers} primary={primary}
          canEdit={access.canEditEmployment}
          onSaved={(next) => setStaff(next)}
        />
      )}

      {activeTab === 'onboarding' && (
        <StaffOnboarding org={org} staff={staff} primary={primary}
          canEdit={access.canEdit} onJumpToTab={setTab} />
      )}

      {activeTab === 'compliance' && (
        <ComplianceTab
          org={org} staff={staff} primary={primary}
          canEdit={access.canEdit} isAdmin={access.isAdmin}
          onSummary={setCompliance}
        />
      )}

      {activeTab === 'training' && (
        <TrainingTab org={org} staff={staff} primary={primary} canEdit={access.canEdit} />
      )}

      {activeTab === 'documents' && (
        <StaffDocuments org={org} staff={staff} primary={primary}
          canEdit={access.canEdit} sensitiveView={access.sensitiveView} />
      )}

      {activeTab === 'supervision' && (
        <SupervisionTab org={org} staff={staff} primary={primary}
          canEdit={access.canEdit} sensitiveView={access.sensitiveView} />
      )}

      {activeTab === 'absence' && (
        <StaffAbsence org={org} staff={staff} primary={primary} canEdit={access.canEdit} />
      )}

      {activeTab === 'probation' && (
        <ProbationTab org={org} staff={staff} primary={primary} canEdit={access.canEdit} />
      )}

      {activeTab === 'offboarding' && (
        <Offboarding org={org} staff={staff} primary={primary}
          canEdit={access.canEditEmployment} onChanged={load} />
      )}

      {activeTab === 'cases' && (
        discId
          ? <DisciplinaryRecord org={org} staff={staff} caseId={discId} primary={primary}
              canEdit={access.sensitiveEdit} onBack={() => setDiscId(null)} />
          : <HRCasesTab org={org} staff={staff} primary={primary}
              canEdit={access.canEdit} sensitiveEdit={access.sensitiveEdit}
              onOpenDisciplinary={(id) => setDiscId(id)} />
      )}

      {activeTab === 'disciplinary' && (
        discId
          ? <DisciplinaryRecord org={org} staff={staff} caseId={discId} primary={primary}
              canEdit={access.sensitiveEdit} onBack={() => setDiscId(null)} />
          : <DisciplinaryList org={org} staff={staff} primary={primary} onOpen={setDiscId} />
      )}
    </>
  )
}

const OFFBOARD_STEPS = [
  ['leaving_confirmed', 'Leaving date confirmed'],
  ['final_day', 'Final working day agreed'],
  ['access_disabled', 'Access disabled'],
  ['equipment_returned', 'Equipment returned'],
  ['documents_complete', 'Documents completed'],
  ['exit_meeting', 'Exit meeting held'],
  ['payroll_notified', 'Payroll notified'],
  ['retention_applied', 'Data retention applied'],
]

const OFFBOARD_REASONS = [
  ['resignation', 'Resignation'], ['end_of_fixed_term', 'End of fixed-term contract'],
  ['retirement', 'Retirement'], ['dismissal', 'Dismissal'],
  ['redundancy', 'Redundancy'], ['volunteer_leaving', 'Volunteer leaving'],
  ['other', 'Other'],
]

// Offboarding. Nobody is deleted -- the record is archived by moving the
// employment status to 'left', which is what keeps a former staff member's
// safeguarding and HR history answerable years later.
function Offboarding({ org, staff, primary, canEdit, onChanged }) {
  const [rec, setRec] = React.useState(undefined)
  const [f, setF] = React.useState({ reason: 'resignation', leaving_date: '', final_working_date: '', exit_notes: '' })
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const load = React.useCallback(async () => {
    const { data } = await supabase.from('staff_offboarding').select('*')
      .eq('staff_id', staff.id).maybeSingle()
    setRec(data || null)
    if (data) setF({
      reason: data.reason, leaving_date: data.leaving_date || '',
      final_working_date: data.final_working_date || '', exit_notes: data.exit_notes || '',
    })
  }, [staff.id])
  React.useEffect(() => { load() }, [load])

  if (rec === undefined) {
    return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading…</div>
  }

  const checklist = rec?.checklist || {}
  const done = OFFBOARD_STEPS.filter(([k]) => checklist[k]).length

  const save = async (patch) => {
    setBusy(true); setErr('')
    const body = {
      org_id: org.id, staff_id: staff.id, reason: f.reason,
      leaving_date: f.leaving_date || null,
      final_working_date: f.final_working_date || null,
      exit_notes: f.exit_notes.trim() || null,
      checklist, ...patch,
    }
    const { error } = rec
      ? await supabase.from('staff_offboarding').update(body).eq('id', rec.id)
      : await supabase.from('staff_offboarding').insert(body)
    if (error) { setBusy(false); setErr(error.message); return }
    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_offboarding', p_entity_id: rec?.id || null, p_staff_id: staff.id,
      p_action: rec ? 'updated' : 'started', p_summary: 'Offboarding updated', p_metadata: null,
    })
    setBusy(false)
    load(); onChanged()
  }

  const toggle = (k) => save({ checklist: { ...checklist, [k]: !checklist[k] } })

  const complete = async () => {
    setBusy(true); setErr('')
    await save({ status: 'completed', completed_at: new Date().toISOString() })
    const { error } = await supabase.from('hr_staff').update({
      employment_status: 'left', is_active: false,
      leaving_date: f.leaving_date || null,
      status_changed_at: new Date().toISOString(),
    }).eq('id', staff.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    onChanged()
  }

  return (
    <>
      {!canEdit && (
        <div style={{ ...card, background: '#F1F5F9', color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>
          Offboarding is recorded by an administrator.
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Leaving</div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>REASON</label>
          <select value={f.reason} disabled={!canEdit}
            onChange={e => setF(s => ({ ...s, reason: e.target.value }))}
            style={{ ...field, minHeight: 44 }}>
            {OFFBOARD_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>LEAVING DATE</label>
          <input type="date" value={f.leaving_date} disabled={!canEdit}
            onChange={e => setF(s => ({ ...s, leaving_date: e.target.value }))} style={field} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>FINAL WORKING DAY</label>
          <input type="date" value={f.final_working_date} disabled={!canEdit}
            onChange={e => setF(s => ({ ...s, final_working_date: e.target.value }))} style={field} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>EXIT NOTES</label>
          <textarea rows={3} value={f.exit_notes} disabled={!canEdit}
            onChange={e => setF(s => ({ ...s, exit_notes: e.target.value }))}
            style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
        </div>
        {canEdit && (
          <button onClick={() => save({})} disabled={busy} style={{
            width: '100%', minHeight: 44, borderRadius: 11, border: 'none', background: primary,
            color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
          }}>{busy ? 'Saving…' : rec ? 'Save' : 'Start offboarding'}</button>
        )}
      </div>

      {rec && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Checklist</span>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              {done} / {OFFBOARD_STEPS.length}
            </span>
          </div>
          {OFFBOARD_STEPS.map(([k, l]) => (
            <label key={k} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
              borderTop: '1px solid #F1F5F9', cursor: canEdit ? 'pointer' : 'default', minHeight: 44,
            }}>
              <input type="checkbox" checked={!!checklist[k]} disabled={!canEdit || busy}
                onChange={() => toggle(k)}
                style={{ width: 18, height: 18, accentColor: primary, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: '#0F172A' }}>{l}</span>
            </label>
          ))}
        </div>
      )}

      {err && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {err}
        </div>
      )}

      {rec && canEdit && rec.status !== 'completed' && staff.employment_status !== 'left' && (
        <div style={card}>
          <button onClick={complete} disabled={busy} style={{
            width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: '#0F172A',
            color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
          }}>{busy ? 'Completing…' : 'Complete offboarding'}</button>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8, lineHeight: 1.45 }}>
            Marks them as having left and removes them from active lists. Nothing is deleted —
            their HR history stays readable.
          </div>
        </div>
      )}

      {staff.employment_status === 'left' && (
        <div style={{ ...card, background: '#F3F2F7', color: '#5A5772', fontSize: 13, lineHeight: 1.5 }}>
          {staff.full_name} has left. The record is archived and remains readable.
        </div>
      )}
    </>
  )
}

function DisciplinaryList({ org, staff, primary, onOpen }) {
  const [rows, setRows] = React.useState(null)
  React.useEffect(() => {
    let cancelled = false
    supabase.from('disciplinary_cases')
      .select('id, reference, stage, allegation, created_at, locked')
      .eq('staff_id', staff.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setRows(data || []) })
    return () => { cancelled = true }
  }, [staff.id])

  if (rows === null) {
    return <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, color: '#64748B', fontSize: 14 }}>Loading…</div>
  }
  if (rows.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>
        No active disciplinary processes for {staff.full_name}. A disciplinary is only
        opened by escalating an HR case.
      </div>
    )
  }
  return rows.map(r => (
    <button key={r.id} onClick={() => onOpen(r.id)} style={{
      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.4 }}>{r.reference}</div>
      <div style={{ fontSize: 14, color: '#0F172A', marginTop: 4 }}>{r.allegation}</div>
      <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4, textTransform: 'capitalize' }}>
        {r.locked ? 'Closed' : r.stage} · opened {ukDate(r.created_at)}
      </div>
    </button>
  ))
}

function EmploymentForm({ staff, managers, primary, canEdit, onSaved }) {
  const [form, setForm] = useState(staff)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setForm(staff); setSaved(false) }, [staff])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  const save = async () => {
    setSaving(true); setErr('')
    // Only the employment columns are sent. Spreading the whole row back would
    // also rewrite fields other screens own, such as dbs_status.
    const patch = {
      staff_ref: form.staff_ref || null,
      job_title: form.job_title || null,
      employment_type: form.employment_type,
      department: form.department || null,
      line_manager_id: form.line_manager_id || null,
      start_date: form.start_date || null,
      continuous_service_date: form.continuous_service_date || null,
      contract_type: form.contract_type || null,
      contracted_hours: form.contracted_hours === '' ? null : form.contracted_hours,
      work_location: form.work_location || null,
      probation_required: !!form.probation_required,
      probation_start: form.probation_start || null,
      probation_end: form.probation_end || null,
      probation_status: form.probation_required ? (form.probation_status || 'in_progress') : null,
      notice_period: form.notice_period || null,
      employment_status: form.employment_status,
      status_reason: form.status_reason || null,
      leaving_date: form.leaving_date || null,
      leaving_reason: form.leaving_reason || null,
      payroll_ref: form.payroll_ref || null,
      updated_at: new Date().toISOString(),
    }
    if (patch.employment_status !== staff.employment_status) {
      patch.status_changed_at = new Date().toISOString()
    }

    const { data, error } = await supabase.from('hr_staff')
      .update(patch).eq('id', staff.id).select().maybeSingle()
    setSaving(false)
    if (error) { setErr(error.message); return }

    // Recorded, not derived: the log says a change happened and by whom, and
    // deliberately carries no employment detail in the summary.
    await supabase.rpc('hr_audit', {
      p_entity_type: 'hr_staff', p_entity_id: staff.id, p_staff_id: staff.id,
      p_action: 'employment_updated', p_summary: 'Employment details updated', p_metadata: null,
    })
    setSaved(true)
    onSaved(data)
  }

  const T = ({ k, label, type = 'text', placeholder }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={form[k] == null ? '' : form[k]} disabled={!canEdit}
        placeholder={placeholder} onChange={e => set(k, e.target.value)} style={field} />
    </div>
  )

  return (
    <>
      {!canEdit && (
        <div style={{ ...card, background: '#F1F5F9', color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>
          You can see this record but not change it. Employment terms, line manager and
          leaving details are set by an administrator.
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Role</div>
        <T k="job_title" label="Job title" placeholder="e.g. Youth Worker" />
        <T k="staff_ref" label="Staff / employee ID" />
        <T k="department" label="Department or team" />
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Employment type</label>
          <select value={form.employment_type || 'employee'} disabled={!canEdit}
            onChange={e => set('employment_type', e.target.value)} style={{ ...field, minHeight: 44 }}>
            {EMPLOYMENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Line manager</label>
          <select value={form.line_manager_id || ''} disabled={!canEdit}
            onChange={e => set('line_manager_id', e.target.value || null)} style={{ ...field, minHeight: 44 }}>
            <option value="">Not set</option>
            {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 1.45 }}>
            Decides who can open this person&apos;s HR record. A manager reaches their own
            reports; administrators reach everyone.
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Contract</div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Contract type</label>
          <select value={form.contract_type || ''} disabled={!canEdit}
            onChange={e => set('contract_type', e.target.value)} style={{ ...field, minHeight: 44 }}>
            <option value="">Not set</option>
            {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <T k="start_date" label="Start date" type="date" />
        <T k="continuous_service_date" label="Continuous service date" type="date" />
        <T k="contracted_hours" label="Contracted hours per week" type="number" />
        <T k="work_location" label="Work location" />
        <T k="notice_period" label="Notice period" placeholder="e.g. 1 month" />
        <T k="payroll_ref" label="Payroll reference (optional)" />
      </div>

      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Probation</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: canEdit ? 'pointer' : 'default', minHeight: 44 }}>
          <input type="checkbox" checked={!!form.probation_required} disabled={!canEdit}
            onChange={e => set('probation_required', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: primary, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: '#0F172A' }}>This role has a probation period</span>
        </label>
        {form.probation_required && (
          <>
            <T k="probation_start" label="Probation start" type="date" />
            <T k="probation_end" label="Probation review due" type="date" />
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Probation status</label>
              <select value={form.probation_status || 'in_progress'} disabled={!canEdit}
                onChange={e => set('probation_status', e.target.value)} style={{ ...field, minHeight: 44 }}>
                {PROBATION_STATUSES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>
                Recorded by you. Nothing here decides a probation outcome.
              </div>
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Status</div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Employment status</label>
          <select value={form.employment_status || 'active'} disabled={!canEdit}
            onChange={e => set('employment_status', e.target.value)} style={{ ...field, minHeight: 44 }}>
            {EMPLOYMENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        {(form.employment_status === 'suspended' || form.employment_status === 'on_leave') && (
          <>
            <T k="status_reason" label="Reason" />
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: -6, marginBottom: 14, lineHeight: 1.45 }}>
              A change of duties or a period away from work is a neutral record. It does
              not imply any disciplinary process.
            </div>
          </>
        )}
        {(form.employment_status === 'leaving' || form.employment_status === 'left') && (
          <>
            <T k="leaving_date" label="Leaving date" type="date" />
            <T k="leaving_reason" label="Leaving reason" />
          </>
        )}
      </div>

      {err && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {err}
        </div>
      )}

      {canEdit && (
        <button onClick={save} disabled={saving} style={{
          width: '100%', minHeight: 48, borderRadius: 12, border: 'none', background: primary,
          color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: saving ? 0.6 : 1, marginBottom: 12,
        }}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save employment details'}</button>
      )}
    </>
  )
}
