import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { subMonths } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import { EmptyState } from './impact_shared'
import { buildImpact, buildGoals } from './distanceTravelled'
import {
  Headline, AreaMovement, GoalsPanel, NeedsAttention, GroupComparison, PeopleList,
} from './impactSections'
import OutcomeWizard from './OutcomeWizard'
import PersonPanel from './PersonPanel'
import DataToolsModal from './DataToolsModal'
import Icon from '../../lib/icons'

// Impact is always reported for a period -- "this year", "since we started" --
// because that is the shape of the question a funder asks. The window decides
// which readings count as the baseline and which as the latest, so changing it
// genuinely changes the answer rather than filtering a fixed one.
const PERIODS = [
  { key: '12m', label: '12 months', phrase: 'in the last 12 months', since: () => subMonths(new Date(), 12) },
  { key: '6m', label: '6 months', phrase: 'in the last 6 months', since: () => subMonths(new Date(), 6) },
  { key: '3m', label: '3 months', phrase: 'in the last 3 months', since: () => subMonths(new Date(), 3) },
  { key: 'all', label: 'All time', phrase: 'since you started recording', since: () => null },
]

export default function ImpactOutcomes({ org, isAdmin }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const [children, setChildren] = useState([])
  const [scores, setScores] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('12m')
  const [areaFilter, setAreaFilter] = useState(null)
  const [activeChild, setActiveChild] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardPresetChild, setWizardPresetChild] = useState(null)
  const [dataToolsMode, setDataToolsMode] = useState(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
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

  const periodDef = PERIODS.find(p => p.key === period) || PERIODS[0]
  const since = useMemo(() => periodDef.since(), [periodDef])

  const impact = useMemo(() => buildImpact(scores, children, since), [scores, children, since])
  const goalStats = useMemo(() => buildGoals(goals, since), [goals, since])

  const nameFor = useCallback((childId) => {
    const c = children.find(x => x.id === childId)
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown'
  }, [children])

  const openChild = useCallback((childId) => {
    const c = children.find(x => x.id === childId)
    if (c) setActiveChild(c)
  }, [children])

  const openWizard = (presetChild = null) => { setWizardPresetChild(presetChild); setShowWizard(true) }
  const onScoreAdded = (score) => { setScores(s => [score, ...s]); setShowWizard(false) }

  if (activeChild) {
    return (
      <>
        <PersonPanel
          child={activeChild} org={org} scores={scores} isAdmin={isAdmin}
          onClose={() => setActiveChild(null)}
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
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', letterSpacing: -0.4 }}>Impact &amp; Outcomes</div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>
            How far the {terms.people} you work with have travelled, and what you can show for it
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative', flexShrink: 0 }}>
          {isAdmin && (
            <button onClick={() => openWizard()} style={{ ...btn, border: 'none', background: primary, color: '#fff' }}>
              Record outcome
            </button>
          )}
          <button onClick={() => setShowMoreMenu(v => !v)} style={{ ...btn, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', padding: '11px 14px' }}>
            <Icon name="⋯" />
          </button>
          {showMoreMenu && (
            <>
              <div onClick={() => setShowMoreMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 41,
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
                boxShadow: '0 18px 40px rgba(15,23,42,0.14)', padding: 6, minWidth: 200,
              }}>
                {[
                  { key: 'report', label: 'Build a funder report' },
                  { key: 'export', label: 'Export the data' },
                  ...(isAdmin ? [{ key: 'import', label: 'Import existing scores' }] : []),
                ].map(o => (
                  <button key={o.key} onClick={() => { setDataToolsMode(o.key); setShowMoreMenu(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', minHeight: 42,
                      padding: '10px 12px', borderRadius: 9, border: 'none', background: 'none',
                      fontSize: 13, fontWeight: 700, color: '#334155', cursor: 'pointer', fontFamily: 'inherit',
                    }}>{o.label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 3, background: '#F8FAFC', borderRadius: 12, padding: 4, marginBottom: 18, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            flex: isMobile ? '1 1 40%' : 'none', minHeight: 40,
            padding: '8px 16px', borderRadius: 9, border: 'none',
            background: period === p.key ? '#fff' : 'transparent',
            boxShadow: period === p.key ? '0 1px 3px rgba(0,0,0,0.09)' : 'none',
            color: period === p.key ? primary : '#94A3B8',
            fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
          }}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13, fontWeight: 600 }}>Loading…</div>
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
          <Headline impact={impact} terms={terms} periodLabel={periodDef.phrase} isMobile={isMobile} />

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
            <AreaMovement impact={impact} isMobile={isMobile} activeArea={areaFilter} onSelectArea={setAreaFilter} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <GoalsPanel goals={goalStats} childName={terms.person} periodLabel={periodDef.phrase} />
              <NeedsAttention impact={impact} terms={terms} childName={terms.person} nameFor={nameFor} onOpenChild={openChild} />
            </div>
          </div>

          <GroupComparison impact={impact} children={children} isMobile={isMobile} />

          <PeopleList
            impact={impact} children={children} terms={terms} primary={primary}
            onOpenChild={openChild} areaFilter={areaFilter} isMobile={isMobile}
          />
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
