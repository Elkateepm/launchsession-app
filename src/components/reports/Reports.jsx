import React, { useState, useEffect, useCallback } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import {
  rangeFor, getOverviewMetrics, getInsightExtras, getSessionLearningMetrics, deriveInsights,
  listSavedReports, renameReport, deleteReport, duplicateReport,
  REPORT_LIBRARY, REPORT_CATEGORIES, canAccessReport,
} from '../../lib/reportingService'
import { definitionFromRow, definitionFromTemplate, definitionRange, canSaveReports, isAdminRole, templateByKey, templatesFor } from '../../lib/reportStudio'
import { markReportRun } from '../../lib/insightsService'
import { formatDay } from '../../lib/insights'
import FunderReport from './FunderReport'
import ReportDocument from './ReportDocument'
import ReportStudio from './ReportStudio'
import InsightsHome from './InsightsHome'
import { btn, card } from './insightsUi'
import OrgPageHero, { orgBrand, heroButtons } from '../shared/OrgPageHero'
import { hasDocument } from '../../lib/reportDocs'
import Icon from '../../lib/icons'

// Reports & Insights.
//
//   Insights     how the work is going: figures against the period before,
//                trends, breakdowns and plain-language findings
//   Your reports start a report from a template, and the saved ones to rerun
//   Ready-made   the single-purpose documents (funder, attendance, safeguarding…)

const VIEWS = [
  { key: 'insights', label: 'Insights', icon: 'insights' },
  { key: 'reports', label: 'Your reports', icon: 'reports' },
  { key: 'library', label: 'Ready-made', icon: 'templates' },
]

const TONES = {
  indigo: { bg: 'var(--info-bg)', bd: 'var(--info-border)', fg: 'var(--info-text)' },
  blue: { bg: 'var(--info-bg)', bd: 'var(--info-border)', fg: 'var(--info-text)' },
  green: { bg: 'var(--ok-bg)', bd: 'var(--ok-border)', fg: 'var(--ok-text)' },
  amber: { bg: 'var(--warn-bg)', bd: 'var(--warn-border)', fg: 'var(--warn-text)' },
  red: { bg: 'var(--danger-bg)', bd: 'var(--danger-border)', fg: 'var(--danger-text)' },
  slate: { bg: 'var(--surface2)', bd: 'var(--border)', fg: 'var(--text2)' },
}

const CATEGORY_TONE = {
  Delivery: 'indigo', Attendance: 'green', 'Young People': 'blue',
  Impact: 'amber', Team: 'blue', Safeguarding: 'red', Funding: 'green',
}

