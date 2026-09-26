import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, FileText, LayoutDashboard, Mail, Plus, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useHrAccess, todayLondon, ukDate } from '../../lib/hrAccess'
import StaffHRProfile from './StaffHRProfile'
import { InviteStaffModal } from './HRCentre'
import { absenceOnDate, readAll, useHRWorkspace } from './hrWorkspaceData'
import { HR, LoadError } from './peopleHRShared'
import { AddPersonModal, OnboardingBoard, OrgDocuments, PeopleDirectory, PeopleOverview } from './PeopleHRPanels'

const card = { ...HR.card, padding: 18, marginBottom: 12 }
const gBtn = HR.button
const TABS = [
  ['overview', 'Overview', LayoutDashboard], ['people', 'People', Users],
  ['onboarding', 'Onboarding', UserPlus], ['absence', 'Leave & availability', CalendarDays],
  ['compliance', 'Checks & training', ShieldCheck], ['documents', 'Documents', FileText],
]

export default function HRHome({ org, session, userProfile, onNavigate, section, workspaceContent, showVolunteers = false }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#6D5DF6'
  const access = useHrAccess(userProfile?.role)
  const [tab, setTab] = useState('overview')
  const [peopleFilter, setPeopleFilter] = useState('all')
  const [openPerson, setOpenPerson] = useState(null)
  const [openTab, setOpenTab] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [revision, setRevision] = useState(0)
  const data = useHRWorkspace(org?.id, !access.loading && access.canView, `${session?.user?.id}:${access.sensitiveView}`)
  const activeTab = section || tab
  const onOpen = (person, target = 'overview') => { setOpenPerson(person); setOpenTab(target) }
  const navigateTab = (target, filter = 'all') => {
    setPeopleFilter(filter); setTab(target)
    if (section) onNavigate?.('hr')
  }
  const refresh = async () => {
    setRefreshing(true)
    try { await data.reload(); setRevision(v => v + 1) } finally { setRefreshing(false) }
  }

  if (access.loading) return <div style={{ padding: 24, color: HR.muted }}>Loading People & HR…</div>
  if (!access.canView) return <div style={{ padding: 24 }}><LoadError message="You do not have access to HR records. Ask an administrator to review your role access." /></div>

  return <div style={{ background: HR.canvas, minHeight: '100%', padding: isMobile ? '20px 14px 40px' : '26px 30px 48px' }}>
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ color: HR.muted, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Your organisation · Your people</div>
          <h1 style={{ fontSize: isMobile ? 26 : 30, fontWeight: 750, letterSpacing: -1.1, color: HR.ink, margin: 0 }}>People & HR</h1>
          <p style={{ color: HR.muted, fontSize: 13, margin: '7px 0 0', lineHeight: 1.6 }}>Your team, their records, and what needs attention.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          {access.canEditEmployment && <>
            <button onClick={() => setInviting(true)} style={{ ...HR.button, flex: isMobile ? 1 : undefined }}><Mail size={16} />Invite team member</button>
            <button onClick={() => setAdding(true)} style={{ ...HR.button, background: primary, borderColor: primary, color: '#fff', flex: isMobile ? 1 : undefined }}><Plus size={17} />Add person</button>
          </>}
          <button onClick={refresh} disabled={refreshing} aria-label="Refresh HR records" style={{ ...HR.button, padding: 11, opacity: refreshing ? 0.5 : 1 }}><RefreshCw size={16} /></button>
        </div>
      </header>
      <nav aria-label="People and HR sections" style={{ display: 'flex', gap: 4, overflowX: 'auto', borderBottom: `1px solid ${HR.line}`, marginBottom: 24 }}>
        {TABS.map(([key, label, Icon]) => <button key={key} aria-current={activeTab === key ? 'page' : undefined} onClick={() => navigateTab(key)} style={{ ...HR.button, flexShrink: 0, borderRadius: 0, border: 0, borderBottom: `3px solid ${activeTab === key ? primary : 'transparent'}`, background: 'transparent', padding: '13px 14px', color: activeTab === key ? primary : HR.muted }}><Icon size={16} aria-hidden="true" />{label}</button>)}
      </nav>
      {activeTab === 'overview' && <PeopleOverview data={data} primary={primary} onOpen={onOpen} onTab={navigateTab} />}
      {activeTab === 'people' && <PeopleDirectory key={peopleFilter} initialFilter={peopleFilter} data={data} primary={primary} onOpen={onOpen} onAdd={access.canEditEmployment ? () => setAdding(true) : undefined} onAccounts={() => onNavigate?.('team')} onVolunteers={showVolunteers ? () => onNavigate?.('volunteers') : undefined} />}
      {activeTab === 'onboarding' && <OnboardingBoard data={data} primary={primary} onOpen={onOpen} onApprovals={() => navigateTab('approvals')} />}
      {activeTab === 'compliance' && <OrgCompliance key={revision} org={org} primary={primary} isAdmin={access.canEditEmployment} onOpen={person => onOpen(person, 'compliance')} />}
      {activeTab === 'absence' && <OrgAbsence key={revision} org={org} primary={primary} onOpen={person => onOpen(person, 'absence')} />}
      {activeTab === 'documents' && <OrgDocuments key={revision} org={org} data={data} onOpen={onOpen} />}
      {['approvals', 'audit', 'outcomes', 'accounts', 'volunteers'].includes(activeTab) && <div>
        <button style={{ ...HR.button, marginBottom: 16 }} onClick={() => navigateTab('people')}><ArrowLeft size={15} />Back to your people</button>
        {activeTab === 'approvals' && <Approvals org={org} primary={primary} canDecide={access.canEdit} onOpen={onOpen} onChanged={data.reload} />}
        {activeTab === 'audit' && access.isAdmin && <AuditLog org={org} />}
        {activeTab === 'outcomes' && access.sensitiveView && <Outcomes org={org} sensitiveView={access.sensitiveView} />}
        {section && workspaceContent}
      </div>}
      <footer style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 22, borderTop: `1px solid ${HR.line}`, paddingTop: 14 }}>
        <span style={{ color: HR.muted, fontSize: 11, marginRight: 'auto' }}>{access.isAdmin ? 'Organisation workspace' : 'Your permitted HR records'}</span>
        <button style={{ ...HR.button, background: 'transparent', border: 0, fontSize: 12 }} onClick={() => navigateTab('approvals')}>Account approvals{data.pending ? ` (${data.pending})` : ''}<ArrowRight size={13} /></button>
        {access.sensitiveView && <button style={{ ...HR.button, background: 'transparent', border: 0, fontSize: 12 }} onClick={() => navigateTab('outcomes')}>Restricted outcomes</button>}
        {access.isAdmin && <button style={{ ...HR.button, background: 'transparent', border: 0, fontSize: 12 }} onClick={() => navigateTab('audit')}>Audit trail</button>}
      </footer>
      {openPerson && <StaffHRProfile key={openPerson.hr_staff_id || openPerson.id} org={org} userProfile={userProfile} person={openPerson} initialTab={openTab} onClose={() => { setOpenPerson(null); setOpenTab(null); refresh() }} />}
      {inviting && <InviteStaffModal org={org} primary={primary} onClose={() => setInviting(false)} onSent={() => { setInviting(false); refresh() }} />}
      {adding && <AddPersonModal org={org} primary={primary} canEdit={access.canEditEmployment} onClose={() => setAdding(false)} onSaved={(person, target) => { setAdding(false); onOpen(person, target); refresh() }} />}
    </div>
  </div>
}

