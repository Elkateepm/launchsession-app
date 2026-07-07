import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Avatar, CountUp, glass, inputStyle, btnPrimary, btnGhost, PAGE_BG } from '../volunteers/vh_shared'
import {
  RA_STATUSES, RA_STATUS_LABELS, ACTIVITY_TYPES, ACTIVITY_ICON,
  riskScore, riskRating, RatingBadge, RAStatusChip, RiskMatrix, RiskGauge, RATING_STYLE,
  timeAgo, daysUntil,
} from './ra_shared'
import { RA_TEMPLATES } from './ra_templates'
import RAHazards from './RAHazards'
import RAEmergencyPlan from './RAEmergencyPlan'
import RAAttachments from './RAAttachments'
import RALinkedSessions, { printRiskAssessment } from './RALinkedSessions'

const RATING_ORDER = { low: 1, medium: 2, high: 3, critical: 4 }

export default function RiskAssessments({ org, session: authSession }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'

  const [assessments, setAssessments] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedHazards, setSelectedHazards] = useState([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: 'all', activity: 'all', rating: 'all' })
  const [sortBy, setSortBy] = useState('newest')
  const [tab, setTab] = useState('overview')
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [rowMenuFor, setRowMenuFor] = useState(null)
  const [page, setPage] = useState(1)
  const perPage = 10

  const loadAll = useCallback(async () => {
    const [{ data: ra }, { data: st }] = await Promise.all([
      supabase.from('risk_assessments').select('*').eq('org_id', org.id).eq('is_template', false).order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, role, photo_url').eq('org_id', org.id).in('role', ['admin', 'staff']),
    ])
    setAssessments(ra || [])
    setStaff(st || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { loadAll() }, [loadAll])

  // Load hazards when an assessment is opened
  useEffect(() => {
    if (!selected) { setSelectedHazards([]); return }
    supabase.from('risk_assessment_hazards').select('*').eq('assessment_id', selected.id).order('sort_order').then(({ data }) => setSelectedHazards(data || []))
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep `selected` fresh after list updates
  useEffect(() => {
    if (selected) {
      const fresh = assessments.find(a => a.id === selected.id)
      if (fresh && fresh !== selected) setSelected(fresh)
    }
  }, [assessments]) // eslint-disable-line react-hooks/exhaustive-deps

  const logAudit = async (id, action, detail) => {
    await supabase.from('risk_assessment_audit').insert({ assessment_id: id, org_id: org.id, action, detail, actor_id: authSession?.user?.id })
  }

  const update = async (id, patch, auditAction, auditDetail) => {
    const { data } = await supabase.from('risk_assessments').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (data) {
      setAssessments(list => list.map(a => a.id === id ? data : a))
      if (auditAction) logAudit(id, auditAction, auditDetail)
    }
    return data
  }

  const createAssessment = async ({ name, activity_type, location, summary, hazards, template_source_id }) => {
    const top = (hazards || []).reduce((m, h) => Math.max(m, riskScore(h.likelihood, h.severity)), 0)
    const { data: ra, error } = await supabase.from('risk_assessments').insert({
      org_id: org.id, name, activity_type, location, summary, status: 'draft',
      risk_score: top, risk_rating: riskRating(top), created_by: authSession?.user?.id,
      template_source_id: template_source_id || null,
    }).select().single()
    if (error) { alert('Failed to create: ' + error.message); return }
    if (hazards?.length) {
      await supabase.from('risk_assessment_hazards').insert(hazards.map((h, i) => ({ ...h, assessment_id: ra.id, org_id: org.id, sort_order: i })))
    }
    await logAudit(ra.id, 'created', `Created "${name}"`)
    setShowCreate(false); setShowTemplates(false)
    await loadAll()
    setSelected(ra); setTab('overview')
  }

  const markReviewed = async (a) => {
    const today = new Date().toISOString().slice(0, 10)
    const next = new Date(); next.setFullYear(next.getFullYear() + 1)
    await update(a.id, { last_reviewed_at: today, next_review_date: next.toISOString().slice(0, 10), review_date: next.toISOString().slice(0, 10), status: 'active' }, 'reviewed', 'Marked as reviewed')
  }

  const duplicate = async (a) => {
    const { data: hz } = await supabase.from('risk_assessment_hazards').select('*').eq('assessment_id', a.id)
    await createAssessment({
      name: `${a.name} (Copy)`, activity_type: a.activity_type, location: a.location, summary: a.summary,
      hazards: (hz || []).map(({ id, assessment_id, org_id, created_at, ...rest }) => rest),
    })
  }

  // ── derived ──
  const filtered = useMemo(() => {
    let list = assessments.filter(a => !a.archived)
    if (filters.status !== 'all') list = list.filter(a => a.status === filters.status)
    if (filters.activity !== 'all') list = list.filter(a => a.activity_type === filters.activity)
    if (filters.rating !== 'all') list = list.filter(a => a.risk_rating === filters.rating)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.name?.toLowerCase().includes(q) || a.location?.toLowerCase().includes(q) || a.activity_type?.toLowerCase().includes(q))
    }
    const sorters = {
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      rating: (a, b) => (RATING_ORDER[b.risk_rating] || 0) - (RATING_ORDER[a.risk_rating] || 0),
      review: (a, b) => new Date(a.next_review_date || '2999') - new Date(b.next_review_date || '2999'),
      name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    }
    return [...list].sort(sorters[sortBy] || sorters.newest)
  }, [assessments, filters, search, sortBy])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const kpis = useMemo(() => {
    const active = assessments.filter(a => !a.archived)
    const attachedThisMonth = 0 // computed live per assessment; org total omitted for perf
    const requireReview = active.filter(a => { const d = daysUntil(a.next_review_date); return d != null && d <= 14 }).length
    const highRisk = active.filter(a => a.risk_rating === 'high' || a.risk_rating === 'critical').length
    const drafts = active.filter(a => a.status === 'draft').length
    const completable = active.filter(a => a.status !== 'draft').length
    const rate = active.length ? Math.round((completable / active.length) * 100) : 0
    return { total: active.length, attachedThisMonth, requireReview, highRisk, drafts, rate }
  }, [assessments])

  const ratingDonut = useMemo(() => {
    const active = assessments.filter(a => !a.archived)
    const c = { low: 0, medium: 0, high: 0, critical: 0 }
    active.forEach(a => { if (c[a.risk_rating] !== undefined) c[a.risk_rating]++ })
    const total = active.length || 1
    return [
      { label: 'High', value: c.high + c.critical, color: '#EF4444' },
      { label: 'Medium', value: c.medium, color: '#F59E0B' },
      { label: 'Low', value: c.low, color: '#22C55E' },
    ].map(s => ({ ...s, pct: Math.round((s.value / total) * 100) }))
  }, [assessments])

  const upcomingReviews = useMemo(() =>
    assessments.filter(a => !a.archived && a.next_review_date).sort((a, b) => new Date(a.next_review_date) - new Date(b.next_review_date)).slice(0, 4)
  , [assessments])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8' }}>Loading risk assessments…</div>

  const reviewerName = (id) => staff.find(s => s.id === id)?.full_name || '—'

  return (
    <div style={{ background: PAGE_BG, minHeight: '100%', padding: isMobile ? '16px 12px 80px' : '20px 24px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 10 }}>🛡️ Risk Assessments</div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 4 }}>Create, manage and review risk assessments for all activities.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowTemplates(true)} style={btnGhost}>📄 From Template</button>
          <button onClick={() => setShowCreate(true)} style={btnPrimary(primary)}>+ New Risk Assessment</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'All Assessments', value: kpis.total, icon: '🎮', color: '#7C5CFC', suffix: '' },
          { label: 'Require Review', value: kpis.requireReview, icon: '⏰', color: '#F59E0B', suffix: '' },
          { label: 'High Risk Activities', value: kpis.highRisk, icon: '🔥', color: '#EF4444', suffix: '' },
          { label: 'Drafts', value: kpis.drafts, icon: '🗂', color: '#64748B', suffix: '' },
          { label: 'Completion Rate', value: kpis.rate, icon: '✅', color: '#22C55E', suffix: '%' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -2 }} style={{ ...glass({ padding: '16px' }) }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{k.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color, lineHeight: 1 }}><CountUp value={k.value} />{k.suffix}</div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, marginTop: 4 }}>{k.label}</div>
          </motion.div>
        ))}
      </div>

      {/* SEARCH + FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search assessments…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select style={{ ...inputStyle, width: 140 }} value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}>
          <option value="all">All Status</option>
          {RA_STATUSES.map(s => <option key={s} value={s}>{RA_STATUS_LABELS[s]}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 150 }} value={filters.activity} onChange={e => { setFilters(f => ({ ...f, activity: e.target.value })); setPage(1) }}>
          <option value="all">All Categories</option>
          {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 130 }} value={filters.rating} onChange={e => { setFilters(f => ({ ...f, rating: e.target.value })); setPage(1) }}>
          <option value="all">All Risk</option>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
        </select>
        <select style={{ ...inputStyle, width: 150 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="newest">Sort: Newest</option>
          <option value="rating">Sort: Risk Rating</option>
          <option value="review">Sort: Review Due</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : selected ? '1fr 1.5fr 0.85fr' : '1.4fr 0.85fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT: library list */}
        {(!isMobile || !selected) && (
          <div style={glass({ padding: 0, overflow: 'hidden' })}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>Assessments ({filtered.length})</div>
            {paged.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>🛡️</div>
                <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{assessments.length === 0 ? 'No risk assessments yet' : 'No matching assessments'}</div>
                <div style={{ fontSize: 12.5, color: '#94A3B8' }}>{assessments.length === 0 ? 'Create one from scratch or start from a template' : 'Try adjusting your filters'}</div>
              </div>
            ) : (
              <div>
                {paged.map(a => {
                  const isSel = selected?.id === a.id
                  const reviewDays = daysUntil(a.next_review_date)
                  return (
                    <motion.div key={a.id} layout onClick={() => { setSelected(a); setTab('overview'); logAudit(a.id, 'viewed', null) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer', background: isSel ? `${primary}0c` : 'transparent', borderLeft: `3px solid ${isSel ? primary : 'transparent'}` }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: `${primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{ACTIVITY_ICON[a.activity_type] || '📋'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.activity_type || '—'}{a.location ? ` · ${a.location}` : ''}</div>
                        {a.next_review_date && <div style={{ fontSize: 10.5, color: reviewDays != null && reviewDays < 0 ? '#DC2626' : reviewDays != null && reviewDays <= 14 ? '#B45309' : '#94A3B8', fontWeight: 700, marginTop: 1 }}>Review {reviewDays != null && reviewDays < 0 ? `overdue ${Math.abs(reviewDays)}d` : `in ${reviewDays}d`}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        {a.risk_rating && <RatingBadge rating={a.risk_rating} size="sm" />}
                        <RAStatusChip status={a.status} />
                      </div>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); setRowMenuFor(rowMenuFor === a.id ? null : a.id) }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 15, padding: 4 }}>⋯</button>
                        <AnimatePresence>
                          {rowMenuFor === a.id && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(15,23,42,0.06)', padding: 4, width: 160, zIndex: 60 }}>
                              {[
                                ['📄 Download PDF', () => printRiskAssessment(a, [], org, staff)],
                                ['📋 Duplicate', () => duplicate(a)],
                                ['✅ Mark Reviewed', () => markReviewed(a)],
                                [a.archived ? '📥 Unarchive' : '🗄 Archive', () => update(a.id, { archived: !a.archived }, 'archived', a.archived ? 'Unarchived' : 'Archived')],
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
                {pageCount > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>Page {page} of {pageCount}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...btnGhost, padding: '5px 12px', fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}>←</button>
                      <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} style={{ ...btnGhost, padding: '5px 12px', fontSize: 12, opacity: page === pageCount ? 0.4 : 1 }}>→</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CENTER: workspace */}
        {(!isMobile || selected) && selected && (
          <div style={glass({ padding: 20 })}>
            <button onClick={() => setSelected(null)} style={{ ...btnGhost, marginBottom: 12, fontSize: 12, padding: '6px 12px' }}>← Back to library</button>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{ACTIVITY_ICON[selected.activity_type] || '📋'}</div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <input value={selected.name || ''} onChange={e => setSelected(s => ({ ...s, name: e.target.value }))} onBlur={e => update(selected.id, { name: e.target.value }, 'edited', 'Renamed')}
                  style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', border: 'none', outline: 'none', width: '100%', background: 'transparent' }} />
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{selected.activity_type || '—'}{selected.location ? ` · ${selected.location}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {selected.risk_rating && <RatingBadge rating={selected.risk_rating} />}
                <select value={selected.status} onChange={e => update(selected.id, { status: e.target.value }, 'edited', `Status → ${RA_STATUS_LABELS[e.target.value]}`)} style={{ ...inputStyle, width: 'auto', fontSize: 12, padding: '5px 8px' }}>
                  {RA_STATUSES.map(s => <option key={s} value={s}>{RA_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F1F5F9', borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
              {[['overview', 'Overview'], ['hazards', `Hazards${selectedHazards.length ? ` (${selectedHazards.length})` : ''}`], ['matrix', 'Matrix'], ['emergency', 'Emergency'], ['attachments', 'Attachments'], ['sessions', 'Linked'], ['reviews', 'History']].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{ flex: '1 1 auto', padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#0F172A' : '#64748B', whiteSpace: 'nowrap' }}>{label}</button>
              ))}
            </div>

            {tab === 'overview' && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>Assessment Summary</label>
                  <textarea value={selected.summary || ''} onChange={e => setSelected(s => ({ ...s, summary: e.target.value }))} onBlur={e => update(selected.id, { summary: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 11, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 13.5, outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }} placeholder="Brief description of this activity and its context…" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    ['activity_type', 'Activity Type', ACTIVITY_TYPES],
                    ['location', 'Location', null],
                  ].map(([key, label, opts]) => (
                    <div key={key}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>{label}</label>
                      {opts ? (
                        <select value={selected[key] || ''} onChange={e => update(selected.id, { [key]: e.target.value })} style={inputStyle}>
                          <option value="">—</option>
                          {opts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={selected[key] || ''} onChange={e => setSelected(s => ({ ...s, [key]: e.target.value }))} onBlur={e => update(selected.id, { [key]: e.target.value })} style={inputStyle} />
                      )}
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Review due date</label>
                    <input type="date" value={selected.next_review_date || ''} onChange={e => update(selected.id, { next_review_date: e.target.value, review_date: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Assigned reviewer</label>
                    <select value={selected.assigned_reviewer_id || ''} onChange={e => update(selected.id, { assigned_reviewer_id: e.target.value || null })} style={inputStyle}>
                      <option value="">Unassigned</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                </div>
                {/* Risk rating summary */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#F8FAFC', borderRadius: 14, padding: 16, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <RiskGauge score={selected.risk_score || 0} />
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginTop: -6 }}>Risk Score {selected.risk_score || 0} / 25</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, marginBottom: 4 }}>Overall Rating</div>
                    {selected.risk_rating ? <RatingBadge rating={selected.risk_rating} /> : <span style={{ fontSize: 13, color: '#94A3B8' }}>Add hazards to calculate</span>}
                    <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 8 }}>
                      {selectedHazards.filter(h => riskRating(riskScore(h.likelihood, h.severity)) === 'high' || riskRating(riskScore(h.likelihood, h.severity)) === 'critical').length} high-risk hazard(s) · {selectedHazards.length} total
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'hazards' && <RAHazards assessment={selected} org={org} session={authSession} onHazardsChanged={(score, rating) => { setSelected(s => ({ ...s, risk_score: score, risk_rating: rating })); supabase.from('risk_assessment_hazards').select('*').eq('assessment_id', selected.id).order('sort_order').then(({ data }) => setSelectedHazards(data || [])) }} />}
            {tab === 'matrix' && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                <RiskMatrix hazards={selectedHazards} />
              </div>
            )}
            {tab === 'emergency' && <RAEmergencyPlan assessment={selected} org={org} />}
            {tab === 'attachments' && <RAAttachments assessment={selected} org={org} session={authSession} />}
            {tab === 'sessions' && <RALinkedSessions assessment={selected} org={org} session={authSession} />}
            {tab === 'reviews' && <ReviewHistory assessment={selected} org={org} staff={staff} />}
          </div>
        )}

        {/* RIGHT: sticky panel */}
        {!isMobile && (
          <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {selected ? (
              <>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Quick Actions</div>
                  {[
                    ['📄 Download PDF', () => { printRiskAssessment(selected, selectedHazards, org, staff); logAudit(selected.id, 'downloaded', 'Exported PDF') }],
                    ['📋 Duplicate', () => duplicate(selected)],
                    ['✅ Mark Reviewed', () => markReviewed(selected)],
                    ['📎 Attach to Session', () => setTab('sessions')],
                  ].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 4px', border: 'none', borderTop: '1px solid rgba(15,23,42,0.05)', background: 'none', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Details</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}><span style={{ color: '#64748B' }}>Created by</span><span style={{ fontWeight: 700 }}>{reviewerName(selected.created_by)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}><span style={{ color: '#64748B' }}>Reviewer</span><span style={{ fontWeight: 700 }}>{reviewerName(selected.assigned_reviewer_id)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}><span style={{ color: '#64748B' }}>Last reviewed</span><span style={{ fontWeight: 700 }}>{selected.last_reviewed_at ? new Date(selected.last_reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 }}><span style={{ color: '#64748B' }}>Next review</span><span style={{ fontWeight: 700 }}>{selected.next_review_date ? new Date(selected.next_review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span></div>
                </div>
              </>
            ) : (
              <>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Risk by Category</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <RiskDonut segments={ratingDonut} total={assessments.filter(a => !a.archived).length} />
                    <div style={{ flex: 1 }}>
                      {ratingDonut.map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', marginBottom: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                          {s.label} <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{s.value} ({s.pct}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Quick Actions</div>
                  {[
                    ['📋 Duplicate Assessment', () => { if (assessments[0]) duplicate(assessments[0]); else alert('No assessment to duplicate yet') }],
                    ['📄 Create from Template', () => setShowTemplates(true)],
                    ['➕ New Assessment', () => setShowCreate(true)],
                  ].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 4px', border: 'none', borderTop: '1px solid rgba(15,23,42,0.05)', background: 'none', fontSize: 12.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
                <div style={glass({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Upcoming Reviews</div>
                  {upcomingReviews.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>No reviews scheduled.</div>
                  ) : upcomingReviews.map(a => {
                    const d = daysUntil(a.next_review_date)
                    return (
                      <div key={a.id} onClick={() => { setSelected(a); setTab('overview') }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer' }}>
                        <span style={{ fontSize: 15 }}>{ACTIVITY_ICON[a.activity_type] || '📋'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: 10.5, color: d != null && d < 0 ? '#DC2626' : '#94A3B8' }}>Review {d != null && d < 0 ? `overdue ${Math.abs(d)}d` : `in ${d}d`}</div>
                        </div>
                        {a.risk_rating && <RatingBadge rating={a.risk_rating} size="sm" />}
                      </div>
                    )
                  })}
                </div>
                <div style={glass({ padding: 18 })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Templates</div>
                    <button onClick={() => setShowTemplates(true)} style={{ fontSize: 11, fontWeight: 800, color: primary, background: 'none', border: 'none', cursor: 'pointer' }}>Browse →</button>
                  </div>
                  {RA_TEMPLATES.slice(0, 4).map(t => (
                    <button key={t.key} onClick={() => setShowTemplates(true)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(15,23,42,0.05)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 15 }}>{t.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', flex: 1 }}>{t.name}</span>
                      <span style={{ color: '#CBD5E1' }}>›</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreate && <CreateModal org={org} staff={staff} onClose={() => setShowCreate(false)} onCreate={createAssessment} primary={primary} />}
      </AnimatePresence>

      {/* TEMPLATES MODAL */}
      <AnimatePresence>
        {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onPick={(t) => createAssessment({ name: t.name, activity_type: t.activity_type, location: '', summary: t.summary, hazards: t.hazards.map(h => ({ ...h })) })} primary={primary} />}
      </AnimatePresence>
    </div>
  )
}

// ── Small right-panel donut ──
function RiskDonut({ segments, total }) {
  const size = 90, thickness = 14, r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r
  let offset = 0
  const t = total || 1
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
      {segments.filter(s => s.value > 0).map((s, i) => {
        const dash = (s.value / t) * circ
        const el = <circle key={s.label} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${c} ${c})`} />
        offset += dash
        return el
      })}
      <text x={c} y={c - 2} textAnchor="middle" fontSize="20" fontWeight="900" fill="#0F172A">{total}</text>
      <text x={c} y={c + 13} textAnchor="middle" fontSize="9" fontWeight="700" fill="#94A3B8">Total</text>
    </svg>
  )
}

// ── Review history (audit log) ──
function ReviewHistory({ assessment, org, staff }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('risk_assessment_audit').select('*').eq('assessment_id', assessment.id).order('created_at', { ascending: false }).then(({ data }) => { setEvents(data || []); setLoading(false) })
  }, [assessment.id])
  const name = (id) => staff.find(s => s.id === id)?.full_name || 'Team member'
  const ICON = { created: '✨', edited: '✏️', viewed: '👁️', printed: '🖨️', downloaded: '⬇️', attached: '📎', detached: '🔗', reviewed: '✅', archived: '🗄️' }
  if (loading) return <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>Loading history…</div>
  if (events.length === 0) return <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: 13 }}>No history yet.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map(e => (
        <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(15,23,42,0.06)', background: '#fff' }}>
          <span style={{ fontSize: 16 }}>{ICON[e.action] || '•'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{e.detail || e.action}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>{name(e.actor_id)} · {timeAgo(e.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Create modal ──
function CreateModal({ org, staff, onClose, onCreate, primary }) {
  const [form, setForm] = useState({ name: '', activity_type: '', location: '', summary: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async () => { if (!form.name.trim()) return; setSaving(true); await onCreate({ ...form, hazards: [] }) }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ y: 20, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 14, scale: 0.97, opacity: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 30 }} onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>🛡️ New Risk Assessment</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Name</label>
            <input autoFocus style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Football Training Session" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Activity Type</label>
            <select style={inputStyle} value={form.activity_type} onChange={e => set('activity_type', e.target.value)}>
              <option value="">Select…</option>
              {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Location</label>
            <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Watford Leisure Centre" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Summary</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="Brief description…" />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(15,23,42,0.06)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={submit} disabled={saving || !form.name.trim()} style={btnPrimary(primary)}>{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Templates modal ──
function TemplatesModal({ onClose, onPick, primary }) {
  const [picking, setPicking] = useState(null)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ y: 20, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 14, scale: 0.97, opacity: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 30 }} onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 560, maxHeight: '86vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 100px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>📄 Start from a Template</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Pre-filled hazards you can edit after creating</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {RA_TEMPLATES.map(t => (
            <div key={t.key} style={{ border: '1.5px solid rgba(15,23,42,0.08)', borderRadius: 14, padding: 16, background: '#fff' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{t.name}</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', margin: '4px 0 10px', minHeight: 46 }}>{t.summary}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 10 }}>{t.hazards.length} starter hazards</div>
              <button onClick={() => { setPicking(t.key); onPick(t) }} disabled={picking} style={{ width: '100%', ...btnPrimary(primary) }}>{picking === t.key ? 'Creating…' : 'Use Template'}</button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
