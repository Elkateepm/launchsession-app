import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowRight, CalendarDays, Check, ClipboardCheck, FileText, Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { EMPLOYMENT_TYPES, statusChip, todayLondon, ukDate } from '../../lib/hrAccess'
import { DOCUMENT_TYPES } from './StaffDocuments'
import { absenceOnDate, checkCount, currentPerson, filterPeople, needsOnboarding, personLink, readAll } from './hrWorkspaceData'
import { Avatar, Badge, Empty, HR, LoadError, PeopleDialog } from './peopleHRShared'

const indexByStaff = rows => Object.fromEntries((rows || []).map(r => [r.staff_id, r]))
const LINK_TABS = { compliance: 'compliance', staff: 'employment', supervision: 'supervision', absence: 'absence', hr_case: 'cases', disciplinary: 'disciplinary', warning: 'disciplinary', document: 'documents', onboarding: 'onboarding', training: 'training' }
const ACTIONS = { compliance: 'Review check', staff: 'Review employment', supervision: 'Open supervision', absence: 'Review leave', hr_case: 'Open HR record', disciplinary: 'Open HR record', warning: 'Open HR record', document: 'Review document', onboarding: 'View checklist', training: 'Review training' }
const SEVERITY = { 1: ['Overdue', '#B42318', '#FFF0ED'], 2: ['Needs review', '#8A570A', '#FFF6DF'], 3: ['Coming up', '#48627E', '#EEF3F8'] }

function Title({ children, detail, action }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
    <div><h2 style={{ color: HR.ink, fontSize: 18, letterSpacing: -0.35, margin: 0 }}>{children}</h2>{detail && <p style={{ color: HR.muted, fontSize: 12, margin: '5px 0 0', lineHeight: 1.5 }}>{detail}</p>}</div>
    {action}
  </div>
}

function Stat({ label, value, detail, icon: Icon, primary, onClick, urgent }) {
  return <button onClick={onClick} style={{ ...HR.card, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', padding: 18, color: HR.ink }}>
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 13 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: HR.muted }}>{label}</span>
      <Icon size={19} color={urgent ? '#B87920' : primary} aria-hidden="true" />
    </span>
    <span style={{ display: 'block', fontSize: 32, fontWeight: 750, letterSpacing: -1.2, lineHeight: 1.1 }}>{value ?? '—'}</span>
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9, fontSize: 11, color: HR.muted }}>{detail}<ArrowRight size={14} aria-hidden="true" /></span>
  </button>
}

