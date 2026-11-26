import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import { EmptyState } from './impact_shared'
import { buildWorklist } from './distanceTravelled'
import { ToDo, ReportsLink, PeopleToRecord } from './impactSections'
import OutcomeWizard from './OutcomeWizard'
import PersonPanel from './PersonPanel'
import DataToolsModal from './DataToolsModal'
import Icon from '../../lib/icons'

// Where outcome scores and goals are recorded. It used to carry its own
// headline, area and group charts, period picker and a printable report; all of
// that is what Reports now does for any period, from the same scores, so this
// page keeps the work: who needs a reading next, everyone on the roll with a
// quick way to record, and each person's record. The figures are one tap away.

export default function ImpactOutcomes({ org, isAdmin, onNavigate, canSeeReports }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const [children, setChildren] = useState([])
  const [scores, setScores] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeChild, setActiveChild] = useState(null) // { child, tab }
  const [showWizard, setShowWizard] = useState(false)
  const [wizardPresetChild, setWizardPresetChild] = useState(null)
  const [dataToolsMode, setDataToolsMode] = useState(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true)
    const [{ data: kids }, { data: sc }, { data: gl }] = await Promise.all([
      supabase.from('children').select('id,first_name,last_name,school,group_name').eq('org_id', org.id).order('first_name'),
      supabase.from('outcome_scores').select('*').eq('org_id', org.id).order('recorded_at', { ascending: false }),
      supabase.from('goals').select('*').eq('org_id', org.id),
    ])
    setChildren(kids || [])
    setScores(sc || [])
    setGoals(gl || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const work = useMemo(() => buildWorklist(scores, children, goals), [scores, children, goals])

  const nameFor = useCallback((childId) => {
    const c = children.find(x => x.id === childId)
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown'
  }, [children])

  const openChild = useCallback((childId, tab) => {
    const c = children.find(x => x.id === childId)
    if (c) setActiveChild({ child: c, tab })
  }, [children])

  const openWizard = (presetChild = null) => { setWizardPresetChild(presetChild); setShowWizard(true) }
  const recordFor = isAdmin ? (childId) => openWizard(children.find(c => c.id === childId) || null) : null
  const onScoreAdded = (score) => { setScores(s => [score, ...s]); setShowWizard(false) }

  if (activeChild) {
    return (
      <>
        <PersonPanel
          child={activeChild.child} initialTab={activeChild.tab} org={org} scores={scores} isAdmin={isAdmin}
          // Goals change inside the panel, so the to-do list is reread on the way out.
          onClose={() => { setActiveChild(null); load(true) }}
          onRecordOutcome={(c) => openWizard(c)}
          onScoreAdded={onScoreAdded}
        />
        {showWizard && isAdmin && (
          <OutcomeWizard org={org} children={children} presetChild={wizardPresetChild}
            onClose={() => setShowWizard(false)} onSaved={onScoreAdded} />
        )}
      </>
    )
  }

  const btn = {
    padding: '11px 18px', borderRadius: 12, fontWeight: 800, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>Impact &amp; Outcomes</h2>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>
            Record where each {terms.person} starts and how far they move, and keep their goals up to date.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative', flexShrink: 0 }}>
          {isAdmin && (
            <button onClick={() => openWizard()} style={{ ...btn, border: 'none', background: 'var(--org-ink)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="add" size={16} />Record outcome
            </button>
          )}
          <button onClick={() => setShowMoreMenu(v => !v)} aria-label="More options" aria-expanded={showMoreMenu} style={{ ...btn, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', padding: '11px 14px' }}>
            <Icon name="⋯" />
          </button>
          {showMoreMenu && (
            <>
              <div onClick={() => setShowMoreMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 41,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                boxShadow: '0 18px 40px rgba(15,23,42,0.14)', padding: 6, minWidth: 200,
              }}>
                {[
                  { key: 'export', label: 'Export the data' },
                  ...(isAdmin ? [{ key: 'import', label: 'Import existing scores' }] : []),
                ].map(o => (
                  <button key={o.key} onClick={() => { setDataToolsMode(o.key); setShowMoreMenu(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', minHeight: 42,
                      padding: '10px 12px', borderRadius: 9, border: 'none', background: 'none',
                      fontSize: 13, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>{o.label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}>Loading…</div>
      ) : scores.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No outcomes have been recorded yet"
          subtitle={`Record where each ${terms.person} is starting from, then record again later — the gap between the two is the impact you can show.`}
          {...(isAdmin ? {
            primaryLabel: 'Record the first outcome', onPrimary: () => openWizard(),
            secondaryLabel: 'Import existing data', onSecondary: () => setDataToolsMode('import'),
          } : {})}
          primary={primary}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ToDo work={work} nameFor={nameFor} onOpenChild={openChild} onRecord={recordFor} terms={terms} primary={primary} isMobile={isMobile} />
          <ReportsLink totals={work.totals} terms={terms}
            onOpenReport={canSeeReports && onNavigate ? () => onNavigate('reports', { openReport: 'impact' }) : null}
            onOpenReports={canSeeReports && onNavigate ? () => onNavigate('reports') : null} />
          <PeopleToRecord children={children} work={work} terms={terms} primary={primary}
            onOpenChild={openChild} onRecord={recordFor} isMobile={isMobile} />
        </div>
      )}

      {showWizard && isAdmin && (
        <OutcomeWizard org={org} children={children} presetChild={wizardPresetChild}
          onClose={() => setShowWizard(false)} onSaved={onScoreAdded} />
      )}

      {dataToolsMode && (
        <DataToolsModal mode={dataToolsMode} org={org} children={children} scores={scores} goals={goals}
          onClose={() => setDataToolsMode(null)} onImported={load} />
      )}
    </div>
  )
}
