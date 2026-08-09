import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import ProjectWizard, { PROJECT_TYPES } from './ProjectWizard'

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtRange = (a, b) => {
  const d1 = new Date(`${a}T12:00:00`), d2 = new Date(`${b}T12:00:00`)
  const sameMonth = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()
  const o = { day: 'numeric', month: 'short' }
  return sameMonth
    ? `${d1.getDate()}–${d2.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`
    : `${d1.toLocaleDateString('en-GB', o)} – ${d2.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`
}

const card = (extra = {}) => ({
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
  boxShadow: '0 4px 16px -12px rgba(15,23,42,0.18)', ...extra,
})

const FILTERS = [
  { key: 'active', label: 'Active & upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
]

function deriveStatus(project) {
  if (project.status === 'archived' || project.status === 'cancelled') return project.status
  const t = todayISO()
  if (project.end_date < t) return 'completed'
  if (project.start_date <= t) return 'active'
  return 'upcoming'
}

function StatusChip({ status }) {
  const map = {
    draft: { t: 'Draft', c: '#64748B', b: '#F1F5F9' },
    upcoming: { t: 'Upcoming', c: '#1D4ED8', b: '#EFF6FF' },
    active: { t: 'Active', c: '#15803D', b: '#DCFCE7' },
    completed: { t: 'Completed', c: '#64748B', b: '#F1F5F9' },
    cancelled: { t: 'Cancelled', c: '#B91C1C', b: '#FEE2E2' },
    archived: { t: 'Archived', c: '#64748B', b: '#F1F5F9' },
  }
  const m = map[status] || map.draft
  return <span style={{ fontSize: 10.5, fontWeight: 800, color: m.c, background: m.b, borderRadius: 99, padding: '3px 9px', flexShrink: 0 }}>{m.t}</span>
}

export default function ProjectsList({ org, session, onNavigate }) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [dayCounts, setDayCounts] = useState({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [showWizard, setShowWizard] = useState(false)

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const { data: projs } = await supabase.from('projects').select('*')
      .eq('org_id', org.id).order('start_date', { ascending: false })
    setProjects(projs || [])

    const ids = (projs || []).map(p => p.id)
    if (ids.length) {
      const { data: sess } = await supabase.from('sessions').select('project_id').in('project_id', ids)
      const counts = {}
      ;(sess || []).forEach(s => { counts[s.project_id] = (counts[s.project_id] || 0) + 1 })
      setDayCounts(counts)
    } else {
      setDayCounts({})
    }
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = projects.map(p => ({ ...p, _status: deriveStatus(p) }))
    if (filter === 'active') list = list.filter(p => p._status === 'active' || p._status === 'upcoming' || p._status === 'draft')
    else if (filter === 'completed') list = list.filter(p => p._status === 'completed')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    }
    return list
  }, [projects, filter, search])

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 28 }}>
        <div style={{ height: 28, width: 200, background: '#F1F5F9', borderRadius: 8, marginBottom: 20 }} />
        {[0, 1, 2].map(i => <div key={i} style={{ height: 84, background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 28, width: '100%', maxWidth: '100%', margin: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0F172A', letterSpacing: -0.6 }}>Projects</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748B', fontWeight: 500 }}>
            Multi-day programmes, holiday clubs, and trips — grouped and tracked together.
          </p>
        </div>
        <button onClick={() => setShowWizard(true)} style={{
          padding: '11px 18px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#6D5DF6,#5B8DEF)', color: '#fff',
          fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ New Project</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
          style={{ flex: 1, minWidth: 180, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '8px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: filter === f.key ? '2px solid #6D5DF6' : '1.5px solid #E2E8F0',
              background: filter === f.key ? '#F5F3FF' : '#fff', color: filter === f.key ? '#6D5DF6' : '#334155',
              whiteSpace: 'nowrap',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={card({ padding: 40, textAlign: 'center' })}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
            {projects.length === 0 ? 'No projects yet' : 'No projects match'}
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: projects.length === 0 ? 16 : 0 }}>
            {projects.length === 0
              ? 'Group a holiday club, residential, or multi-day trip into one place.'
              : 'Try a different search or filter.'}
          </div>
          {projects.length === 0 && (
            <button onClick={() => setShowWizard(true)} style={{
              padding: '11px 20px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#6D5DF6,#5B8DEF)', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>+ New Project</button>
          )}
        </div>
      ) : (
        <div style={isMobile
          ? { display: 'flex', flexDirection: 'column', gap: 10 }
          : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {filtered.map(p => {
            const typeLabel = PROJECT_TYPES.find(t => t.key === p.project_type)?.label || 'Project'
            const days = dayCounts[p.id] || 0
            return (
              <button key={p.id} onClick={() => onNavigate && onNavigate('projects', { projectId: p.id })}
                style={{ ...card({ padding: 16 }), width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                    <StatusChip status={p._status} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 99, padding: '2px 8px' }}>{typeLabel}</span>
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A' }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600, marginTop: 2 }}>
                    {fmtRange(p.start_date, p.end_date)} · {days} {days === 1 ? 'day' : 'days'}
                  </div>
                </div>
                <span style={{ color: '#CBD5E1', fontSize: 18 }}>›</span>
              </button>
            )
          })}
        </div>
      )}

      {showWizard && (
        <ProjectWizard
          org={org} session={session}
          onClose={() => setShowWizard(false)}
          onCreated={(project) => {
            setShowWizard(false)
            load()
            if (onNavigate) onNavigate('projects', { projectId: project.id })
          }}
        />
      )}
    </div>
  )
}