export function PeopleOverview({ data, primary, onOpen, onTab }) {
  const mobile = useIsMobile(1080)
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(8)
  const progress = indexByStaff(data.onboarding)
  const today = todayLondon()
  const active = data.people?.filter(currentPerson)
  const joining = data.people && data.onboarding ? data.people.filter(p => needsOnboarding(p, progress[p.id])) : null
  const away = data.leave?.filter(r => absenceOnDate(r, today))
  const names = Object.fromEntries((data.people || []).map(p => [p.id, p.full_name]))
  const attention = (data.attention || []).filter(i => filter === 'all' || (filter === 'urgent' ? i.severity === 1 : i.entity_type === 'compliance' || i.entity_type === 'training'))
  const upcoming = (active || []).filter(p => p.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 3)
  const pendingChecks = data.checks?.reduce((n, s) => n + checkCount(s), 0)
  return <>
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 22 }}>
      <Stat label="Active team" value={active?.length} detail="View your people" icon={Users} primary={primary} onClick={() => onTab('people', 'active')} />
      <Stat label="Onboarding" value={joining?.length} detail="People with steps to finish" icon={UserPlus} primary={primary} onClick={() => onTab('onboarding')} />
      <Stat label="Checks to review" value={pendingChecks} detail="Missing, overdue or due soon" icon={ShieldCheck} primary={primary} urgent={pendingChecks > 0} onClick={() => onTab('compliance')} />
      <Stat label="Away today" value={away ? new Set(away.map(r => r.staff_id)).size : null} detail="Leave & availability" icon={CalendarDays} primary={primary} onClick={() => onTab('absence')} />
    </div>
    {Object.keys(data.errors).length > 0 && <div style={{ marginBottom: 16 }}><LoadError message="Some HR records could not be loaded. Unavailable figures are shown as a dash." onRetry={data.reload} /></div>}
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0,1.9fr) minmax(270px,1fr)', alignItems: 'start', gap: 20 }}>
      <section style={HR.card}>
        <Title detail="The next step for each person, in priority order." action={<Badge>{data.attention?.length ?? '—'} actions</Badge>}>Needs attention</Title>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {[['all', 'All actions'], ['urgent', 'Overdue'], ['checks', 'Checks & training']].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setLimit(8) }} style={{ ...HR.button, background: filter === key ? '#F0F3F8' : '#fff', borderColor: filter === key ? '#DDE4ED' : 'transparent', fontSize: 12 }}>{label}</button>)}
        </div>
        {data.errors.attention ? <LoadError message="The action list is unavailable." onRetry={data.reload} /> : !data.attention ? <Empty title="Loading actions…" /> : attention.length === 0 ? <Empty title={filter === 'all' ? 'No actions in this queue' : 'No matching actions'} detail="You can review individual checks and onboarding from the tabs above." /> : attention.slice(0, limit).map((item, index) => {
          const [label, tone, bg] = SEVERITY[item.severity] || SEVERITY[3]
          const confidential = ['hr_case', 'disciplinary', 'warning'].includes(item.entity_type)
          return <button key={`${item.entity_type}-${item.entity_id}-${index}`} onClick={() => onOpen({ id: null, hr_staff_id: item.staff_id, full_name: item.full_name }, LINK_TABS[item.entity_type] || 'overview')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '16px 0', background: '#fff', border: 0, borderTop: `1px solid ${HR.line}`, fontFamily: 'inherit', cursor: 'pointer' }}>
            <Avatar name={item.full_name} primary={primary} size={38} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 13, fontWeight: 750, color: HR.ink }}>{item.full_name}</span><Badge tone={tone} bg={bg}>{label}</Badge></span>
              <span style={{ display: 'block', color: HR.muted, fontSize: 12, lineHeight: 1.55, marginTop: 5 }}>{confidential ? 'Confidential HR follow-up' : item.title}{item.due_date ? ` · ${ukDate(item.due_date)}` : ''}</span>
              <span style={{ display: 'block', fontSize: 12, color: primary, fontWeight: 700, marginTop: 6 }}>{ACTIONS[item.entity_type] || 'Open record'}</span>
            </span><ArrowRight size={16} color={HR.muted} aria-hidden="true" />
          </button>
        })}
        {attention.length > limit && <button style={{ ...HR.button, width: '100%', marginTop: 10 }} onClick={() => setLimit(v => v + 10)}>Show more actions ({attention.length - limit})</button>}
      </section>
      <aside style={{ display: 'grid', gap: 18 }}>
        <section style={{ ...HR.card, background: 'linear-gradient(145deg, var(--org-a05, #F3F5FA), #fff)' }}>
          <Title detail="Help your newest people get started." action={<UserPlus size={20} color={primary} aria-hidden="true" />}>Joining the team</Title>
          {data.pending > 0 && <button style={{ ...HR.button, width: '100%', justifyContent: 'space-between', marginBottom: 12 }} onClick={() => onTab('approvals')}><span>{data.pending} account{data.pending === 1 ? '' : 's'} awaiting approval</span><ArrowRight size={15} /></button>}
          {!joining && !data.errors.people && !data.errors.onboarding && <Empty title="Loading onboarding…" />}
          {joining?.slice(0, 3).map(p => <button key={p.id} onClick={() => onOpen(personLink(p), 'onboarding')} style={{ display: 'block', textAlign: 'left', background: 'transparent', border: 0, borderTop: `1px solid ${HR.line}`, padding: '13px 0', width: '100%', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: HR.ink, fontWeight: 700 }}>{p.full_name}<span style={{ color: HR.muted, fontWeight: 500 }}>{progress[p.id]?.percent ?? 0}%</span></span>
            <span style={{ display: 'block', height: 5, background: '#E8ECF3', borderRadius: 4, marginTop: 10 }}><span style={{ display: 'block', width: `${progress[p.id]?.percent ?? 0}%`, height: '100%', background: primary, borderRadius: 4 }} /></span>
          </button>)}
          {joining?.length === 0 && <p style={{ color: HR.muted, fontSize: 13 }}>No outstanding onboarding in your team.</p>}
          <button style={{ ...HR.button, width: '100%', marginTop: 8 }} onClick={() => onTab('onboarding')}>Open onboarding <ArrowRight size={15} /></button>
        </section>
        <section style={HR.card}>
          <Title detail={ukDate(today)} action={<CalendarDays size={19} color={primary} />}>Team calendar</Title>
          {away?.length === 0 && <p style={{ fontSize: 13, color: HR.muted, lineHeight: 1.6 }}>Nobody is recorded as away today.</p>}
          {away?.slice(0, 3).map(r => <button key={r.id} onClick={() => onOpen({ id: null, hr_staff_id: r.staff_id, full_name: names[r.staff_id] }, 'absence')} style={{ ...HR.button, border: 0, borderTop: `1px solid ${HR.line}`, borderRadius: 0, width: '100%', justifyContent: 'space-between', padding: '12px 0', textAlign: 'left' }}><span>{names[r.staff_id] || 'Team member'}</span><Badge>Away today</Badge></button>)}
          {upcoming.map(p => <button key={p.id} style={{ ...HR.button, width: '100%', border: 0, justifyContent: 'space-between', textAlign: 'left', padding: '12px 0' }} onClick={() => onOpen(personLink(p), 'employment')}><span>{p.full_name}<small style={{ display: 'block', color: HR.muted, marginTop: 4 }}>Starts {ukDate(p.start_date)}</small></span><ArrowRight size={14} /></button>)}
          <button style={{ ...HR.button, width: '100%', marginTop: 10 }} onClick={() => onTab('absence')}>View leave & availability</button>
        </section>
      </aside>
    </div>
  </>
}

