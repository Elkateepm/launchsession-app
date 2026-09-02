import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useHrAccess, ukDate, EMPLOYMENT_TYPES, statusChip } from '../../lib/hrAccess'
import StaffHRProfile from './StaffHRProfile'
import { InviteStaffModal } from './HRCentre'

// The HR home screen: what needs doing, and everyone it could be about.
//
// Team remains the entry point for a person -- this is the organisation-wide
// view over the same records. Both open the same StaffHRProfile, so there is
// one staff record and two ways in, not two records.

const card = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
  padding: 16, marginBottom: 12,
}
const gBtn = {
  minHeight: 44, padding: '0 14px', borderRadius: 11, border: '1px solid #E2E8F0',
  background: '#fff', color: '#64748B', fontSize: 13.5, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

const SEVERITY = {
  1: { tone: '#B42318', bg: '#FEF2F2', label: 'Overdue' },
  2: { tone: '#93500A', bg: '#FEF6E7', label: 'Due' },
  3: { tone: '#3730A3', bg: '#EEF2FF', label: 'Soon' },
}

const FILTERS = [
  ['all', 'All'], ['employee', 'Employees'], ['sessional', 'Sessional'],
  ['volunteer', 'Volunteers'], ['probation', 'On probation'],
  ['compliance', 'Compliance issue'], ['cases', 'Open HR case'],
  ['leaving', 'Leaving'], ['left', 'Former staff'],
]

export default function HRHome({ org, session, userProfile, onNavigate }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#3B82F6'
  const access = useHrAccess(userProfile?.role)

  const [tab, setTab] = useState('overview')
  const [openPerson, setOpenPerson] = useState(null)
  const [inviting, setInviting] = useState(false)

  if (access.loading) {
    return <div style={{ padding: 24, color: '#64748B', fontSize: 14 }}>Loading…</div>
  }

  if (!access.canView) {
    return (
      <div style={{ background: '#F8FAFC', minHeight: '100%', padding: 24 }}>
        <div style={{ ...card, textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
            You do not have HR access
          </div>
          <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6 }}>
            HR records are granted per person by an administrator, under
            Settings → Role Access. Managers who are granted it see only the people
            they line-manage.
          </div>
        </div>
      </div>
    )
  }

  const TABS = [
    ['overview', 'Overview'], ['people', 'People'], ['outcomes', 'Outcomes'],
    ...(access.isAdmin ? [['audit', 'Audit']] : []),
  ]

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100%', padding: isMobile ? 16 : 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>
            HR &amp; Staff
          </div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 3 }}>
            Employment records, compliance and casework for {org?.name}.
          </div>
        </div>
        {access.isAdmin && (
          <button onClick={() => setInviting(true)} style={{
            minHeight: 44, padding: '0 16px', borderRadius: 11, border: 'none',
            background: primary, color: '#fff', fontSize: 14, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Invite staff</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '9px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            border: `1px solid ${tab === k ? 'transparent' : '#E2E8F0'}`,
            background: tab === k ? primary : '#fff',
            color: tab === k ? '#fff' : '#64748B',
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && <Overview primary={primary} onOpen={setOpenPerson} />}
      {tab === 'people' && <People org={org} primary={primary} onOpen={setOpenPerson} />}
      {tab === 'outcomes' && <Outcomes org={org} sensitiveView={access.sensitiveView} />}
      {tab === 'audit' && <AuditLog org={org} />}

      {openPerson && (
        <StaffHRProfile org={org} userProfile={userProfile} person={openPerson}
          onClose={() => setOpenPerson(null)} />
      )}

      {inviting && (
        <InviteStaffModal org={org} primary={primary}
          onClose={() => setInviting(false)} onSent={() => setInviting(false)} />
      )}
    </div>
  )
}

function Stat({ label, value, hint, tone }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
      padding: 14, minWidth: 0,
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: tone || '#0F172A', marginTop: 4, letterSpacing: -0.8 }}>
        {value === null || value === undefined ? '—' : value}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function Overview({ primary, onOpen }) {
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [s, a] = await Promise.all([
      supabase.from('hr_dashboard_stats').select('*').maybeSingle(),
      supabase.from('hr_needs_attention').select('*')
        .order('severity').order('due_date', { nullsFirst: false }).limit(60),
    ])
    // A failed stats query must not take the attention list down with it --
    // the list is the part somebody acts on.
    if (s.error && a.error) { setError(a.error.message); setItems([]); return }
    setStats(s.error ? null : s.data)
    setItems(a.error ? [] : (a.data || []))
    if (a.error) setError(a.error.message)
  }, [])

  useEffect(() => { load() }, [load])

  // Deliberately no zeros before the data lands: a confident "0 open cases"
  // that turns into 3 a moment later is worse than a dash.
  if (items === null) {
    return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading HR overview…</div>
  }

  const byStaff = items.reduce((acc, i) => {
    (acc[i.staff_id] = acc[i.staff_id] || { name: i.full_name, staff_id: i.staff_id, items: [] }).items.push(i)
    return acc
  }, {})
  const groups = Object.values(byStaff)
    .sort((a, b) => Math.min(...a.items.map(i => i.severity)) - Math.min(...b.items.map(i => i.severity)))

  return (
    <>
      <div style={{
        display: 'grid', gap: 10, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      }}>
        <Stat label="Active staff" value={stats?.active_staff} />
        <Stat label="Volunteers / sessional" value={stats?.volunteers_sessional} />
        <Stat label="Compliance" value={stats?.compliance_percent === null || stats?.compliance_percent === undefined ? null : stats.compliance_percent + '%'}
          hint={stats ? `${stats.compliance_outstanding} outstanding` : null}
          tone={stats && stats.compliance_percent < 80 ? '#B42318' : undefined} />
        <Stat label="Open HR cases" value={stats?.open_cases} />
        <Stat label="Active disciplinaries" value={stats?.active_disciplinaries} />
        <Stat label="Training due" value={stats?.training_due} hint="next 30 days" />
        <Stat label="Absent today" value={stats?.absent_today} />
        <Stat label="Probation reviews" value={stats?.probation_due} hint="next 30 days" />
      </div>

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
          <button onClick={load} style={{ ...gBtn, marginLeft: 10 }}>Try again</button>
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', margin: '18px 0 10px' }}>
        Needs attention
      </div>

      {groups.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>
          Nothing outstanding. Everyone is currently compliant and no case is waiting on a decision.
        </div>
      )}

      {groups.map(g => (
        <div key={g.staff_id} style={card}>
          <button onClick={() => onOpen({ id: null, hr_staff_id: g.staff_id, full_name: g.name })}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left', marginBottom: 8,
            }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>{g.name}</span>
            <span style={{ fontSize: 12.5, color: '#94A3B8', marginLeft: 8 }}>
              {g.items.length} item{g.items.length === 1 ? '' : 's'}
            </span>
          </button>
          {g.items.slice(0, 6).map((i, n) => {
            const sev = SEVERITY[i.severity] || SEVERITY[3]
            return (
              <div key={i.entity_type + i.entity_id + n} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 0', borderTop: '1px solid #F1F5F9',
              }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                  background: sev.bg, color: sev.tone, fontSize: 11, fontWeight: 800,
                }}>{sev.label}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: '#0F172A', fontWeight: 600 }}>{i.title}</div>
                  <div style={{ fontSize: 12.5, color: '#64748B' }}>{i.detail}</div>
                </div>
              </div>
            )
          })}
          {g.items.length > 6 && (
            <div style={{ fontSize: 12, color: '#94A3B8', paddingTop: 8 }}>
              and {g.items.length - 6} more
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function People({ org, primary, onOpen }) {
  const [rows, setRows] = useState(null)
  const [summaries, setSummaries] = useState({})
  const [cases, setCases] = useState({})
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [s, c, hc] = await Promise.all([
      supabase.from('hr_staff').select('*').eq('org_id', org.id).order('full_name'),
      supabase.from('hr_staff_compliance_summary').select('*').eq('org_id', org.id),
      supabase.from('hr_cases').select('staff_id').eq('org_id', org.id)
        .not('status', 'in', '(resolved,closed)'),
    ])
    if (s.error) { setError(s.error.message); setRows([]); return }
    setRows(s.data || [])
    setSummaries(Object.fromEntries((c.data || []).map(r => [r.staff_id, r])))
    setCases((hc.data || []).reduce((a, r) => ({ ...a, [r.staff_id]: (a[r.staff_id] || 0) + 1 }), {}))
  }, [org?.id])

  useEffect(() => { load() }, [load])

  if (rows === null) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading people…</div>

  const shown = rows.filter(r => {
    if (filter === 'employee' || filter === 'sessional' || filter === 'volunteer') {
      if (r.employment_type !== filter) return false
    }
    if (filter === 'probation' && r.probation_status !== 'in_progress') return false
    if (filter === 'leaving' && r.employment_status !== 'leaving') return false
    if (filter === 'left' && r.employment_status !== 'left') return false
    if (filter === 'compliance') {
      const s = summaries[r.id]
      if (!s || (s.overdue === 0 && s.missing === 0)) return false
    }
    if (filter === 'cases' && !cases[r.id]) return false
    if (filter !== 'left' && r.employment_status === 'left') return false
    const t = q.trim().toLowerCase()
    if (t && ![r.full_name, r.email, r.job_title].filter(Boolean).join(' ').toLowerCase().includes(t)) return false
    return true
  })

  return (
    <>
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search by name, email or job title"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
          border: '1px solid #E2E8F0', fontSize: 15, fontFamily: 'inherit', outline: 'none',
          background: '#fff', marginBottom: 12,
        }} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '7px 12px', borderRadius: 99, cursor: 'pointer', minHeight: 40,
            border: `1px solid ${filter === k ? 'transparent' : '#E2E8F0'}`,
            background: filter === k ? '#0F172A' : '#fff',
            color: filter === k ? '#fff' : '#64748B',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
          }}>{l}</button>
        ))}
      </div>

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
        </div>
      )}

      {shown.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5 }}>
          Nobody matches that.
        </div>
      )}

      {shown.map(p => {
        const s = summaries[p.id]
        const chip = statusChip(p.employment_status)
        const et = EMPLOYMENT_TYPES.find(t => t.key === p.employment_type)
        return (
          <button key={p.id} onClick={() => onOpen({ id: p.user_id, hr_staff_id: p.id, full_name: p.full_name, photo_url: null })}
            style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: primary,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 15,
              }}>{(p.full_name || '?').slice(0, 1).toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>{p.full_name}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 1 }}>
                  {p.job_title || et?.label || 'Staff'}
                  {p.department ? ` · ${p.department}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, background: chip.bg, color: chip.tone, fontSize: 11, fontWeight: 800 }}>
                    {chip.label}
                  </span>
                  {s && s.percent !== null && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 800,
                      background: s.overdue || s.missing ? '#FEF2F2' : '#E7F8ED',
                      color: s.overdue || s.missing ? '#B42318' : '#04713C',
                    }}>{s.percent}% compliant</span>
                  )}
                  {cases[p.id] > 0 && (
                    <span style={{ padding: '2px 8px', borderRadius: 99, background: '#FEF6E7', color: '#93500A', fontSize: 11, fontWeight: 800 }}>
                      {cases[p.id]} open case{cases[p.id] === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </>
  )
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
      <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>
        Outcomes and warnings need disciplinary access, which an administrator grants
        separately from ordinary HR access.
      </div>
    )
  }

  if (warnings === null) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading outcomes…</div>

  const shown = warnings.filter(w =>
    view === 'active' ? w.effective_status === 'active' : w.effective_status !== 'active')

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['active', 'Active'], ['historical', 'Historical']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} style={{
            padding: '8px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            border: `1px solid ${view === k ? 'transparent' : '#E2E8F0'}`,
            background: view === k ? '#0F172A' : '#fff',
            color: view === k ? '#fff' : '#64748B',
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          }}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5 }}>
          {view === 'active' ? 'No active warnings.' : 'Nothing in the history yet.'}
        </div>
      )}

      {shown.map(w => (
        <div key={w.id} style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
            {String(w.warning_type).replace('_', ' ')} warning
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
            Issued {ukDate(w.issued_date)}
            {w.expiry_date ? ` · expires ${ukDate(w.expiry_date)}` : ' · no expiry'}
            {w.decision_maker_name ? ` · ${w.decision_maker_name}` : ''}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 800,
              textTransform: 'capitalize',
              background: w.effective_status === 'active' ? '#FEF2F2' : '#F3F2F7',
              color: w.effective_status === 'active' ? '#B42318' : '#5A5772',
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

  if (rows === null) return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading audit trail…</div>
  if (rows.length === 0) {
    return <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5 }}>
      Nothing recorded yet.
    </div>
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 12.5, color: '#94A3B8', marginBottom: 10, lineHeight: 1.5 }}>
        Who changed what, and when. Summaries deliberately carry no case detail — an
        allegation or a medical note has no business in a log this many people can read.
      </div>
      {rows.map(r => (
        <div key={r.id} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>
            {new Date(r.created_at).toLocaleString('en-GB', {
              timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short',
            })}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, color: '#0F172A' }}>{r.summary || r.action}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>
              {r.entity_type} · {String(r.action).replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
