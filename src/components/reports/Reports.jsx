import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  DATE_RANGES, rangeFor, getOverviewMetrics, getInsightExtras, deriveInsights,
  listSavedReports, renameReport, deleteReport, duplicateReport, rerunReport,
  REPORT_LIBRARY, REPORT_CATEGORIES, canAccessReport,
} from '../../lib/reportingService'
import ReportBuilder from './ReportBuilder'
import Icon from '../../lib/icons'

const VIEWS = [
  { key: 'overview', label: 'Overview' },
  { key: 'library', label: 'Report Library' },
  { key: 'saved', label: 'Saved Reports' },
]

const card = (extra = {}) => ({
  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04)', ...extra,
})
const TONES = {
  indigo: { bg: '#EEF2FF', bd: '#C7D2FE', fg: '#4338CA' },
  blue:   { bg: '#EFF6FF', bd: '#BFDBFE', fg: '#1D4ED8' },
  green:  { bg: '#F0FDF4', bd: '#BBF7D0', fg: '#15803D' },
  amber:  { bg: '#FFFBEB', bd: '#FDE68A', fg: '#B45309' },
  red:    { bg: '#FEF2F2', bd: '#FECACA', fg: '#B91C1C' },
  slate:  { bg: '#F8FAFC', bd: '#E2E8F0', fg: '#334155' },
}

const CATEGORY_TONE = {
  Delivery: 'indigo', Attendance: 'green', 'Young People': 'blue',
  Impact: 'amber', Team: 'blue', Safeguarding: 'red', Funding: 'green',
}

const ctl = {
  padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff',
  fontSize: 12.5, fontWeight: 600, color: '#334155', outline: 'none', cursor: 'pointer',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Reports({ org, session, userProfile, onNavigate }) {
  const isMobile = useIsMobile()
  const orgId = org?.id
  const role = userProfile?.role || 'staff'

  const [view, setView] = useState('overview')
  const [rangeKey, setRangeKey] = useState('30d')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })
  const [metrics, setMetrics] = useState(null)
  const [extras, setExtras] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedReports, setSavedReports] = useState([])
  const [builderType, setBuilderType] = useState(null)

  const range = useMemo(() => rangeFor(rangeKey, customRange), [rangeKey, customRange])

  const loadOverview = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError('')
    try {
      const [m, x] = await Promise.all([
        getOverviewMetrics(range),
        getInsightExtras(orgId, range),
      ])
      setMetrics(m); setExtras(x)
    } catch (e) {
      setError(e.message || 'Could not load report data.')
      setMetrics(null)
    }
    setLoading(false)
  }, [orgId, range])

  const loadSaved = useCallback(async () => {
    if (!orgId) return
    try { setSavedReports(await listSavedReports(orgId)) } catch { /* RLS hides restricted rows */ }
  }, [orgId])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { loadSaved() }, [loadSaved])

  const insights = useMemo(() => deriveInsights(metrics, extras), [metrics, extras])

  const goto = (target) => {
    const map = { attendance: 'registers', safeguarding: 'safeguarding', impact: 'impact_outcomes', sessions: 'planner' }
    if (onNavigate && map[target]) onNavigate(map[target])
  }

  return (
    <div style={{ padding: isMobile ? 16 : 28, width: '100%', boxSizing: 'border-box' }}>
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #312E81 0%, #4338CA 42%, #2563EB 100%)',
        borderRadius: isMobile ? 16 : 20,
        padding: isMobile ? '20px 18px' : '24px 28px',
        marginBottom: 18,
        boxShadow: '0 1px 0 rgba(255,255,255,0.14) inset, 0 16px 36px -24px rgba(49,46,129,0.8)',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -50, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 23 : 30, fontWeight: 900, color: '#fff', letterSpacing: -0.8 }}>Reports</h1>
            <p style={{ margin: '6px 0 0', fontSize: isMobile ? 13 : 14, color: 'rgba(224,231,255,0.85)', fontWeight: 500 }}>
              Understand your delivery and turn your data into useful reports.
            </p>
          </div>
          <button onClick={() => setBuilderType('delivery')} style={{
            padding: '12px 20px', borderRadius: 11, border: 'none', color: '#3730A3', background: '#fff',
            fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: '0 8px 20px -8px rgba(0,0,0,0.4)',
          }}>{isMobile ? '+ Create' : '+ Create Report'}</button>
        </div>
      </div>

      <div style={{ display: 'inline-flex', gap: 3, padding: 3, borderRadius: 12, background: '#F1F5F9', border: '1px solid #E2E8F0', marginBottom: 14, maxWidth: '100%', overflowX: 'auto' }}>
        {VIEWS.map(v => {
          const on = view === v.key
          return (
            <button key={v.key} onClick={() => setView(v.key)} style={{
              padding: '8px 16px', border: 'none', borderRadius: 9, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
              background: on ? '#fff' : 'transparent', color: on ? '#4F46E5' : '#64748B',
              boxShadow: on ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
            }}>{v.label}</button>
          )
        })}
      </div>

      {view === 'overview' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <select value={rangeKey} onChange={e => setRangeKey(e.target.value)} style={ctl}>
            {DATE_RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          {rangeKey === 'custom' && (
            <>
              <input type="date" value={customRange.from} onChange={e => setCustomRange(c => ({ ...c, from: e.target.value }))} style={ctl} />
              <input type="date" value={customRange.to} onChange={e => setCustomRange(c => ({ ...c, to: e.target.value }))} style={ctl} />
            </>
          )}
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
            {fmtDate(range.from)} – {fmtDate(range.to)}
          </span>
        </div>
      )}

      {error && (
        <div style={{ ...card({ padding: 16, marginBottom: 14 }), borderColor: '#FECACA', background: '#FEF2F2' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>Couldn't load report data</div>
          <div style={{ fontSize: 12.5, color: '#991B1B', marginTop: 3 }}>{error}</div>
        </div>
      )}

      {view === 'overview' && (
        <OverviewView
          loading={loading} metrics={metrics} insights={insights} isMobile={isMobile}
          savedReports={savedReports} onGoto={goto}
          onOpenLibrary={() => setView('library')} onOpenSaved={() => setView('saved')}
        />
      )}

      {view === 'library' && (
        <LibraryView role={role} isMobile={isMobile} onRun={(key) => setBuilderType(key)} />
      )}

      {view === 'saved' && (
        <SavedView
          reports={savedReports} orgId={orgId} session={session}
          onChanged={loadSaved} onCreate={() => setBuilderType('delivery')} range={range}
        />
      )}

      {builderType && (
        <ReportBuilder
          org={org} session={session} role={role} initialType={builderType}
          defaultRange={range}
          onClose={() => setBuilderType(null)}
          onSaved={() => { setBuilderType(null); loadSaved(); setView('saved') }}
        />
      )}
    </div>
  )
}