export function PeopleDirectory({ data, primary, onOpen, initialFilter = 'all', onAdd, onAccounts, onVolunteers }) {
  const mobile = useIsMobile(1080)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(initialFilter)
  const [department, setDepartment] = useState('all')
  const summaries = indexByStaff(data.checks)
  const shown = filterPeople(data.people || [], filter, query, summaries).filter(p => department === 'all' || p.department === department)
  const departments = [...new Set((data.people || []).map(p => p.department).filter(Boolean))].sort()
  return <section style={HR.card}>
    <Title detail="Employees, volunteers and sessional workers, together." action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{onAccounts && <button onClick={onAccounts} style={HR.button}>Team access</button>}{onVolunteers && <button onClick={onVolunteers} style={HR.button}>Volunteer programme</button>}</div>}>Your people</Title>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <label style={{ flex: '1 1 230px', position: 'relative' }}><Search size={17} color={HR.muted} style={{ position: 'absolute', top: 14, left: 12 }} /><input aria-label="Search people" placeholder="Search name, role or email…" value={query} onChange={e => setQuery(e.target.value)} style={{ ...HR.input, paddingLeft: 38 }} /></label>
      <select aria-label="Filter people" value={filter} onChange={e => setFilter(e.target.value)} style={{ ...HR.input, width: 'auto', flex: '0 1 170px' }}>{[['all', 'All people'], ['active', 'Active team'], ...EMPLOYMENT_TYPES.map(t => [t.key, `${t.label}s`]), ['checks', 'Checks to review'], ['former', 'Former team']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      {departments.length > 0 && <select aria-label="Filter by department" value={department} onChange={e => setDepartment(e.target.value)} style={{ ...HR.input, width: 'auto', flex: '0 1 180px' }}><option value="all">All departments</option>{departments.map(d => <option key={d}>{d}</option>)}</select>}
    </div>
    <div aria-live="polite" style={{ fontSize: 12, color: HR.muted, marginBottom: 14 }}>{data.people ? `${shown.length} ${shown.length === 1 ? 'person' : 'people'}` : 'Loading people…'}</div>
    {data.errors.people ? <LoadError onRetry={data.reload} /> : data.people && shown.length === 0 ? <Empty title={data.people.length ? 'No matching people' : 'Build your team'} detail={data.people.length ? 'Try a different name or filter.' : 'Add your first person or invite someone to join.'} action={data.people.length ? <button style={HR.button} onClick={() => { setQuery(''); setFilter('all'); setDepartment('all') }}>Clear filters</button> : onAdd && <button style={HR.button} onClick={onAdd}>Add person</button>} /> : null}
    {data.errors.checks && <LoadError message="Check summaries are unavailable. Open a profile to review the records." onRetry={data.reload} />}
    {!mobile && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) 20px', gap: 16, fontSize: 10, fontWeight: 800, letterSpacing: 0.9, textTransform: 'uppercase', color: HR.muted, padding: '12px 8px', background: '#F8FAFC', borderRadius: 9 }}><span>Person</span><span>Employment</span><span>Status</span><span>Checks</span><span /></div>}
    {shown.map(p => {
      const count = checkCount(summaries[p.id])
      const status = statusChip(p.employment_status)
      return <button key={p.id} onClick={() => onOpen(personLink(p))} style={{ width: '100%', display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr) 20px' : 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) 20px', gap: 16, alignItems: 'center', padding: '17px 8px', border: 0, borderBottom: `1px solid ${HR.line}`, background: '#fff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}><Avatar name={p.full_name} primary={primary} /><span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 750, color: HR.ink }}>{p.full_name}</span><span style={{ display: 'block', fontSize: 12, color: HR.muted, marginTop: 4 }}>{p.job_title || p.role || 'Role not recorded'}{p.department ? ` · ${p.department}` : ''}</span>{mobile && <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}><Badge tone={status.tone} bg={status.bg}>{status.label}</Badge><Badge>{EMPLOYMENT_TYPES.find(t => t.key === p.employment_type)?.label || 'Not recorded'}</Badge><Badge>{count === null ? 'Checks unavailable' : count ? `${count} checks to review` : summaries[p.id]?.applicable > 0 ? 'Checks in place' : 'No checks assigned'}</Badge></span>}</span></span>
        {!mobile && <><span style={{ fontSize: 12, color: HR.muted }}>{EMPLOYMENT_TYPES.find(t => t.key === p.employment_type)?.label || 'Not recorded'}</span><span><Badge tone={status.tone} bg={status.bg}>{status.label}</Badge></span><span><Badge tone={count > 0 ? '#8A570A' : HR.muted} bg={count > 0 ? '#FFF6DF' : '#F1F4F8'}>{count === null ? 'Unavailable' : count ? `${count} to review` : summaries[p.id]?.applicable > 0 ? 'Checks in place' : 'No checks assigned'}</Badge></span></>}
        <ArrowRight size={16} color={HR.muted} aria-hidden="true" />
      </button>
    })}
  </section>
}

export function OnboardingBoard({ data, primary, onOpen, onApprovals }) {
  const [filter, setFilter] = useState('outstanding')
  const progress = indexByStaff(data.onboarding)
  const people = (data.people || []).filter(currentPerson)
  const shown = people.filter(p => filter === 'all' || needsOnboarding(p, progress[p.id]))
  return <section style={HR.card}>
    <Title detail="A checklist matched to each person's employment type." action={<button style={HR.button} onClick={onApprovals}>Account approvals{data.pending ? ` (${data.pending})` : ''}<ArrowRight size={15} /></button>}>Onboarding</Title>
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>{[['outstanding', 'Steps to finish'], ['all', 'All current people']].map(([key, label]) => <button key={key} aria-pressed={filter === key} style={{ ...HR.button, background: filter === key ? '#EEF2F7' : '#fff' }} onClick={() => setFilter(key)}>{label}</button>)}</div>
    {data.errors.people || data.errors.onboarding ? <LoadError onRetry={data.reload} /> : !data.people || !data.onboarding ? <Empty title="Loading onboarding…" /> : shown.length === 0 ? <Empty title="No outstanding onboarding" detail="New starters will appear here once their HR record is created." /> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: 14 }}>
      {shown.map(p => {
        const s = progress[p.id]
        return <button key={p.id} onClick={() => onOpen(personLink(p), 'onboarding')} style={{ ...HR.card, borderRadius: 13, padding: 18, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={p.full_name} primary={primary} /><span><strong style={{ fontSize: 14, color: HR.ink }}>{p.full_name}</strong><span style={{ display: 'block', fontSize: 12, color: HR.muted, marginTop: 4 }}>{EMPLOYMENT_TYPES.find(t => t.key === p.employment_type)?.label || 'Team member'}</span></span></span>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: HR.muted, margin: '18px 0 9px' }}><span>{s?.total > 0 ? `${s.done} of ${s.total} steps complete` : 'Checklist not started'}</span><strong>{s?.percent ?? 0}%</strong></span>
          <span style={{ display: 'block', height: 6, background: '#EDF1F6', borderRadius: 4 }}><span style={{ display: 'block', height: '100%', width: `${s?.percent ?? 0}%`, background: primary, borderRadius: 4 }} /></span>
          <span style={{ display: 'flex', justifyContent: 'space-between', color: primary, marginTop: 16, fontSize: 12, fontWeight: 700 }}>{s?.required_outstanding > 0 ? `${s.required_outstanding} required steps left` : s?.total > 0 ? 'Review checklist' : 'Open checklist'}<ArrowRight size={15} /></span>
        </button>
      })}
    </div>}
  </section>
}