export default function Reports({ org, session, userProfile, onNavigate }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const orgId = org?.id
  const role = userProfile?.role || 'staff'

  const [view, setView] = useState('insights')
  const [range, setRange] = useState(() => rangeFor('90d'))
  const [attention, setAttention] = useState([])
  const [savedReports, setSavedReports] = useState([])
  const [studio, setStudio] = useState(null)
  const [showFunder, setShowFunder] = useState(false)
  const [docReport, setDocReport] = useState(null)

  // The action prompts -- unmarked registers, repeat absence, open concerns,
  // reflections due -- each come from their own small query. They are a
  // sidebar to the figures, so a failure here leaves the page working.
  const loadAttention = useCallback(async () => {
    if (!orgId || !range?.from) return
    try {
      const [m, x, learning] = await Promise.all([
        getOverviewMetrics(range),
        getInsightExtras(orgId, range),
        getSessionLearningMetrics(range).catch(() => null),
      ])
      // The findings on the page already say whether attendance rose or fell
      // and what was recorded; only the prompts that ask for an action stay.
      setAttention(deriveInsights(m, { ...x, learning: learning || {} }).filter(i => i.tone !== 'good' && !i.key.startsWith('attendance')))
    } catch { setAttention([]) }
  }, [orgId, range])

  const loadSaved = useCallback(async () => {
    if (!orgId) return
    try { setSavedReports(await listSavedReports(orgId)) } catch { /* RLS hides restricted rows */ }
  }, [orgId])

  useEffect(() => { loadAttention() }, [loadAttention])
  useEffect(() => { loadSaved() }, [loadSaved])

  const onRangeChange = useCallback((r) => {
    setRange(prev => (prev?.from === r.from && prev?.to === r.to ? prev : r))
  }, [])

  const goto = (target) => {
    const map = { attendance: 'registers', safeguarding: 'safeguarding', impact: 'impact_outcomes', sessions: 'planner' }
    if (onNavigate && map[target]) onNavigate(map[target])
  }

  const openSaved = (row) => {
    setStudio({ initial: definitionFromRow(row, { isAdmin: isAdminRole(role) }) })
    markReportRun(row.id).catch(() => {})
  }

  const brand = orgBrand(org)
  const onHero = heroButtons(brand, {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 18px',
    borderRadius: 12, border: '1px solid transparent', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <div style={{ padding: isMobile ? 16 : 28, width: '100%', boxSizing: 'border-box', maxWidth: 1280, margin: '0 auto' }}>
      <OrgPageHero org={org} mobile={isMobile} title="Reports & Insights"
        subtitle={`How your work is going, in numbers and plain words, and reports you can send to funders and trustees.`}
        label={savedReports.length ? 'Saved reports' : null}
        detail={savedReports.length ? `${savedReports.length} ready to rerun` : null}
        actions={<>
          <button type="button" onClick={() => setStudio({ initial: null })} style={{ ...onHero.main, flex: isMobile ? 1 : undefined }}><Icon name="add" size={16} />New report</button>
          {/* On a phone the tabs below already offer this, and two buttons
              side by side squeeze the label onto two lines. */}
          {!isMobile && <button type="button" onClick={() => setView('library')} style={onHero.quiet}>Ready-made reports</button>}
        </>} />

      <div role="tablist" aria-label="Reports sections" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 13, background: 'var(--surface-hover)', border: '1px solid var(--border)', marginBottom: 14, width: isMobile ? '100%' : 'fit-content', boxSizing: 'border-box' }}>
        {VIEWS.map(v => {
          const on = view === v.key
          return (
            <button key={v.key} type="button" role="tab" aria-selected={on} onClick={() => setView(v.key)} style={{
              flex: isMobile ? 1 : undefined, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              minHeight: isMobile ? 42 : 36, padding: isMobile ? '0 6px' : '0 16px', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: isMobile ? 12.5 : 13, fontWeight: 800, whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--org-ink)' : 'var(--text3)',
              boxShadow: on ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
            }}>{!isMobile && <Icon name={v.icon} size={15} />}{v.label}</button>
          )
        })}
      </div>

      {view === 'insights' && (
        <InsightsHome org={org} role={role} terms={terms} isMobile={isMobile}
          attention={attention} onAttention={goto} onRangeChange={onRangeChange}
          onBuildReport={(prefill) => setStudio({ initial: prefill })} />
      )}

      {view === 'reports' && (
        <YourReports role={role} terms={terms} isMobile={isMobile} reports={savedReports} orgId={orgId} session={session}
          onChanged={loadSaved} onOpen={openSaved}
          onStart={(key) => setStudio({ initial: definitionFromTemplate(key) })} />
      )}

      {view === 'library' && (
        <LibraryView role={role} isMobile={isMobile} onRun={(key) => {
          if (key === 'funding') setShowFunder(true)
          else if (hasDocument(key)) setDocReport({ key, name: REPORT_LIBRARY.find(r => r.key === key)?.name || 'Report' })
        }} />
      )}

      {showFunder && <FunderReport org={org} range={range} onClose={() => setShowFunder(false)} />}

      {docReport && (
        <ReportDocument reportKey={docReport.key} title={docReport.name} org={org} range={range} onClose={() => setDocReport(null)} />
      )}

      {studio && (
        <ReportStudio org={org} session={session} role={role} terms={terms} isMobile={isMobile}
          initial={studio.initial} onClose={() => setStudio(null)} onSaved={loadSaved} />
      )}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <h2 style={{ margin: '22px 0 10px', fontSize: 12, fontWeight: 800, color: 'var(--text3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</h2>
  )
}