function OverviewView({ loading, metrics, insights, isMobile, savedReports, onGoto, onOpenLibrary, onOpenSaved }) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={card({ padding: 16, height: 78, background: '#F8FAFC' })} />
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <div style={{ ...card({ padding: 40 }), textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Report data unavailable</div>
        <div style={{ fontSize: 13, color: '#64748B' }}>We couldn't load figures for this period. Try a different date range.</div>
      </div>
    )
  }

  const hasData = metrics.sessions > 0 || metrics.young_people > 0
  // Colour carries meaning rather than decorating: reach/delivery are neutral
  // indigo, attendance is graded on performance, concerns go red only when
  // there actually are any.
  const rate = metrics.attendance_rate
  const attTone = rate === null ? 'slate' : rate >= 75 ? 'green' : rate >= 50 ? 'amber' : 'red'
  const stats = [
    { v: metrics.young_people, l: 'Young people', tone: 'indigo', icon: '🧒' },
    { v: metrics.sessions, l: 'Sessions', tone: 'indigo', icon: '📅' },
    { v: rate !== null ? `${rate}%` : '—', l: 'Attendance', tone: attTone, icon: '✅' },
    { v: `${metrics.delivery_hours}h`, l: 'Delivery', tone: 'blue', icon: '⏱' },
    { v: metrics.outcomes, l: 'Outcomes', tone: metrics.outcomes > 0 ? 'green' : 'slate', icon: '⭐' },
    { v: metrics.open_concerns, l: 'Open concerns', tone: metrics.open_concerns > 0 ? 'red' : 'green', icon: '🛡' },
  ]

  return (
    <>
      <SectionLabel>At a glance</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 22 }}>
        {stats.map(s => {
          const t = TONES[s.tone] || TONES.slate
          return (
            <div key={s.l} style={{
              background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 14, padding: 16,
              boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset',
            }}>
              <div style={{ fontSize: 14, marginBottom: 7, opacity: 0.9 }}><Icon name={s.icon} /></div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.6, color: t.fg, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', marginTop: 5 }}>{s.l}</div>
            </div>
          )
        })}
      </div>

      {!hasData && (
        <div style={{ ...card({ padding: 32, marginBottom: 22 }), textAlign: 'center' }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Not enough data for this period yet</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>Figures will appear as your team delivers sessions and completes registers.</div>
        </div>
      )}

      {insights.length > 0 && (
        <>
          <SectionLabel>Needs your attention</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginBottom: 22 }}>
            {insights.map(i => {
              const tone = i.tone === 'urgent' ? { bd: '#FECACA', bg: '#FEF2F2', fg: '#B91C1C' }
                : i.tone === 'warn' ? { bd: '#FDE68A', bg: '#FFFBEB', fg: '#B45309' }
                : { bd: '#BBF7D0', bg: '#F0FDF4', fg: '#15803D' }
              return (
                <div key={i.key} style={card({ padding: 16, borderColor: tone.bd, background: tone.bg })}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: tone.fg }}>{i.title}</div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>{i.body}</div>
                  <button onClick={() => onGoto(i.target)} style={{
                    marginTop: 10, padding: 0, border: 'none', background: 'none',
                    fontSize: 12.5, fontWeight: 800, color: tone.fg, cursor: 'pointer',
                  }}>{i.action} <Icon name="→" /></button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <SectionLabel>Popular reports</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, marginBottom: 22 }}>
        {REPORT_LIBRARY.filter(r => ['delivery', 'attendance', 'impact', 'funding'].includes(r.key)).map(r => (
          <div key={r.key} style={card({ padding: 16 })}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16, marginBottom: 10,
              background: (TONES[CATEGORY_TONE[r.category]] || TONES.slate).bg,
              border: `1px solid ${(TONES[CATEGORY_TONE[r.category]] || TONES.slate).bd}`,
            }}><Icon name={r.icon} /></div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{r.name}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 1.5 }}>{r.desc}</div>
            <button onClick={onOpenLibrary} style={{
              marginTop: 12, padding: '8px 14px', borderRadius: 9, border: '1px solid #E2E8F0',
              background: '#fff', fontSize: 12, fontWeight: 800, color: '#4F46E5', cursor: 'pointer',
            }}>Run report</button>
          </div>
        ))}
      </div>

      {savedReports.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <SectionLabel>Recent reports</SectionLabel>
            <button onClick={onOpenSaved} style={{ border: 'none', background: 'none', fontSize: 12, fontWeight: 800, color: '#4F46E5', cursor: 'pointer' }}>View all <Icon name="→" /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {savedReports.slice(0, 4).map(r => (
              <div key={r.id} style={card({ padding: '12px 14px' })}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                  {REPORT_LIBRARY.find(x => x.key === r.report_type)?.name || r.report_type} · {fmtDate(r.created_at?.slice(0, 10))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function LibraryView({ role, isMobile, onRun }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')

  const list = REPORT_LIBRARY.filter(r => {
    if (cat !== 'All' && r.category !== cat) return false
    if (q.trim()) {
      const hay = `${r.name} ${r.desc} ${r.category}`.toLowerCase()
      if (!hay.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Report Library</div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>Choose a report to explore your organisation's data.</div>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search reports..."
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 11, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', marginBottom: 10 }} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {REPORT_CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding: '7px 13px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: cat === c ? '1.5px solid #4F46E5' : '1px solid #E2E8F0',
            background: cat === c ? '#EEF2FF' : '#fff', color: cat === c ? '#4F46E5' : '#334155',
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
        {list.map(r => {
          const allowed = canAccessReport(r, role)
          return (
            <div key={r.key} style={card({ padding: 18, opacity: allowed ? 1 : 0.6 })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16,
                  background: (TONES[CATEGORY_TONE[r.category]] || TONES.slate).bg,
                  border: `1px solid ${(TONES[CATEGORY_TONE[r.category]] || TONES.slate).bd}`,
                }}><Icon name={r.icon} /></span>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, borderRadius: 99, padding: '3px 9px',
                  color: (TONES[CATEGORY_TONE[r.category]] || TONES.slate).fg,
                  background: (TONES[CATEGORY_TONE[r.category]] || TONES.slate).bg,
                }}>{r.category}</span>
                {r.restricted && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#B45309', background: '#FFFBEB', borderRadius: 99, padding: '3px 9px' }}>Restricted</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{r.name}</div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 5, lineHeight: 1.5 }}>{r.desc}</div>
              <button onClick={() => allowed && onRun(r.key)} disabled={!allowed} style={{
                marginTop: 14, padding: '9px 16px', borderRadius: 10, border: 'none',
                background: allowed ? 'linear-gradient(135deg,#4F46E5,#3B82F6)' : '#E2E8F0',
                color: allowed ? '#fff' : '#94A3B8', fontSize: 12.5, fontWeight: 800,
                cursor: allowed ? 'pointer' : 'not-allowed',
              }}>{allowed ? 'Run report' : 'No permission'}</button>
            </div>
          )
        })}
        {list.length === 0 && (
          <div style={{ ...card({ padding: 30 }), textAlign: 'center', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, color: '#64748B' }}>No reports match that search.</div>
          </div>
        )}
      </div>
    </>
  )
}

function SavedView({ reports, orgId, session, onChanged, onCreate, range }) {
  const [menuId, setMenuId] = useState(null)
  const [busy, setBusy] = useState(false)

  const act = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { window.alert(e.message || 'That action failed.') }
    setBusy(false); setMenuId(null); onChanged()
  }

  if (reports.length === 0) {
    return (
      <div style={{ ...card({ padding: 44 }), textAlign: 'center' }}>
        <div style={{ fontSize: 26, marginBottom: 10 }}><Icon name="📄" /></div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>No saved reports yet</div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 1.5 }}>
          Create a report once and save it here so you can run it again later.
        </div>
        <button onClick={onCreate} style={{
          padding: '11px 20px', borderRadius: 11, border: 'none', color: '#fff',
          background: 'linear-gradient(135deg,#4F46E5,#3B82F6)', fontSize: 13, fontWeight: 800, cursor: 'pointer',
        }}>Create Report</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reports.map(r => {
        const meta = REPORT_LIBRARY.find(x => x.key === r.report_type)
        return (
          <div key={r.id} style={card({ padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' })}>
            <span style={{ fontSize: 18 }}>{meta?.icon || '📄'}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3 }}>
                {meta?.name || r.report_type}
                {r.date_from ? ` · ${fmtDate(r.date_from)} – ${fmtDate(r.date_to)}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                Created {fmtDate(r.created_at?.slice(0, 10))}
                {r.last_run_at ? ` · Last run ${fmtDate(r.last_run_at.slice(0, 10))}` : ''}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuId(menuId === r.id ? null : r.id)} style={{
                padding: '7px 12px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff',
                fontSize: 14, color: '#64748B', cursor: 'pointer', lineHeight: 1,
              }}>⋯</button>
              {menuId === r.id && (
                <>
                  <div onClick={() => setMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 10380 }} />
                  <div style={{
                    position: 'absolute', right: 0, top: '110%', zIndex: 10390, background: '#fff',
                    border: '1px solid #E2E8F0', borderRadius: 11, minWidth: 190, overflow: 'hidden',
                    boxShadow: '0 12px 32px rgba(15,23,42,0.16)',
                  }}>
                    <MenuItem disabled={busy} onClick={() => act(async () => { await rerunReport(r, range) })}>
                      Rerun with current range
                    </MenuItem>
                    <MenuItem disabled={busy} onClick={() => act(() => duplicateReport(orgId, session?.user?.id, r))}>Duplicate</MenuItem>
                    <MenuItem disabled={busy} onClick={() => {
                      const name = window.prompt('Rename report', r.name)
                      if (name && name.trim()) act(() => renameReport(r.id, name.trim()))
                    }}>Rename</MenuItem>
                    <MenuItem danger disabled={busy} onClick={() => {
                      if (window.confirm(`Delete "${r.name}"? This can't be undone.`)) act(() => deleteReport(r.id))
                    }}>Delete</MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MenuItem({ children, onClick, danger, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '10px 13px', border: 'none',
      background: 'transparent', fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
      color: danger ? '#B91C1C' : '#334155', opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </div>
  )
}
