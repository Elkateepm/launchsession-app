import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Avatar, CountUp, glass, inputStyle, btnPrimary, btnGhost, PAGE_BG } from '../volunteers/vh_shared'
import { STATUSES, STATUS_LABELS, RISK_LEVELS, RiskBadge, StatusChip, DonutChart, timeAgo } from './cm_shared'
import CaseTimeline from './CaseTimeline'
import CaseTasks from './CaseTasks'
import CaseDocuments from './CaseDocuments'
import CaseCreationWizard from './CaseCreationWizard'
import CaseReportModal, { exportCasesToCSV } from './CaseReports'

const RISK_SCORE = { low: 1, medium: 2, high: 3, critical: 4 }

export default function CaseManagement({ org, session: authSession, onNavigate, initialOpenCaseId }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'

  const [cases, setCases] = useState([])
  const [staff, setStaff] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: 'all', risk: 'all', assignee: 'all', category: 'all', requiresDsl: false, archived: false })
  const [sortBy, setSortBy] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showQuickMenu, setShowQuickMenu] = useState(false)
  const [reportFor, setReportFor] = useState(null)
  const [tab, setTab] = useState('timeline')
  const [linkedChild, setLinkedChild] = useState(null)
  const [ackSaving, setAckSaving] = useState(false)
  const [rowMenuFor, setRowMenuFor] = useState(null)

  const loadAll = useCallback(async () => {
    const [{ data: cs }, { data: st }, { data: audit }] = await Promise.all([
      supabase.from('cases').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, role, photo_url').eq('org_id', org.id).in('role', ['admin', 'staff']),
      supabase.from('case_audit_log').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(8),
    ])
    setCases(cs || [])
    setStaff(st || [])
    setRecentActivity(audit || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (!selectedCase?.child_id) { setLinkedChild(null); return }
    supabase.from('children').select('*').eq('id', selectedCase.child_id).single().then(({ data }) => setLinkedChild(data))
  }, [selectedCase?.child_id])

  // keep selectedCase in sync with the cases list after updates
  useEffect(() => {
    if (selectedCase) {
      const fresh = cases.find(c => c.id === selectedCase.id)
      if (fresh && fresh !== selectedCase) setSelectedCase(fresh)
    }
  }, [cases]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link from Safeguarding: a concern was just escalated into this case, open it.
  useEffect(() => {
    if (!initialOpenCaseId || cases.length === 0) return
    const match = cases.find(c => c.id === initialOpenCaseId)
    if (match) { setSelectedCase(match); setTab('timeline') }
  }, [initialOpenCaseId, cases])

  const logAudit = async (caseId, action, detail) => {
    await supabase.from('case_audit_log').insert({ case_id: caseId, org_id: org.id, action, detail, actor_id: authSession?.user?.id })
    loadAll()
  }

  const updateCase = async (caseId, patch, auditAction, auditDetail) => {
    const { data } = await supabase.from('cases').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', caseId).select().single()
    if (data) {
      setCases(cs => cs.map(c => c.id === caseId ? data : c))
      if (auditAction) logAudit(caseId, auditAction, auditDetail)
    }
    return data
  }

  const changeStatus = (cas, status) => {
    updateCase(cas.id, { status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) }, 'edited', `Status changed to ${STATUS_LABELS[status] || status}`)
    supabase.from('case_events').insert({ case_id: cas.id, org_id: org.id, event_type: 'status_changed', body: `Status changed to ${STATUS_LABELS[status] || status}`, created_by: authSession?.user?.id })
  }

  const ackRisk = async (cas) => {
    setAckSaving(true)
    await updateCase(cas.id, { risk_ack_by: authSession?.user?.id, risk_ack_at: new Date().toISOString() }, 'edited', 'Risk level acknowledged by manager')
    setAckSaving(false)
  }

  // ---- derived data ----
  const filteredCases = useMemo(() => {
    let list = cases.filter(c => filters.archived ? c.archived : !c.archived)
    if (filters.status !== 'all') list = list.filter(c => c.status === filters.status)
    if (filters.risk !== 'all') list = list.filter(c => (c.risk_level || c.priority) === filters.risk)
    if (filters.assignee !== 'all') list = list.filter(c => c.assigned_to_user_id === filters.assignee)
    if (filters.category !== 'all') list = list.filter(c => (c.category || c.case_type) === filters.category)
    if (filters.requiresDsl) list = list.filter(c => c.requires_dsl)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.child_name?.toLowerCase().includes(q) ||
        c.id?.toLowerCase().includes(q) ||
        c.summary?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.case_type?.toLowerCase().includes(q) ||
        c.assigned_to?.toLowerCase().includes(q)
      )
    }
    const sorters = {
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      priority: (a, b) => (RISK_SCORE[b.risk_level || b.priority] || 0) - (RISK_SCORE[a.risk_level || a.priority] || 0),
      updated: (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at),
      name: (a, b) => (a.child_name || '').localeCompare(b.child_name || ''),
      risk: (a, b) => (RISK_SCORE[b.risk_level || b.priority] || 0) - (RISK_SCORE[a.risk_level || a.priority] || 0),
    }
    list = [...list].sort(sorters[sortBy] || sorters.newest)
    // pinned always float to top
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    return list
  }, [cases, filters, search, sortBy])

  const activeCases = useMemo(() => cases.filter(c => !['closed', 'archived'].includes(c.status)), [cases])

  const kpis = useMemo(() => {
    const byStatus = (s) => cases.filter(c => c.status === s && !c.archived).length
    const thisMonth = cases.filter(c => new Date(c.created_at).getMonth() === new Date().getMonth() && new Date(c.created_at).getFullYear() === new Date().getFullYear())
    const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
    const lastMonth = cases.filter(c => new Date(c.created_at).getMonth() === lastMonthDate.getMonth() && new Date(c.created_at).getFullYear() === lastMonthDate.getFullYear())
    return {
      open: byStatus('open'), inProgress: byStatus('in_progress'), monitoring: byStatus('monitoring'),
      resolvedThisMonth: cases.filter(c => c.resolved_at && new Date(c.resolved_at).getMonth() === new Date().getMonth()).length,
      closed: byStatus('closed'),
      trend: thisMonth.length - lastMonth.length,
    }
  }, [cases])

  const riskDonut = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 }
    activeCases.forEach(c => { const r = c.risk_level || c.priority || 'medium'; if (counts[r] !== undefined) counts[r]++ })
    return [
      { label: 'High Risk', value: counts.high + counts.critical, color: '#EF4444' },
      { label: 'Medium Risk', value: counts.medium, color: '#F59E0B' },
      { label: 'Low Risk', value: counts.low, color: '#22C55E' },
    ].filter(s => s.value > 0)
  }, [activeCases])

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const bulkArchive = async () => { for (const id of selectedIds) await updateCase(id, { archived: true }, 'edited', 'Archived via bulk action'); setSelectedIds(new Set()) }
  const bulkClose = async () => { for (const id of selectedIds) await updateCase(id, { status: 'closed' }, 'closed', 'Closed via bulk action'); setSelectedIds(new Set()) }
  const bulkExport = () => exportCasesToCSV(cases.filter(c => selectedIds.has(c.id)))

  const categories = useMemo(() => [...new Set(cases.map(c => c.category || c.case_type).filter(Boolean))], [cases])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>Loading case management…</div>

  const criticalActive = activeCases.filter(c => c.risk_level === 'critical' || c.priority === 'critical')

  return (
    <div style={{ background: PAGE_BG, minHeight: '100%', padding: isMobile ? '16px 12px 80px' : '20px 24px' }}>

      {/* Emergency banner for any critical, un-acknowledged case */}
      <AnimatePresence>
        {criticalActive.some(c => !c.risk_ack_at) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', borderRadius: 16, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 24px rgba(239,68,68,0.35)' }}>
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ fontSize: 20 }}>🚨</motion.span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 13.5 }}>Critical risk case{criticalActive.filter(c => !c.risk_ack_at).length > 1 ? 's' : ''} requiring immediate manager acknowledgement</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{criticalActive.filter(c => !c.risk_ack_at).map(c => c.child_name).join(', ')}</div>
            </div>
            <button onClick={() => { const c = criticalActive.find(c => !c.risk_ack_at); setSelectedCase(c); setTab('timeline') }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 12.5, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>Review Now →</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 10 }}>🛡️ Case Management</div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 4 }}>Track, investigate and resolve safeguarding concerns.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowQuickMenu(s => !s)} style={btnGhost}>⋯ Quick Actions</button>
            <AnimatePresence>
              {showQuickMenu && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,0.15)', border: '1px solid rgba(15,23,42,0.06)', padding: 6, width: 200, zIndex: 50 }}>
                  {[
                    ['📋 Record Concern', () => setShowWizard(true)],
                    ['📎 Upload Evidence', () => { if (selectedCase) setTab('documents'); else alert('Select a case first') }],
                    ['📄 Generate Report', () => { if (selectedCase) setReportFor(selectedCase); else alert('Select a case first') }],
                    ['⬇ Export Cases (CSV)', () => exportCasesToCSV(filteredCases)],
                  ].map(([label, fn]) => (
                    <button key={label} onClick={() => { fn(); setShowQuickMenu(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>{label}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => setShowWizard(true)} style={btnPrimary(primary)}>+ Open New Case</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Open Cases', value: kpis.open, icon: '📂', color: '#7C5CFC', trend: kpis.trend },
          { label: 'In Progress', value: kpis.inProgress, icon: '⏳', color: '#F59E0B' },
          { label: 'Monitoring', value: kpis.monitoring, icon: '👁️', color: '#3B82F6' },
          { label: 'Resolved This Month', value: kpis.resolvedThisMonth, icon: '✅', color: '#22C55E' },
          { label: 'Closed', value: kpis.closed, icon: '📥', color: '#64748B' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            whileHover={{ y: -2 }} style={{ ...glass({ padding: '16px 16px' }) }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{k.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color, lineHeight: 1 }}><CountUp value={k.value} /></div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, marginTop: 4 }}>{k.label}</div>
            {typeof k.trend === 'number' && (
              <div style={{ fontSize: 10.5, color: k.trend >= 0 ? '#DC2626' : '#15803D', fontWeight: 700, marginTop: 4 }}>{k.trend >= 0 ? '↑' : '↓'} {Math.abs(k.trend)} from last month</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* SEARCH + FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search cases by child, case ID, keyword…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={{ ...inputStyle, width: 150 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 130 }} value={filters.risk} onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))}>
          <option value="all">All Risk</option>
          {RISK_LEVELS.map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 150 }} value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 150 }} value={filters.assignee} onChange={e => setFilters(f => ({ ...f, assignee: e.target.value }))}>
          <option value="all">All Assigned To</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 150 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="newest">Sort: Newest</option>
          <option value="priority">Sort: Priority</option>
          <option value="updated">Sort: Last Updated</option>
          <option value="name">Sort: Child Name</option>
          <option value="risk">Sort: Risk Score</option>
        </select>
        <button onClick={() => setShowFilters(s => !s)} style={btnGhost}>▽ More</button>
      </div>
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, padding: '10px 4px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" checked={filters.requiresDsl} onChange={e => setFilters(f => ({ ...f, requiresDsl: e.target.checked }))} /> Requires DSL
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" checked={filters.archived} onChange={e => setFilters(f => ({ ...f, archived: e.target.checked }))} /> Show archived only
              </label>
              <button onClick={() => setFilters({ status: 'all', risk: 'all', assignee: 'all', category: 'all', requiresDsl: false, archived: false })} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>Clear filters</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${primary}10`, border: `1.5px solid ${primary}30`, borderRadius: 12, padding: '8px 14px', marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: primary }}>{selectedIds.size} selected</span>
            <button onClick={bulkArchive} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>Archive</button>
            <button onClick={bulkClose} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>Close</button>
            <button onClick={bulkExport} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>Export</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12, marginLeft: 'auto' }}>Clear</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN 3-COLUMN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : selectedCase ? '1.1fr 1.4fr 0.8fr' : '1fr 0.55fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT: case list */}
        {(!isMobile || !selectedCase) && (
          <div style={glass({ padding: 0, overflow: 'hidden' })}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>Cases ({filteredCases.length})</div>
            {filteredCases.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{cases.length === 0 ? 'No cases yet' : 'No matching cases'}</div>
                <div style={{ fontSize: 12.5, color: '#94A3B8' }}>{cases.length === 0 ? 'Cases are opened when concerns are raised about a young person' : 'Try adjusting your search or filters'}</div>
              </div>
            ) : (
              <div style={{ maxHeight: isMobile ? 'none' : 620, overflowY: 'auto' }}>
                {filteredCases.map(cas => {
                  const assignedStaff = staff.find(s => s.id === cas.assigned_to_user_id)
                  const isSelected = selectedCase?.id === cas.id
                  return (
                    <motion.div key={cas.id} layout onClick={() => { setSelectedCase(cas); setTab('timeline') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer', background: isSelected ? `${primary}0c` : 'transparent', borderLeft: `3px solid ${isSelected ? primary : 'transparent'}` }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F8FAFC' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                      <input type="checkbox" checked={selectedIds.has(cas.id)} onClick={e => e.stopPropagation()} onChange={() => toggleSelect(cas.id)} style={{ flexShrink: 0 }} />
                      <Avatar name={cas.child_name} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cas.pinned && <span style={{ fontSize: 10 }}>📌</span>}
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cas.child_name}</div>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cas.category || cas.case_type} · {assignedStaff?.full_name || 'Unassigned'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <RiskBadge level={cas.risk_level || cas.priority} />
                        <StatusChip status={cas.status} />
                      </div>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); setRowMenuFor(rowMenuFor === cas.id ? null : cas.id) }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 15, padding: 4 }}>⋯</button>
                        <AnimatePresence>
                          {rowMenuFor === cas.id && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(15,23,42,0.06)', padding: 4, width: 150, zIndex: 60 }}>
                              {[
                                [cas.pinned ? '📌 Unpin' : '📌 Pin', () => updateCase(cas.id, { pinned: !cas.pinned })],
                                ['📄 Report', () => setReportFor(cas)],
                                [cas.archived ? '📥 Unarchive' : '🗄 Archive', () => updateCase(cas.id, { archived: !cas.archived }, 'edited', cas.archived ? 'Unarchived' : 'Archived')],
                                ['✅ Close', () => changeStatus(cas, 'closed')],
                              ].map(([label, fn]) => (
                                <button key={label} onClick={() => { fn(); setRowMenuFor(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: 'none', background: 'none', fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>{label}</button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CENTER: case workspace */}
        {(!isMobile || selectedCase) && selectedCase && (
          <div style={glass({ padding: 20 })}>
            <button onClick={() => setSelectedCase(null)} style={{ ...btnGhost, marginBottom: 12, fontSize: 12, padding: '6px 12px' }}>← Back to cases</button>

            {selectedCase.source_concern_id && (
              <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12.5, color: '#5B21B6', fontWeight: 600 }}>🛡️ Escalated from a safeguarding concern</div>
                <button onClick={() => onNavigate && onNavigate('safeguarding', { openConcernId: selectedCase.source_concern_id })}
                  style={{ background: 'none', border: 'none', color: '#6D28D9', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                  View original concern →
                </button>
              </div>
            )}

            {/* Risk banner */}
            {(selectedCase.risk_level === 'high' || selectedCase.priority === 'high') && (
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div style={{ flex: 1, fontSize: 12.5, color: '#B91C1C', fontWeight: 700 }}>High risk — requires review within 24 hours.</div>
              </div>
            )}
            {(selectedCase.risk_level === 'critical' || selectedCase.priority === 'critical') && (
              <div style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: selectedCase.risk_ack_at ? 0 : 8 }}>
                  <span style={{ fontSize: 16 }}>🚨</span>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>Critical risk — immediate safeguarding response required</div>
                </div>
                {selectedCase.risk_ack_at ? (
                  <div style={{ fontSize: 11.5, opacity: 0.9 }}>Acknowledged {timeAgo(selectedCase.risk_ack_at)}</div>
                ) : (
                  <button onClick={() => ackRisk(selectedCase)} disabled={ackSaving} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 12, padding: '7px 14px', borderRadius: 9, cursor: 'pointer' }}>{ackSaving ? 'Saving…' : 'Acknowledge (Manager sign-off)'}</button>
                )}
              </div>
            )}

            {/* Child profile header */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
              <Avatar name={selectedCase.child_name} photoUrl={linkedChild?.photo_url} size={56} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A' }}>{selectedCase.child_name}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {linkedChild?.date_of_birth && `Age ${Math.floor((Date.now() - new Date(linkedChild.date_of_birth)) / 3.15576e10)} · `}
                  {linkedChild?.group_name || 'No group linked'}
                </div>
                {linkedChild && (linkedChild.has_epipen || linkedChild.has_asthma || linkedChild.has_diabetes || linkedChild.takes_medication) && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {linkedChild.has_epipen && <span style={{ fontSize: 10.5, fontWeight: 800, background: '#FEF2F2', color: '#B91C1C', borderRadius: 99, padding: '2px 8px' }}>⚠ EpiPen</span>}
                    {linkedChild.has_asthma && <span style={{ fontSize: 10.5, fontWeight: 800, background: '#FEF9C3', color: '#92400E', borderRadius: 99, padding: '2px 8px' }}>Asthma</span>}
                    {linkedChild.has_diabetes && <span style={{ fontSize: 10.5, fontWeight: 800, background: '#FEF9C3', color: '#92400E', borderRadius: 99, padding: '2px 8px' }}>Diabetes</span>}
                    {linkedChild.takes_medication && <span style={{ fontSize: 10.5, fontWeight: 800, background: '#F1F5F9', color: '#475569', borderRadius: 99, padding: '2px 8px' }}>Medication</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <RiskBadge level={selectedCase.risk_level || selectedCase.priority} />
                <StatusChip status={selectedCase.status} />
              </div>
            </div>

            {/* Overview card */}
            <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Case Overview</div>
              <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5, marginBottom: 10 }}>{selectedCase.summary || 'No summary provided.'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={selectedCase.status} onChange={e => changeStatus(selectedCase, e.target.value)} style={{ ...inputStyle, width: 'auto', fontSize: 12, padding: '6px 10px' }}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
                {selectedCase.requires_dsl && <span style={{ fontSize: 11, fontWeight: 800, background: '#EEF2FF', color: '#4338CA', borderRadius: 99, padding: '5px 10px' }}>Requires DSL</span>}
                {selectedCase.next_review_date && <span style={{ fontSize: 11, fontWeight: 700, background: '#fff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 99, padding: '5px 10px', color: '#475569' }}>📅 Review {new Date(selectedCase.next_review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
              {[['timeline', '🕐 Timeline'], ['tasks', '☑️ Tasks'], ['documents', '📎 Documents'], ['actions', '⚡ Safeguarding Actions']].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#0F172A' : '#64748B' }}>{label}</button>
              ))}
            </div>

            {tab === 'timeline' && <CaseTimeline caseId={selectedCase.id} org={org} session={authSession} staff={staff} />}
            {tab === 'tasks' && <CaseTasks caseId={selectedCase.id} org={org} session={authSession} staff={staff} />}
            {tab === 'documents' && <CaseDocuments caseId={selectedCase.id} org={org} session={authSession} />}
            {tab === 'actions' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                {[
                  ['📄 Generate Chronology', () => setReportFor(selectedCase)],
                  ['🖨 Print Chronology', () => setReportFor(selectedCase)],
                  ['✉️ Email Parent', () => window.open(`mailto:?subject=${encodeURIComponent('Regarding ' + selectedCase.child_name)}`)],
                  ['🏫 Email School', () => window.open(`mailto:?subject=${encodeURIComponent('Safeguarding update: ' + selectedCase.child_name)}`)],
                  ['🏛️ Refer to Social Services', () => supabase.from('case_events').insert({ case_id: selectedCase.id, org_id: org.id, event_type: 'agency_contacted', body: 'Referred to Social Services', created_by: authSession?.user?.id }).then(() => setTab('timeline'))],
                  ['🛡️ Escalate to DSL', () => updateCase(selectedCase.id, { requires_dsl: true }, 'edited', 'Escalated to DSL')],
                  ['📅 Schedule Review Meeting', () => { const d = prompt('Next review date (YYYY-MM-DD)'); if (d) updateCase(selectedCase.id, { next_review_date: d }, 'edited', `Review scheduled for ${d}`) }],
                  [selectedCase.immediate_danger ? '✅ Clear Immediate Danger' : '🆘 Mark Immediate Danger', () => updateCase(selectedCase.id, { immediate_danger: !selectedCase.immediate_danger, risk_level: !selectedCase.immediate_danger ? 'critical' : selectedCase.risk_level }, 'edited', !selectedCase.immediate_danger ? 'Marked as immediate danger' : 'Immediate danger cleared')],
                ].map(([label, fn]) => (
                  <button key={label} onClick={fn} style={{ ...btnGhost, textAlign: 'left', padding: '12px 14px' }}>{label}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RIGHT: sticky panel */}
        {(!isMobile) && (
          <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!selectedCase ? (
              <>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Case Overview</div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                    <DonutChart segments={riskDonut.length ? riskDonut : [{ label: 'No active cases', value: 1, color: '#E2E8F0' }]} />
                  </div>
                  {riskDonut.map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                      {s.label} ({s.value})
                    </div>
                  ))}
                </div>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Quick Actions</div>
                  {[
                    ['📋 Record New Concern', () => setShowWizard(true)],
                    ['⬇ Export All Cases', () => exportCasesToCSV(filteredCases)],
                  ].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 4px', border: 'none', borderTop: '1px solid rgba(15,23,42,0.05)', background: 'none', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Recent Activity</div>
                  {recentActivity.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>No recent activity.</div>
                  ) : recentActivity.map(a => {
                    const cas = cases.find(c => c.id === a.case_id)
                    return (
                      <div key={a.id} style={{ padding: '7px 0', borderTop: '1px solid rgba(15,23,42,0.05)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{a.detail || a.action}</div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{cas?.child_name || ''} · {timeAgo(a.created_at)}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Case Health</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}><span style={{ color: '#64748B' }}>Risk</span><RiskBadge level={selectedCase.risk_level || selectedCase.priority} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}><span style={{ color: '#64748B' }}>Days open</span><span style={{ fontWeight: 700 }}>{Math.floor((Date.now() - new Date(selectedCase.created_at)) / 86400000)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}><span style={{ color: '#64748B' }}>Next review</span><span style={{ fontWeight: 700 }}>{selectedCase.next_review_date ? new Date(selectedCase.next_review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span></div>
                </div>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Assigned Staff</div>
                  {staff.find(s => s.id === selectedCase.assigned_to_user_id) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={staff.find(s => s.id === selectedCase.assigned_to_user_id).full_name} photoUrl={staff.find(s => s.id === selectedCase.assigned_to_user_id).photo_url} size={30} />
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{staff.find(s => s.id === selectedCase.assigned_to_user_id).full_name}</div>
                    </div>
                  ) : (
                    <select style={inputStyle} value="" onChange={e => updateCase(selectedCase.id, { assigned_to_user_id: e.target.value, assigned_to: staff.find(s => s.id === e.target.value)?.full_name }, 'assigned', `Assigned to ${staff.find(s => s.id === e.target.value)?.full_name}`)}>
                      <option value="">Assign staff…</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  )}
                </div>
                {linkedChild && (
                  <div style={glass({ padding: 18 })}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Linked Child Record</div>
                    <div style={{ fontSize: 12.5, color: '#334155' }}>{linkedChild.first_name} {linkedChild.last_name}</div>
                    {linkedChild.emergency_contact_name && <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 4 }}>Emergency: {linkedChild.emergency_contact_name} · {linkedChild.emergency_contact_phone}</div>}
                  </div>
                )}
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Quick Links</div>
                  <button onClick={() => setReportFor(selectedCase)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 0', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 700, color: primary, cursor: 'pointer' }}>📄 Generate Report</button>
                  <button onClick={() => setTab('documents')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 0', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 700, color: primary, cursor: 'pointer' }}>📎 View Documents</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showWizard && (
          <CaseCreationWizard org={org} session={authSession} staff={staff} onClose={() => setShowWizard(false)}
            onCreated={(cas) => { setShowWizard(false); loadAll(); setSelectedCase(cas); setTab('timeline') }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reportFor && <CaseReportModal cas={reportFor} org={org} staff={staff} onClose={() => setReportFor(null)} />}
      </AnimatePresence>
    </div>
  )
}