export function OrgDocuments({ org, data, onOpen }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [retry, setRetry] = useState(0)
  const names = useMemo(() => Object.fromEntries((data.people || []).map(p => [p.id, p])), [data.people])
  useEffect(() => {
    let cancelled = false
    setRows(null); setError(false)
    // Sensitive case evidence stays in the restricted person profile. This
    // directory only reads document metadata, never file URLs or notes.
    readAll(() => supabase.from('staff_documents').select('id, staff_id, title, document_type, uploaded_at, expiry_date').eq('org_id', org.id).neq('confidentiality', 'sensitive').is('archived_at', null).order('uploaded_at', { ascending: false }).order('id'))
      .then(result => { if (!cancelled) setRows(result) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [org.id, retry])
  const shown = (rows || []).filter(d => (type === 'all' || d.document_type === type) && `${d.title} ${names[d.staff_id]?.full_name || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section style={HR.card}>
    <Title detail="Contracts, policies and evidence. Open a person to upload or manage their files." action={<FileText size={21} color={HR.muted} />}>Team documents</Title>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}><input aria-label="Search documents" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search document or person…" style={{ ...HR.input, flex: '1 1 200px' }} /><select aria-label="Document type" value={type} onChange={e => setType(e.target.value)} style={{ ...HR.input, width: 'auto', flex: '0 1 190px' }}><option value="all">All document types</option>{DOCUMENT_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {error ? <LoadError onRetry={() => setRetry(v => v + 1)} /> : !rows ? <Empty title="Loading documents…" /> : shown.length === 0 ? <Empty title="No documents to show" detail="Upload a file from the Documents section of a person's profile." /> : shown.map(d => <button key={d.id} style={{ ...HR.button, justifyContent: 'flex-start', textAlign: 'left', width: '100%', border: 0, borderBottom: `1px solid ${HR.line}`, borderRadius: 0, padding: '16px 0' }} onClick={() => onOpen({ id: names[d.staff_id]?.user_id || null, hr_staff_id: d.staff_id, full_name: names[d.staff_id]?.full_name || 'Team member' }, 'documents')}><FileText size={20} color={HR.muted} /><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', overflowWrap: 'anywhere' }}>{d.title}</span><small style={{ display: 'block', color: HR.muted, fontWeight: 400, marginTop: 5 }}>{names[d.staff_id]?.full_name || 'Team member'} · {ukDate(d.uploaded_at)}</small></span><ArrowDownToLine size={16} aria-hidden="true" /></button>)}
  </section>
}

export function AddPersonModal({ org, primary, canEdit, onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: '', email: '', job_title: '', employment_type: 'employee', start_date: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const save = async e => {
    e.preventDefault()
    if (!canEdit || busy || !form.full_name.trim()) return
    setBusy(true); setError('')
    try {
      // Link a real account via the established server function. Email is
      // used only to find that account, never to merge two HR records.
      const email = form.email.trim().toLowerCase()
      if (email) {
        const { data: existing, error: existingError } = await supabase.from('hr_staff').select('id, user_id, full_name').eq('org_id', org.id).eq('email', email).limit(1)
        if (existingError) throw existingError
        if (existing?.length) { onSaved(personLink(existing[0]), 'overview'); return }
        const { data: account, error: accountError } = await supabase.from('user_profiles').select('id, full_name').eq('org_id', org.id).eq('email', email).maybeSingle()
        if (accountError) throw accountError
        if (account) {
          const { data: staffId, error: ensureError } = await supabase.rpc('hr_ensure_staff_record', { p_user_id: account.id })
          if (ensureError) throw ensureError
          onSaved({ id: account.id, hr_staff_id: staffId, full_name: account.full_name }, 'employment')
          return
        }
      }
      const { data: person, error: saveError } = await supabase.from('hr_staff').insert({ org_id: org.id, full_name: form.full_name.trim(), email: email || null, job_title: form.job_title.trim() || null, role: form.job_title.trim() || 'Team member', employment_type: form.employment_type, start_date: form.start_date || null, employment_status: 'active', is_active: true }).select('id, user_id, full_name').single()
      if (saveError) throw saveError
      onSaved(personLink(person), 'onboarding')
    } catch (err) { setError(err.message || 'Could not add this person.') }
    finally { setBusy(false) }
  }
  return <PeopleDialog title="Add a person" onClose={busy ? undefined : onClose}>
    <p style={{ fontSize: 13, color: HR.muted, lineHeight: 1.6, marginTop: 0 }}>Create their HR record, then complete their onboarding. You can invite them to sign in separately.</p>
    <form aria-label="Add person details" onSubmit={save} style={{ display: 'grid', gap: 14 }}>
      {[['full_name', 'Full name', 'text'], ['email', 'Email (optional)', 'email'], ['job_title', 'Job title', 'text'], ['start_date', 'Start date', 'date']].map(([key, label, type]) => <label key={key} style={{ color: HR.ink, fontSize: 12, fontWeight: 700 }}>{label}<input type={type} required={key === 'full_name'} value={form[key]} onChange={set(key)} style={{ ...HR.input, marginTop: 6 }} /></label>)}
      <label style={{ color: HR.ink, fontSize: 12, fontWeight: 700 }}>Employment type<select value={form.employment_type} onChange={set('employment_type')} style={{ ...HR.input, marginTop: 6 }}>{EMPLOYMENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
      {error && <LoadError message={error} />}
      <button type="submit" disabled={busy || !canEdit} style={{ ...HR.button, background: primary, border: 0, color: '#fff', opacity: busy ? 0.6 : 1 }}><ClipboardCheck size={17} />{busy ? 'Saving…' : 'Save & open record'}</button>
    </form>
  </PeopleDialog>
}

export function ProfileSummary({ staff, compliance, onboarding, primary, lineManager, onTab, warning }) {
  return <>
    {warning && <LoadError message="Some checks or onboarding details could not be loaded. Open the relevant section to retry." />}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px),1fr))', gap: 12, margin: '18px 0' }}>
      {[
        ['compliance', ShieldCheck, 'Checks & training', !compliance ? 'Summary unavailable' : checkCount(compliance) ? `${checkCount(compliance)} checks to review` : compliance.applicable > 0 ? 'Recorded checks in place' : 'No requirements assigned', compliance ? `${compliance.overdue} overdue · ${compliance.missing} missing · ${compliance.due_soon} due soon` : 'Open the underlying records'],
        ['onboarding', ClipboardCheck, 'Onboarding', onboarding?.total > 0 ? `${onboarding.done} of ${onboarding.total} steps complete` : 'Checklist not started', onboarding?.required_outstanding > 0 ? `${onboarding.required_outstanding} required steps remaining` : 'Review induction and documents'],
      ].map(([key, Icon, label, value, detail]) => <button key={key} onClick={() => onTab(key)} style={{ ...HR.card, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}><span style={{ display: 'flex', justifyContent: 'space-between', color: primary, fontSize: 12, fontWeight: 700 }}><span>{label}</span><Icon size={18} /></span><strong style={{ display: 'block', margin: '14px 0 8px', color: HR.ink, fontSize: 15 }}>{value}</strong><span style={{ display: 'block', color: HR.muted, fontSize: 12, lineHeight: 1.6 }}>{detail}</span></button>)}
    </div>
    <section style={HR.card}><Title detail="Employment details and the next steps in one place." action={<button style={HR.button} onClick={() => onTab('employment')}>View employment <ArrowRight size={15} /></button>}>At a glance</Title>
      {[
        ['Employment type', EMPLOYMENT_TYPES.find(t => t.key === staff.employment_type)?.label], ['Department', staff.department], ['Line manager', lineManager?.full_name], ['Start date', ukDate(staff.start_date)], ['Contract', staff.contract_type], ['Emergency contact', staff.emergency_contact_name ? `${staff.emergency_contact_name}${staff.emergency_contact_phone ? ` · ${staff.emergency_contact_phone}` : ''}` : null], ['Account', staff.user_id ? 'Connected to a login' : 'HR record only'],
      ].map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderTop: `1px solid ${HR.line}`, padding: '13px 0', fontSize: 13 }}><span style={{ color: HR.muted }}>{label}</span><span style={{ color: HR.ink, fontWeight: 600, overflowWrap: 'anywhere' }}>{value || 'Not recorded'}</span></div>)}
      <p style={{ color: HR.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}><Check size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Check the individual requirements and your organisation's policy before confirming someone is ready to work.</p>
    </section>
  </>
}