function YourReports({ role, terms, isMobile, reports, orgId, session, onChanged, onOpen, onStart }) {
  const [menuId, setMenuId] = useState(null)
  const [busy, setBusy] = useState(false)
  const canSave = canSaveReports(role)

  const act = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { window.alert(e.message || 'That did not work.') }
    setBusy(false); setMenuId(null); onChanged()
  }

  return (
    <>
      <SectionLabel>Start a report</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        {templatesFor(role).map(t => (
          <button key={t.key} type="button" onClick={() => onStart(t.key)} style={{
            ...card({ padding: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: 'inherit' }),
            borderStyle: t.key === 'blank' ? 'dashed' : 'solid',
          }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--org-a10, var(--surface2))', color: 'var(--org-ink)', flexShrink: 0 }}><Icon name={t.icon} size={18} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{t.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      <SectionLabel>Saved reports</SectionLabel>
      {!canSave && (
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
          You can build, print and download reports. Saving them for the team needs an owner, admin or staff login.
        </div>
      )}
      {reports.length === 0 ? (
        <div style={card({ padding: isMobile ? 24 : 32, textAlign: 'center' })}>
          <div style={{ width: 44, height: 44, borderRadius: 13, margin: '0 auto 10px', display: 'grid', placeItems: 'center', background: 'var(--surface2)', color: 'var(--text3)' }}><Icon name="reports" size={22} /></div>
          <div style={{ fontSize: 15, fontWeight: 850, color: 'var(--text)' }}>No saved reports yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 5, lineHeight: 1.5, maxWidth: 420, marginInline: 'auto' }}>
            Save a report once and run it again whenever you need it. It always uses the latest records, so next term’s board summary is two clicks away.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map(r => {
            const def = definitionFromRow(r, { isAdmin: isAdminRole(role) })
            const t = templateByKey(def.template)
            const range = definitionRange(def)
            return (
              <div key={r.id} style={card({ padding: isMobile ? 12 : 14, display: 'flex', alignItems: 'center', gap: 12 })}>
                <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--org-a10, var(--surface2))', color: 'var(--org-ink)', flexShrink: 0 }}><Icon name={t.icon} size={18} /></span>
                <button type="button" onClick={() => onOpen(r)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 850, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {t.name} · {def.period.key === 'custom' ? range.label : `${range.label} when run`}
                    {def.projects.length + def.groups.length > 0 ? ` · ${def.projects.length + def.groups.length} filter${def.projects.length + def.groups.length === 1 ? '' : 's'}` : ''}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {r.last_run_at ? `Last opened ${formatDay(r.last_run_at.slice(0, 10), { year: true })}` : `Saved ${formatDay((r.created_at || '').slice(0, 10), { year: true })}`}
                  </span>
                </button>
                {!isMobile && <button type="button" onClick={() => onOpen(r)} style={btn('ghost', isMobile)}>Open</button>}
                {canSave && (
                  <div style={{ position: 'relative' }}>
                    <button type="button" aria-label={`More for ${r.name}`} aria-expanded={menuId === r.id} onClick={() => setMenuId(menuId === r.id ? null : r.id)} style={{ ...btn('ghost', isMobile), width: isMobile ? 44 : 38, padding: 0 }}>⋯</button>
                    {menuId === r.id && (
                      <>
                        <div onClick={() => setMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 10380 }} />
                        <div role="menu" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 10390, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, minWidth: 180, overflow: 'hidden', boxShadow: '0 12px 32px rgba(15,23,42,0.16)' }}>
                          <MenuItem disabled={busy} onClick={() => act(() => duplicateReport(orgId, session?.user?.id, r))}>Duplicate</MenuItem>
                          <MenuItem disabled={busy} onClick={() => {
                            const name = window.prompt('Rename report', r.name)
                            if (name && name.trim()) act(() => renameReport(r.id, name.trim().slice(0, 120)))
                          }}>Rename</MenuItem>
                          <MenuItem danger disabled={busy} onClick={() => {
                            if (window.confirm(`Delete "${r.name}"? The report definition is removed for everyone. Your records are not affected.`)) act(() => deleteReport(r.id))
                          }}>Delete</MenuItem>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
      <div style={{ margin: '6px 0 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 850, color: 'var(--text)' }}>Ready-made reports</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3 }}>Single-purpose documents, each answering one question in depth. Pick one, set the dates, print.</div>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search reports" aria-label="Search ready-made reports"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 14px', borderRadius: 11, border: '1px solid var(--border)', fontSize: 14, outline: 'none', marginBottom: 10, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        {REPORT_CATEGORIES.map(c => (
          <button key={c} type="button" onClick={() => setCat(c)} style={{
            minHeight: isMobile ? 40 : 34, padding: '0 13px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
            border: cat === c ? '1.5px solid var(--org-ink)' : '1px solid var(--border)',
            background: cat === c ? 'var(--org-a10, var(--info-bg))' : 'var(--surface)', color: cat === c ? 'var(--org-ink)' : 'var(--text2)',
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {list.map(r => {
          const allowed = canAccessReport(r, role)
          const tone = TONES[CATEGORY_TONE[r.category]] || TONES.slate
          return (
            <div key={r.key} style={card({ padding: 18, opacity: allowed ? 1 : 0.6, display: 'flex', flexDirection: 'column' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: tone.bg, border: `1px solid ${tone.bd}` }}><Icon name={r.icon} /></span>
                <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 99, padding: '3px 9px', color: tone.fg, background: tone.bg }}>{r.category}</span>
                {r.restricted && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--warn-text)', background: 'var(--warn-bg)', borderRadius: 99, padding: '3px 9px' }}>Restricted</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{r.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 5, lineHeight: 1.5, flex: 1 }}>{r.desc}</div>
              <button type="button" onClick={() => allowed && onRun(r.key)} disabled={!allowed} style={{ ...btn(allowed ? 'primary' : 'ghost', isMobile), marginTop: 14, alignSelf: 'flex-start', cursor: allowed ? 'pointer' : 'not-allowed' }}>
                {allowed ? 'Open report' : 'Owners and admins only'}
              </button>
            </div>
          )
        })}
        {list.length === 0 && (
          <div style={card({ padding: 30, textAlign: 'center', gridColumn: '1 / -1' })}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No reports match that search.</div>
          </div>
        )}
      </div>
    </>
  )
}

function MenuItem({ children, onClick, danger, disabled }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} style={{
      display: 'block', width: '100%', textAlign: 'left', minHeight: 42, padding: '0 14px', border: 'none',
      background: 'transparent', fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      color: danger ? 'var(--danger-text)' : 'var(--text2)', opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  )
}
