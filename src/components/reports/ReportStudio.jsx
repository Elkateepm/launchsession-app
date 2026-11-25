import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../lib/icons'
import { KPI_DEFS, buildFacts, formatRange, redactForViewer } from '../../lib/insights'
import {
  SECTIONS, SECTION_GROUPS, canSaveReports, csvFilename, definitionFromTemplate, definitionRange,
  definitionToRow, docsNeeded, isAdminRole, reportCsvBlocks, sanitizeDefinition, sectionAvailability,
  sectionByKey, sectionLabel, templateByKey, templatesFor, toCsv,
} from '../../lib/reportStudio'
import {
  downloadCsv, insertReportDefinition, loadDocs, loadInsights, saveErrorMessage, updateReportDefinition,
} from '../../lib/insightsService'
import { INK, PAPER, PRINT_CSS, toBody } from './docShared'
import StudioDocument from './StudioDocument'
import { MultiSelectSheet, PeriodPicker, btn, card, chipStyle } from './insightsUi'

// The report studio: pick a template or start blank, choose the period, the
// projects and groups and the sections, watch the report build itself
// alongside, then print it as a PDF, download its tables as CSV, or save it
// to run again next time.

// The document prints on its own: the shared print rules hide the app, and
// these hide the studio's own panels and the placeholders for unwritten text.
const STUDIO_PRINT_CSS = `
@media print {
  #ls-studio-panel, #ls-studio-tabs, #ls-studio-actions, .ls-studio-placeholder { display: none !important; }
  #ls-studio-layout { display: block !important; height: auto !important; }
  #ls-studio-preview { display: block !important; overflow: visible !important; height: auto !important; padding: 0 !important; background: #fff !important; }
}
`

const field = (isMobile) => ({
  width: '100%', boxSizing: 'border-box', minHeight: isMobile ? 44 : 40, padding: '0 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
})

function PanelBlock({ title, hint, children }) {
  return (
    <section style={{ padding: '16px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <h3 style={{ margin: 0, fontSize: 12, fontWeight: 850, color: 'var(--text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{title}</h3>
      {hint && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.45 }}>{hint}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  )
}

function Toggle({ checked, onChange, label, hint, isMobile }) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', minHeight: isMobile ? 44 : 36, padding: '4px 0' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--org-ink)', flexShrink: 0 }} />
      <span>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>{hint}</span>}
      </span>
    </label>
  )
}

const iconBtn = (isMobile, disabled) => ({
  width: isMobile ? 40 : 32, height: isMobile ? 40 : 32, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)',
  color: disabled ? 'var(--text-faint)' : 'var(--text2)', cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, padding: 0,
})