function Outcomes({ org, sensitiveView }) {
  const [warnings, setWarnings] = useState(null)
  const [view, setView] = useState('active')

  useEffect(() => {
    let cancelled = false
    supabase.from('hr_staff_warnings_live').select('*').eq('org_id', org.id)
      .order('issued_date', { ascending: false })
      .then(({ data }) => { if (!cancelled) setWarnings(data || []) })
    return () => { cancelled = true }
  }, [org?.id])

  if (!sensitiveView) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13.5, lineHeight: 1.55 }}>
        Outcomes and warnings need disciplinary access, which an administrator grants
        separately from ordinary HR access.
      </div>
    )
  }

  if (warnings === null) return <div style={{ ...card, color: 'var(--text3)', fontSize: 14 }}>Loading outcomes…</div>

  const shown = warnings.filter(w =>
    view === 'active' ? w.effective_status === 'active' : w.effective_status !== 'active')

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['active', 'Active'], ['historical', 'Historical']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} style={{
            padding: '8px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            border: `1px solid ${view === k ? 'transparent' : 'var(--border)'}`,
            background: view === k ? '#0F172A' : 'var(--surface)',
            color: view === k ? '#fff' : 'var(--text3)',
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          }}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13.5 }}>
          {view === 'active' ? 'No active warnings.' : 'Nothing in the history yet.'}
        </div>
      )}

      {shown.map(w => (
        <div key={w.id} style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase' }}>
            {String(w.warning_type).replace('_', ' ')} warning
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 4 }}>
            Issued {ukDate(w.issued_date)}
            {w.expiry_date ? ` · expires ${ukDate(w.expiry_date)}` : ' · no expiry'}
            {w.decision_maker_name ? ` · ${w.decision_maker_name}` : ''}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 800,
              textTransform: 'capitalize',
              background: w.effective_status === 'active' ? 'var(--danger-bg)' : 'var(--surface2)',
              color: w.effective_status === 'active' ? 'var(--danger-text)' : 'var(--text2)',
            }}>{w.effective_status}</span>
          </div>
        </div>
      ))}
    </>
  )
}