function TemplateGallery({ role, terms, isMobile, onPick }) {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: isMobile ? '18px 16px 40px' : '30px 28px 60px' }}>
      <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.6 }}>What kind of report?</h2>
      <p style={{ margin: '6px 0 20px', fontSize: 14, color: 'var(--text3)', lineHeight: 1.5 }}>
        Start from a template and change anything you like. You will see the report build as you go.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {templatesFor(role).map(t => (
          <button key={t.key} type="button" onClick={() => onPick(t.key)} style={{
            ...card({ padding: 18, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'inherit' }),
            borderStyle: t.key === 'blank' ? 'dashed' : 'solid',
          }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--org-a10, var(--surface2))', color: 'var(--org-ink)' }}>
              <Icon name={t.icon} size={20} />
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 850, color: 'var(--text)' }}>
              {t.name}{t.restricted && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: 'var(--warn-text)', background: 'var(--warn-bg)', borderRadius: 99, padding: '2px 8px', verticalAlign: 2 }}>Admins</span>}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}>{t.blurb}</span>
            {t.key !== 'blank' && (() => {
              const shown = t.sections.filter(k => !['narrative', 'closing'].includes(k))
              return (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                  {shown.slice(0, 5).map(k => (
                    <span key={k} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text2)', background: 'var(--surface2)', borderRadius: 99, padding: '3px 8px' }}>{sectionLabel(k, terms)}</span>
                  ))}
                  {shown.length > 5 && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', padding: '3px 4px' }}>+{shown.length - 5} more</span>}
                </span>
              )
            })()}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReportStudio({ org, session, role, terms, isMobile, initial, onClose, onSaved }) {
  const isAdmin = isAdminRole(role)
  const canSave = canSaveReports(role)
  const [def, setDef] = useState(() => (initial ? sanitizeDefinition({ ...definitionFromTemplate(initial.template), ...initial }, { isAdmin }) : null))
  const [savedId, setSavedId] = useState(initial?.savedId || null)
  const [model, setModel] = useState(null)
  const [docs, setDocs] = useState({})
  const [loadingDocs, setLoadingDocs] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState('edit')
  const [sheet, setSheet] = useState(null)
  const docCache = useRef({})
  const request = useRef(0)

  const range = useMemo(() => (def ? definitionRange(def) : null), [def])
  const update = useCallback((patch) => setDef(d => ({ ...d, ...patch })), [])

  // Figures follow the period and filters, not every keystroke in the title.
  const rangeKey = range?.valid ? `${range.from}|${range.to}` : ''
  const filterKey = def ? `${def.projects.join(',')}|${def.groups.join(',')}` : ''
  useEffect(() => {
    if (!def || !range?.valid) return
    const id = ++request.current
    setError('')
    loadInsights({ from: range.from, to: range.to, projects: def.projects, groups: def.groups })
      .then(m => { if (id === request.current) setModel(redactForViewer(m, isAdmin)) })
      .catch(e => { if (id === request.current) setError(e.message || 'Could not load the figures.') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, filterKey, isAdmin])

  const needed = def ? docsNeeded(def).join(',') : ''
  useEffect(() => {
    if (!def || !range?.valid) return
    const keys = docsNeeded(def)
    const missing = keys.filter(k => !(`${k}|${rangeKey}` in docCache.current))
    const fromCache = () => Object.fromEntries(keys.map(k => [k, docCache.current[`${k}|${rangeKey}`]]))
    if (!missing.length) { setDocs(fromCache()); return }
    setLoadingDocs(missing)
    loadDocs(missing, { from: range.from, to: range.to })
      .then(found => { Object.entries(found).forEach(([k, v]) => { docCache.current[`${k}|${rangeKey}`] = v }); setDocs(fromCache()) })
      .catch(e => setError(e.message || 'Could not load part of the report.'))
      .finally(() => setLoadingDocs([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, rangeKey])

  const options = model?.options || { projects: [], groups: [] }
  const caps = model?.capabilities || {}
  const filterLabels = def ? [
    ...def.projects.map(id => `Project: ${options.projects.find(p => p.id === id)?.name || 'a project'}`),
    ...def.groups.map(g => `${terms.Group}: ${g}`),
  ] : []

  const move = (key, dir) => {
    const list = [...def.sections]
    const i = list.indexOf(key)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    update({ sections: list })
  }
  const remove = (key) => update({ sections: def.sections.filter(k => k !== key) })
  const add = (key) => update({ sections: [...def.sections.filter(k => k !== 'closing'), key, ...(def.sections.includes('closing') ? ['closing'] : [])] })

  const exportCsv = () => {
    downloadCsv(csvFilename(def.title, range), toCsv(reportCsvBlocks(def, { model, docs, terms, org, range, isAdmin, filterLabels })))
  }

  const save = async (asCopy = false) => {
    if (!canSave || !range) return
    setSaving(true); setNotice(null)
    try {
      const row = definitionToRow(def, range)
      const saved = savedId && !asCopy
        ? await updateReportDefinition(savedId, row)
        : await insertReportDefinition(org.id, session?.user?.id, asCopy ? { ...row, name: `${row.name} (copy)`, configuration: { ...def, title: `${def.title} (copy)` } } : row)
      setSavedId(saved.id)
      if (asCopy) update({ title: `${def.title} (copy)` })
      setNotice({ tone: 'ok', text: savedId && !asCopy ? 'Saved. Opening it again later reruns it on the latest records.' : 'Saved to Your reports. Open it any time to run it again on the latest records.' })
      onSaved?.()
    } catch (e) {
      setNotice({ tone: 'error', text: saveErrorMessage(e) })
    }
    setSaving(false)
  }

  const useFactsAsIntro = () => {
    const facts = buildFacts(model, terms, { max: 5 }).filter(f => f.tone !== 'info').map(f => f.text)
    if (!facts.length) return
    const intro = `This report covers ${formatRange(range.from, range.to)}.`
    update({ text: { ...def.text, narrative: `${intro}\n\n${facts.join(' ')}` } })
  }

  // ── template chooser
  if (!def) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10500, background: 'var(--bg, var(--surface-hover))', overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: isMobile ? '10px 14px' : '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onClose} style={btn('ghost', isMobile)}><Icon name="close" size={15} />Close</button>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>New report</div>
        </div>
        <TemplateGallery role={role} terms={terms} isMobile={isMobile} onPick={(key) => setDef(definitionFromTemplate(key))} />
      </div>
    )
  }

  const tmpl = templateByKey(def.template)
  const inReport = def.sections
  const notInReport = SECTIONS.filter(s => !inReport.includes(s.key))
  const hasNamedDocs = inReport.some(k => ['doc_attendance', 'doc_young_people', 'doc_impact', 'doc_team'].includes(k))
  const panel = (
    <div id="ls-studio-panel" style={{
      ...(isMobile ? { display: tab === 'edit' ? 'block' : 'none', padding: '4px 16px 110px' } : { width: 380, flexShrink: 0, overflowY: 'auto', padding: '6px 20px 40px', borderRight: '1px solid var(--border)', background: 'var(--surface)' }),
      boxSizing: 'border-box',
    }}>
      <PanelBlock title="Report">
        <input aria-label="Report title" value={def.title} onChange={e => update({ title: e.target.value.slice(0, 120) })} style={{ ...field(isMobile), fontWeight: 800, fontSize: 15 }} />
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>Started from: {tmpl.name}</div>
      </PanelBlock>

      <PanelBlock title="Period" hint={range?.valid ? `${range.label}. Changes are measured against the same length of time before it.` : null}>
        <PeriodPicker value={def.period} onChange={p => update({ period: p.key === 'custom' ? { key: 'custom', from: p.from || (range?.valid ? range.from : ''), to: p.to || (range?.valid ? range.to : '') } : { key: p.key } })} isMobile={isMobile} problem={range?.valid ? null : range?.problem} wrap />
      </PanelBlock>

      <PanelBlock title="What it covers" hint={caps.filters === false ? 'Everything your organisation delivered. Project and group choices arrive with the reporting update.' : 'Everything, or just some projects and groups.'}>
        {caps.filters !== false && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setSheet('projects')} style={chipStyle(def.projects.length > 0, isMobile)}><Icon name="projects" size={14} />{def.projects.length ? `${def.projects.length} project${def.projects.length === 1 ? '' : 's'}` : 'All projects'}</button>
            <button type="button" onClick={() => setSheet('groups')} style={chipStyle(def.groups.length > 0, isMobile)}><Icon name="groups" size={14} />{def.groups.length ? `${def.groups.length} ${terms.group}${def.groups.length === 1 ? '' : 's'}` : `All ${terms.group}s`}</button>
          </div>
        )}
        {filterLabels.length > 0 && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5 }}>{filterLabels.join(' · ')}</div>}
      </PanelBlock>

      <PanelBlock title="In your report" hint="In the order they appear. Use the arrows to move them.">
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {inReport.map((k, i) => {
            const s = sectionByKey(k)
            const avail = sectionAvailability(k, { isAdmin, capabilities: caps })
            return (
              <li key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 10px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <span style={{ width: 20, fontSize: 11, fontWeight: 800, color: 'var(--text-faint)', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{sectionLabel(k, terms)}</span>
                  {!avail.ok && <span style={{ display: 'block', fontSize: 11, color: 'var(--warn-text)' }}>{avail.reason}</span>}
                  {avail.ok && s.kind === 'doc' && <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)' }}>{s.desc}</span>}
                </span>
                <button type="button" aria-label={`Move ${sectionLabel(k, terms)} up`} disabled={i === 0} onClick={() => move(k, -1)} style={iconBtn(isMobile, i === 0)}>↑</button>
                <button type="button" aria-label={`Move ${sectionLabel(k, terms)} down`} disabled={i === inReport.length - 1} onClick={() => move(k, 1)} style={iconBtn(isMobile, i === inReport.length - 1)}>↓</button>
                <button type="button" aria-label={`Remove ${sectionLabel(k, terms)}`} onClick={() => remove(k)} style={iconBtn(isMobile, false)}><Icon name="close" size={14} /></button>
              </li>
            )
          })}
        </ol>
        {inReport.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Add a section below to start.</div>}
      </PanelBlock>

      <PanelBlock title="Add a section">
        {SECTION_GROUPS.map(g => {
          const list = notInReport.filter(s => s.group === g)
          if (!list.length) return null
          return (
            <div key={g} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-faint)', margin: '4px 0 6px' }}>{g}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {list.map(s => {
                  const avail = sectionAvailability(s.key, { isAdmin, capabilities: caps })
                  if (s.restricted && !isAdmin) return null
                  return (
                    <button key={s.key} type="button" onClick={() => avail.ok && add(s.key)} disabled={!avail.ok} style={{
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', minHeight: isMobile ? 48 : 40, padding: '6px 10px', borderRadius: 10,
                      border: '1px dashed var(--border)', background: 'transparent', cursor: avail.ok ? 'pointer' : 'default', fontFamily: 'inherit', opacity: avail.ok ? 1 : 0.6,
                    }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--org-a10, var(--surface2))', color: 'var(--org-ink)', flexShrink: 0 }}><Icon name="add" size={14} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{sectionLabel(s.key, terms)}</span>
                        <span style={{ display: 'block', fontSize: 11, color: avail.ok ? 'var(--text3)' : 'var(--warn-text)', lineHeight: 1.35 }}>{avail.ok ? s.desc : avail.reason}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </PanelBlock>

      {inReport.includes('headline') && (
        <PanelBlock title="Headline figures" hint="Up to eight. Each shows the change on the period before.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {KPI_DEFS.filter(k => !k.restricted || isAdmin).filter(k => k.key !== 'volunteer_hours' || caps.volunteerHours !== false).map(k => {
              const on = def.kpis.includes(k.key)
              return (
                <button key={k.key} type="button" aria-pressed={on} onClick={() => update({ kpis: on ? def.kpis.filter(x => x !== k.key) : [...def.kpis, k.key].slice(0, 8) })} style={chipStyle(on, isMobile)}>
                  {on && <Icon name="check" size={13} strokeWidth={2.5} />}{k.label(terms)}
                </button>
              )
            })}
          </div>
        </PanelBlock>
      )}

      {(inReport.includes('narrative') || inReport.includes('closing')) && (
        <PanelBlock title="Your words" hint="Plain text. Leave a blank line between paragraphs.">
          {inReport.includes('narrative') && (
            <>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', display: 'block', marginBottom: 6 }} htmlFor="ls-studio-intro">Introduction</label>
              <textarea id="ls-studio-intro" value={def.text.narrative} onChange={e => update({ text: { ...def.text, narrative: e.target.value.slice(0, 4000) } })} rows={6}
                placeholder="Who you are, what this period was about, and what you would like the reader to take away."
                style={{ ...field(isMobile), minHeight: 120, padding: 12, lineHeight: 1.5, resize: 'vertical' }} />
              {model && <button type="button" onClick={useFactsAsIntro} style={{ ...btn('quiet', isMobile), padding: 0, marginTop: 4, fontSize: 12.5 }}>Start from the key findings</button>}
            </>
          )}
          {inReport.includes('closing') && (
            <>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', display: 'block', margin: '12px 0 6px' }} htmlFor="ls-studio-closing">Closing words</label>
              <textarea id="ls-studio-closing" value={def.text.closing} onChange={e => update({ text: { ...def.text, closing: e.target.value.slice(0, 4000) } })} rows={4}
                placeholder="Thanks to funders and volunteers, what comes next, who to contact."
                style={{ ...field(isMobile), minHeight: 90, padding: 12, lineHeight: 1.5, resize: 'vertical' }} />
            </>
          )}
        </PanelBlock>
      )}

      <PanelBlock title="Options">
        <Toggle isMobile={isMobile} checked={def.showTables} onChange={v => update({ showTables: v })} label="Show the figures under each chart" hint="Adds a small table beneath every chart and breakdown." />
        {hasNamedDocs && (
          <Toggle isMobile={isMobile} checked={def.includeNames} onChange={v => update({ includeNames: v })} label={`Include named lists of ${terms.people}`}
            hint={`Off by default. Some in-depth sections can list ${terms.people} by name, such as the most often absent. Turn on only for a report that stays inside your organisation.`} />
        )}
      </PanelBlock>
    </div>
  )

  const actions = (
    <>
      <button type="button" onClick={exportCsv} disabled={!model} style={{ ...btn('ghost', isMobile), flex: isMobile ? 1 : undefined }}><Icon name="export" size={15} />CSV</button>
      <button type="button" onClick={() => window.print()} disabled={!model || !range?.valid} style={{ ...btn('ghost', isMobile), flex: isMobile ? 1 : undefined }}><Icon name="print" size={15} />{isMobile ? 'PDF' : 'Print or PDF'}</button>
      {canSave && <button type="button" onClick={() => save(false)} disabled={saving || !range?.valid} style={{ ...btn('primary', isMobile), flex: isMobile ? 1.3 : undefined, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : savedId ? 'Save changes' : 'Save'}</button>}
    </>
  )

  return toBody(
    <div id="ls-doc-print-root" style={{ position: 'fixed', inset: 0, zIndex: 10500, background: 'var(--surface-hover)', display: 'flex', flexDirection: 'column' }}>
      <style>{PRINT_CSS}{STUDIO_PRINT_CSS}</style>
      <div id="ls-doc-toolbar" style={{ flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: isMobile ? '10px 14px' : '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onClose} style={btn('ghost', isMobile)} aria-label="Close the report studio"><Icon name="close" size={15} />{isMobile ? '' : 'Close'}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{range?.valid ? range.label : 'Choose a period'}{savedId ? ' · saved' : ''}</div>
        </div>
        {!isMobile && <div style={{ display: 'flex', gap: 8 }}>
          {savedId && canSave && <button type="button" onClick={() => save(true)} disabled={saving} style={btn('quiet', isMobile)}>Save a copy</button>}
          {actions}
        </div>}
      </div>

      {isMobile && (
        <div id="ls-studio-tabs" role="tablist" aria-label="Studio view" style={{ flexShrink: 0, display: 'flex', gap: 4, padding: 4, margin: '10px 16px 0', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {[['edit', 'Build'], ['preview', 'Preview']].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{
              flex: 1, minHeight: 40, border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              background: tab === k ? 'var(--org-solid, var(--org-ink))' : 'transparent', color: tab === k ? 'var(--org-on-solid, #fff)' : 'var(--text2)',
            }}>{l}</button>
          ))}
        </div>
      )}

      {(notice || error) && (
        <div role={notice?.tone === 'error' || error ? 'alert' : 'status'} style={{
          flexShrink: 0, margin: isMobile ? '10px 16px 0' : '10px 20px 0', padding: '10px 14px', borderRadius: 11, fontSize: 12.5, fontWeight: 650, display: 'flex', gap: 10, alignItems: 'center',
          background: error || notice?.tone === 'error' ? 'var(--danger-bg)' : 'var(--ok-bg)', color: error || notice?.tone === 'error' ? 'var(--danger-text)' : 'var(--ok-text)',
          border: `1px solid ${error || notice?.tone === 'error' ? 'var(--danger-border)' : 'var(--ok-border)'}`,
        }}>
          <span style={{ flex: 1 }}>{error || notice.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => { setNotice(null); setError('') }} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 4 }}><Icon name="close" size={14} /></button>
        </div>
      )}

      <div id="ls-studio-layout" style={{ flex: 1, minHeight: 0, display: isMobile ? 'block' : 'flex', overflowY: isMobile ? 'auto' : 'hidden' }}>
        {panel}
        <div id="ls-studio-preview" style={{
          ...(isMobile ? { display: tab === 'preview' ? 'block' : 'none', padding: '12px 10px 110px' } : { flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 28px 60px' }),
          boxSizing: 'border-box',
        }}>
          {!isMobile && <div className="ls-studio-placeholder" style={{ maxWidth: 820, margin: '0 auto 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, border: 'none', padding: 0 }}>
            <Icon name="view" size={14} />Live preview. This is what prints.
          </div>}
          <div id="ls-doc-paper" style={{
            maxWidth: 820, margin: '0 auto', background: PAPER, color: INK, boxSizing: 'border-box',
            padding: isMobile ? '24px 18px' : '46px 52px', borderRadius: isMobile ? 12 : 4, boxShadow: '0 10px 40px rgba(15,23,42,0.10)',
          }}>
            <StudioDocument def={def} model={model} docs={docs} org={org} terms={terms} range={range} isAdmin={isAdmin}
              isMobile={isMobile} filterLabels={filterLabels} loadingDocs={loadingDocs} />
          </div>
        </div>
      </div>

      {isMobile && (
        <div id="ls-studio-actions" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 3, display: 'flex', gap: 8, padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -8px 24px rgba(15,23,42,0.08)' }}>
          {actions}
        </div>
      )}

      {sheet === 'projects' && (
        <MultiSelectSheet title="Projects" isMobile={isMobile} hint={`Only ${terms.sessions} that belong to the projects you pick.`}
          options={options.projects.map(p => ({ value: p.id, label: p.name, hint: p.archived ? 'Archived' : null }))}
          selected={def.projects} onChange={v => update({ projects: v })} onClose={() => setSheet(null)} emptyText="You have no projects yet." />
      )}
      {sheet === 'groups' && (
        <MultiSelectSheet title={terms.Groups || 'Groups'} isMobile={isMobile} hint={`Only ${terms.people} in the ${terms.group}s you pick, and the ${terms.sessions} planned for them.`}
          options={options.groups.map(g => ({ value: g, label: g }))}
          selected={def.groups} onChange={v => update({ groups: v })} onClose={() => setSheet(null)} emptyText={`No ${terms.group}s are set on your ${terms.people} yet.`} />
      )}
    </div>,
  )
}