function AuditLog({ org }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let cancelled = false
    supabase.from('hr_audit_log').select('*').eq('org_id', org.id)
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (!cancelled) setRows(data || []) })
    return () => { cancelled = true }
  }, [org?.id])

  if (rows === null) return <div style={{ ...card, color: 'var(--text3)', fontSize: 14 }}>Loading audit trail…</div>
  if (rows.length === 0) {
    return <div style={{ ...card, textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13.5 }}>
      Nothing recorded yet.
    </div>
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 10, lineHeight: 1.5 }}>
        Who changed what, and when. Summaries deliberately carry no case detail — an
        allegation or a medical note has no business in a log this many people can read.
      </div>
      {rows.map(r => (
        <div key={r.id} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border-soft)' }}>
          <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: 'var(--text-faint)', fontWeight: 700 }}>
            {new Date(r.created_at).toLocaleString('en-GB', {
              timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short',
            })}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{r.summary || r.action}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 1 }}>
              {r.entity_type} · {String(r.action).replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Organisation-wide compliance: who is outstanding, and (for admins) what the
// organisation actually requires. The requirement list is editable because
// warn periods and what counts as mandatory are the organisation's decision,
// not something a starting set should fix permanently.
function OrgCompliance({ org, primary, isAdmin, onOpen }) {
  const [rows, setRows] = useState(null)
  const [reqs, setReqs] = useState([])
  const [view, setView] = useState('outstanding')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [c, r] = await Promise.all([
      supabase.from('hr_staff_compliance').select('*').eq('org_id', org.id).order('sort_order'),
      supabase.from('staff_compliance_requirements').select('*').eq('org_id', org.id).order('sort_order'),
    ])
    if (c.error) { setError(c.error.message); setRows([]); return }
    setRows(c.data || [])
    setReqs(r.data || [])
  }, [org?.id])
  useEffect(() => { load() }, [load])

  if (rows === null) return <div style={{ ...card, color: 'var(--text3)', fontSize: 14 }}>Loading compliance…</div>

  const outstanding = rows.filter(r => ['overdue', 'missing', 'due_soon'].includes(r.status))
  const byStaff = outstanding.reduce((a, r) => {
    (a[r.staff_id] = a[r.staff_id] || { name: r.full_name, staff_id: r.staff_id, items: [] }).items.push(r)
    return a
  }, {})

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['outstanding', `Outstanding (${outstanding.length})`], ...(isAdmin ? [['requirements', 'Requirements']] : [])]
          .map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} style={{
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
              border: `1px solid ${view === k ? 'transparent' : 'var(--border)'}`,
              background: view === k ? '#0F172A' : 'var(--surface)',
              color: view === k ? '#fff' : 'var(--text3)',
              fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            }}>{l}</button>
          ))}
      </div>

      {error && (
        <div style={{ ...card, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 13 }}>{error}</div>
      )}

      {!error && view === 'outstanding' && Object.values(byStaff).length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13.5 }}>
          Everyone is currently compliant.
        </div>
      )}

      {view === 'outstanding' && Object.values(byStaff).map(g => (
        <button key={g.staff_id}
          onClick={() => onOpen({ id: null, hr_staff_id: g.staff_id, full_name: g.name })}
          style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{g.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
            {g.items.filter(i => i.status === 'overdue').length} overdue ·{' '}
            {g.items.filter(i => i.status === 'missing').length} missing ·{' '}
            {g.items.filter(i => i.status === 'due_soon').length} due soon
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 6 }}>
            {g.items.slice(0, 4).map(i => i.label).join(' · ')}
            {g.items.length > 4 ? ` +${g.items.length - 4}` : ''}
          </div>
        </button>
      ))}

      {view === 'requirements' && (
        <>
          {!adding && (
            <button onClick={() => setAdding(true)} style={{
              width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary,
              color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit', marginBottom: 12,
            }}>Add a requirement</button>
          )}
          {adding && (
            <RequirementForm org={org} primary={primary}
              onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
          )}
          {reqs.map(r => (
            <div key={r.id} style={card}>
              {editing === r.id ? (
                <RequirementForm org={org} primary={primary} existing={r}
                  onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{r.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                        Applies to {r.applies_to === 'all' ? 'everyone' : r.applies_to}
                        {r.applies_value ? ` (${r.applies_value})` : ''}
                        {r.renewal_months ? ` · renews every ${r.renewal_months} months` : ' · no renewal'}
                        {' · warns '}{r.warn_days} days ahead
                      </div>
                    </div>
                    {!r.active && (
                      <span style={{ padding: '3px 10px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--text2)', fontSize: 11.5, fontWeight: 800 }}>Off</span>
                    )}
                  </div>
                  <button onClick={() => setEditing(r.id)} style={{ ...gBtn, marginTop: 10 }}>Edit</button>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </>
  )
}

function RequirementForm({ org, primary, existing, onCancel, onSaved }) {
  const [f, setF] = useState(existing || {
    requirement_key: '', label: '', description: '', applies_to: 'all',
    applies_value: '', renewal_months: '', warn_days: 30, evidence_required: false, active: true,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const fld = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
    border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit', outline: 'none',
    background: 'var(--surface)', marginBottom: 10,
  }
  const lb = { display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' }

  const save = async () => {
    setBusy(true); setErr('')
    // The key is what compliance records point at, so it is set once on
    // creation and never edited -- changing it would orphan the history.
    const body = {
      org_id: org.id, label: f.label.trim(), description: f.description?.trim() || null,
      applies_to: f.applies_to, applies_value: f.applies_value?.trim() || null,
      renewal_months: f.renewal_months === '' ? null : Number(f.renewal_months),
      warn_days: Number(f.warn_days) || 30,
      evidence_required: !!f.evidence_required, active: !!f.active,
    }
    const { error } = existing
      ? await supabase.from('staff_compliance_requirements').update(body).eq('org_id', org.id).eq('id', existing.id)
      : await supabase.from('staff_compliance_requirements').insert({
          ...body,
          requirement_key: (f.requirement_key || f.label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div style={existing ? {} : card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
        {existing ? 'Edit requirement' : 'New requirement'}
      </div>
      <label style={lb}>Name</label>
      <input value={f.label} onChange={e => set('label', e.target.value)} style={fld} />
      <label style={lb}>Description</label>
      <input value={f.description || ''} onChange={e => set('description', e.target.value)} style={fld} />
      <label style={lb}>Applies to</label>
      <select value={f.applies_to} onChange={e => set('applies_to', e.target.value)} style={{ ...fld, minHeight: 44 }}>
        {[['all', 'Everyone'], ['employee', 'Employees'], ['sessional', 'Sessional staff'],
          ['volunteer', 'Volunteers'], ['role', 'A specific role'], ['department', 'A specific team']]
          .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {['role', 'department'].includes(f.applies_to) && (
        <>
          <label style={lb}>{f.applies_to === 'role' ? 'Role' : 'Team'}</label>
          <input value={f.applies_value || ''} onChange={e => set('applies_value', e.target.value)} style={fld} />
        </>
      )}
      <label style={lb}>Renews every (months)</label>
      <input type="number" value={f.renewal_months ?? ''} onChange={e => set('renewal_months', e.target.value)}
        placeholder="Blank if it does not expire" style={fld} />
      <label style={lb}>Warn this many days ahead</label>
      <input type="number" value={f.warn_days} onChange={e => set('warn_days', e.target.value)} style={fld} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer', minHeight: 44 }}>
        <input type="checkbox" checked={!!f.active} onChange={e => set('active', e.target.checked)}
          style={{ width: 18, height: 18, accentColor: primary, flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: 'var(--text)' }}>In use</span>
      </label>
      {err && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 13, marginBottom: 10 }}>{err}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy || !f.label.trim()} style={{
          flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 14, fontWeight: 800,
          cursor: busy || !f.label.trim() ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: busy || !f.label.trim() ? 0.55 : 1,
        }}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} style={gBtn}>Cancel</button>
      </div>
    </div>
  )
}

// Who is away, and what conversation is still owed.
function OrgAbsence({ org, primary, onOpen }) {
  const [rows, setRows] = useState(null)
  const [staff, setStaff] = useState({})
  const [view, setView] = useState('day')
  const [date, setDate] = useState(todayLondon)
  const [weekStart, setWeekStart] = useState(todayLondon)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const shift = (value, days) => {
    const next = new Date(value + 'T12:00:00Z')
    next.setUTCDate(next.getUTCDate() + days)
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(next)
  }
  useEffect(() => {
    let cancelled = false
    setRows(null); setError(false)
    Promise.all([
      readAll(() => supabase.from('staff_leave').select('id, staff_id, category, type, start_date, end_date, status, rtw_required, rtw_completed').eq('org_id', org.id).neq('status', 'cancelled').order('start_date', { ascending: false }).order('id')),
      readAll(() => supabase.from('hr_staff').select('id, full_name').eq('org_id', org.id).order('id')),
    ]).then(([a, s]) => {
      if (cancelled) return
      setRows(a)
      setStaff(Object.fromEntries(s.map(x => [x.id, x.full_name])))
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [org.id, retry])
  const today = todayLondon()
  const rtwDue = (rows || []).filter(r => r.rtw_required && !r.rtw_completed && r.status !== 'cancelled')
  const shown = (rows || []).filter(r => r.status !== 'cancelled' && (view === 'day' ? absenceOnDate(r, date) : view === 'rtw' ? rtwDue.includes(r) : view === 'upcoming' ? r.start_date > today : true))
  const days = Array.from({ length: 7 }, (_, n) => shift(weekStart, n))
  return <section style={HR.card}>
    <h2 style={{ margin: '0 0 6px', fontSize: 18, color: HR.ink }}>Leave & availability</h2>
    <p style={{ margin: '0 0 18px', fontSize: 13, color: HR.muted }}>See who is away, plan ahead and follow up return-to-work meetings.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <label style={{ color: HR.muted, fontSize: 12 }}>View from <input aria-label="Leave calendar date" type="date" value={date} onChange={e => { if (e.target.value) { setDate(e.target.value); setWeekStart(e.target.value); setView('day') } }} style={{ ...HR.input, width: 'auto', marginLeft: 6 }} /></label>
      <button style={HR.button} onClick={() => { setDate(today); setWeekStart(today); setView('day') }}>Today</button>
      <button style={HR.button} onClick={() => { setDate(shift(weekStart, -7)); setWeekStart(shift(weekStart, -7)); setView('day') }}>Previous week</button>
      <button style={HR.button} onClick={() => { setDate(shift(weekStart, 7)); setWeekStart(shift(weekStart, 7)); setView('day') }}>Next week</button>
    </div>
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 12 }}>
      {days.map(d => <button key={d} aria-pressed={date === d && view === 'day'} onClick={() => { setDate(d); setView('day') }} style={{ ...HR.button, display: 'block', minWidth: 90, flex: 1, background: date === d && view === 'day' ? primary : 'var(--surface)', color: date === d && view === 'day' ? '#fff' : HR.ink }}>
        <span style={{ display: 'block', fontSize: 12 }}>{new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'Europe/London' }).format(new Date(d + 'T12:00:00Z'))}</span>
        <span style={{ display: 'block', marginTop: 8, fontSize: 11, fontWeight: 400 }}>{rows ? new Set(rows.filter(r => absenceOnDate(r, d)).map(r => r.staff_id)).size : '—'} away</span>
      </button>)}
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>{[['day', ukDate(date)], ['upcoming', 'Upcoming leave'], ['rtw', `Return to work (${rtwDue.length})`], ['all', 'All records']].map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)} style={{ ...HR.button, background: view === key ? 'var(--surface2)' : '#fff' }}>{label}</button>)}</div>
    {error ? <LoadError onRetry={() => setRetry(v => v + 1)} /> : rows === null ? <p style={{ color: HR.muted }}>Loading leave records…</p> : shown.length === 0 ? <p style={{ padding: 18, fontSize: 13, color: HR.muted }}>No leave records match this view.</p> : shown.map(r => <button key={r.id} onClick={() => onOpen({ id: null, hr_staff_id: r.staff_id, full_name: staff[r.staff_id] || 'Team member' })} style={{ ...HR.button, width: '100%', textAlign: 'left', justifyContent: 'space-between', padding: '17px 0', border: 0, borderTop: `1px solid ${HR.line}`, borderRadius: 0 }}>
      <span><strong style={{ fontSize: 14, color: HR.ink }}>{staff[r.staff_id] || 'Team member'}</strong><span style={{ display: 'block', fontSize: 12, color: HR.muted, fontWeight: 400, marginTop: 6, lineHeight: 1.6, textTransform: 'capitalize' }}>{String(r.category || r.type || 'Leave').replace(/_/g, ' ')} · {ukDate(r.start_date)}{r.end_date && r.end_date !== r.start_date ? ` – ${ukDate(r.end_date)}` : r.status === 'ongoing' ? ' · ongoing' : ''}</span></span><ArrowRight size={16} aria-hidden="true" />
    </button>)}
  </section>
}

// Account approvals. Moved here from Team because approving somebody is the
// first step of joining, not a membership setting -- and because the next
// three things that follow it (employment record, onboarding checklist,
// compliance) all live on this screen.
//
// Approving offers to open the person's HR record straight away rather than
// leaving an approved account with nothing behind it, which is how a new
// starter ends up invisible to HR until somebody remembers them.
function Approvals({ org, primary, canDecide, onOpen, onChanged }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [note, setNote] = useState({})
  const [justApproved, setJustApproved] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase.from('user_profiles')
      .select('id, full_name, email, role, job_title, approval_status, created_at')
      .eq('org_id', org.id).eq('approval_status', 'pending')
      .order('created_at', { ascending: true })
    if (e) { setError(e.message); setRows([]); return }
    setRows(data || [])
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const decide = async (person, decision) => {
    if (!canDecide || busy) return
    setBusy(person.id); setError('')
    const { data: changed, error: e } = await supabase.from('user_profiles')
      .update({ approval_status: decision, approval_note: note[person.id] || null })
      .eq('org_id', org.id).eq('id', person.id).select('id').maybeSingle()
    setBusy(null)
    if (e || !changed) { setError(e?.message || 'No account was updated. Check your access and try again.'); return }
    onChanged?.()
    if (decision === 'approved') setJustApproved(person)
    load()
  }

  // Creating the employment record and its checklist in one step, because an
  // approved account with no HR record behind it is the gap this whole screen
  // exists to close.
  const startRecord = async (person) => {
    if (!canDecide || busy) return
    setBusy(person.id); setError('')
    const { data: staffId, error: e } = await supabase.rpc('hr_ensure_staff_record', { p_user_id: person.id })
    if (e) { setBusy(null); setError(e.message); return }
    const { error: e2 } = await supabase.rpc('hr_seed_onboarding', { p_staff_id: staffId })
    setBusy(null)
    if (e2) { setError(e2.message); return }
    setJustApproved(null)
    onOpen({ id: person.id, hr_staff_id: staffId, full_name: person.full_name }, 'onboarding')
  }

  if (rows === null) return <div style={{ ...card, color: 'var(--text3)', fontSize: 14 }}>Loading approvals…</div>

  return (
    <>
      {error && (
        <div style={{ ...card, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 13 }}>{error}</div>
      )}

      {justApproved && (
        <div style={{ ...card, background: 'var(--ok-bg)', border: '1px solid var(--ok-border)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ok-text)', marginBottom: 4 }}>
            {justApproved.full_name || justApproved.email} approved
          </div>
          <div style={{ fontSize: 13, color: 'var(--ok-text)', opacity: 0.9, lineHeight: 1.5, marginBottom: 12 }}>
            They can sign in now. Open their HR record to set employment details and start
            an onboarding checklist.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => startRecord(justApproved)} disabled={busy === justApproved.id} style={{
              minHeight: 44, padding: '0 16px', borderRadius: 11, border: 'none', background: primary,
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}>{busy === justApproved.id ? 'Setting up…' : 'Open record and start onboarding'}</button>
            <button onClick={() => setJustApproved(null)} style={gBtn}>Later</button>
          </div>
        </div>
      )}

      {!error && rows.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13.5, lineHeight: 1.55 }}>
          Nobody is waiting. New accounts appear here the moment someone finishes setting up
          from an invite.
        </div>
      )}

      {rows.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: primary,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 15,
            }}>{(p.full_name || p.email || '?').slice(0, 1).toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{p.full_name || p.email}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 99, background: 'var(--warn-bg)', color: 'var(--warn-text)', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
              Awaiting approval
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>
            Invited as {p.role}{p.created_at ? ` · signed up ${ukDate(p.created_at)}` : ''}
          </div>
          {canDecide ? (
            <>
              <input value={note[p.id] || ''} onChange={e => setNote(n => ({ ...n, [p.id]: e.target.value }))}
                placeholder="Optional note (kept on their record)"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
                  border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit', outline: 'none',
                  background: 'var(--surface)', marginBottom: 10,
                }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => decide(p, 'approved')} disabled={busy === p.id} style={{
                  flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
                  color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                }}>Approve</button>
                <button onClick={() => decide(p, 'declined')} disabled={busy === p.id} style={{
                  flex: 1, minHeight: 44, borderRadius: 11, border: '1px solid var(--danger-border)',
                  background: 'var(--surface)', color: 'var(--danger-text)', fontSize: 14, fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Decline</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Only an admin or manager can approve this account.
            </div>
          )}
        </div>
      ))}
    </>
  )
}
