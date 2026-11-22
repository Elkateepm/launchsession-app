import React, { useEffect, useMemo, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import OrgPageHero, { orgBrand, heroButtons } from '../shared/OrgPageHero'
import SessionSheet, { flowButton } from '../sessions/SessionSheet'
import { hubHomeKeyframes } from '../hub/HubHomeSections'
import CaseManagement from '../casemgmt/CaseManagement'
import InjuryLog from '../incidents/InjuryLog'
import CauseForConcernForm from './CauseForConcernForm'
import SafeguardingDashboard, { WellbeingQuickLog } from './SafeguardingDashboard'
import SafeguardingOverview, { EMERGENCY_NUMBERS } from './SafeguardingOverview'
import ConcernSheet, { SG_RED } from './ConcernSheet'
import ChildFileSheet from './ChildFileSheet'
import useSafeguardingData from './useSafeguardingData'
import { childSignals, flowCounts, hubAttention, hubSummary, injuryToFinish, isOpenCase } from './sgModel'
import Icon from '../../lib/icons'

// Safeguarding and Case Management used to be two sidebar tabs governed by two
// module keys. They are one area because they are one workflow: a concern is
// raised, and if it escalates it becomes a case. The `case_management` module
// key was merged into `safeguarding` at the same time, so there is one gate.
//
// The hub loads everything once (useSafeguardingData) and owns the sheets --
// a concern, a child's file, a check-in, a new report -- so any of them opens
// the same way from Overview, from a list, from a case, or from a link
// elsewhere in the app, without leaving the tab you were on.
//
// It stays red whatever the organisation's colours, on purpose: this is the
// one area where nobody should mistake where they are.

const TABS = [
  { key: 'overview',  label: 'Overview',      icon: '🏠' },
  { key: 'concerns',  label: 'Concerns',      icon: '🛡' },
  { key: 'cases',     label: 'Cases',         icon: '📁' },
  { key: 'children',  label: 'Children',      icon: '🧒' },
  // The accident book reads here rather than getting a sidebar row of its own:
  // an injury and a concern are raised by the same person in the same moment.
  { key: 'injuries',  label: 'Accident book', icon: '🩹' },
  { key: 'documents', label: 'Documents',     icon: '📎' },
  { key: 'audit',     label: 'Audit log',     icon: '🕐' },
]
const LIST_VIEWS = ['concerns', 'children', 'documents', 'audit']

const SG_COLOURS = { primary_color: '#9F1239', secondary_color: '#FB7185', accent_color: '#FDA4AF' }

const GUIDANCE = [
  'If a child is in immediate danger, call 999 first.',
  'Listen. Stay calm, and let them say it in their own words.',
  'Do not promise to keep it secret. Say you will need to tell someone who can help.',
  'Do not investigate or ask leading questions. That is not your job and it can harm a case.',
  'Write down what was said and what you saw, as soon as you can, in their words.',
  'Tell the safeguarding lead today, then report the concern here.',
]

export default function SafeguardingHub({
  org, session, isAdmin, onNavigate, access = {},
  initialOpenConcernId, initialOpenCaseId, initialOpenChildId, initialSubTab,
}) {
  const mobile = useIsMobile()
  const terms = useTerms()
  const data = useSafeguardingData(org)
  const userId = session?.user?.id

  const [tab, setTab] = useState(initialSubTab || (initialOpenCaseId ? 'cases' : 'overview'))
  const [concernFilter, setConcernFilter] = useState('all')
  const [pendingCaseId, setPendingCaseId] = useState(initialOpenCaseId || null)
  const [openConcernId, setOpenConcernId] = useState(initialOpenConcernId || null)
  const [openChildId, setOpenChildId] = useState(initialOpenChildId || null)
  const [report, setReport] = useState(null)
  const [checkInChild, setCheckInChild] = useState(null)
  const [showEmergency, setShowEmergency] = useState(false)

  // A deep link that arrives while the hub is already open has to act too,
  // otherwise it opens behind whatever is showing.
  useEffect(() => { if (initialOpenCaseId) { setPendingCaseId(initialOpenCaseId); setTab('cases') } }, [initialOpenCaseId])
  useEffect(() => { if (initialOpenConcernId) setOpenConcernId(initialOpenConcernId) }, [initialOpenConcernId])
  useEffect(() => { if (initialOpenChildId) setOpenChildId(initialOpenChildId) }, [initialOpenChildId])
  useEffect(() => { if (initialSubTab) setTab(initialSubTab) }, [initialSubTab])

  const { today } = data
  const attention = useMemo(() => hubAttention({ ...data, today }), [data, today])
  const flow = useMemo(() => flowCounts(data.concerns, data.cases, today), [data.concerns, data.cases, today])
  const signals = useMemo(() => childSignals({ ...data, today }), [data, today])
  const counts = {
    concerns: attention.filter(a => a.kind === 'concern').length,
    cases: data.cases.filter(isOpenCase).length,
    injuries: data.injuries.filter(injuryToFinish).length,
  }

  const openCase = (id) => { setOpenChildId(null); setOpenConcernId(null); setPendingCaseId(id); setTab('cases') }
  const openInjuries = () => { setOpenChildId(null); setTab('injuries') }
  const startReport = (prefill = {}) => setReport({ key: Date.now(), ...prefill })
  const go = (t, payload) => onNavigate && onNavigate(t, payload)

  // Case Management links back to the concern a case came from. That used to
  // leave the hub and come back in; it opens here now.
  const caseNavigate = (t, payload) => {
    if (t === 'safeguarding' && payload?.openConcernId) { setOpenConcernId(payload.openConcernId); return }
    go(t, payload)
  }

  const onAttention = (item) => {
    if (item.kind === 'concern') setOpenConcernId(item.id)
    else if (item.kind === 'case') openCase(item.id)
    else if (item.kind === 'injuries') openInjuries()
  }
  const onFlow = (step) => {
    if (step === 'cases') { setTab('cases'); return }
    setConcernFilter(step === 'raised' ? 'needs' : step === 'withLead' ? 'open' : 'closed')
    setTab('concerns')
  }
  const onOpenActivity = (e) => {
    if (e.kind === 'concern') setOpenConcernId(e.id)
    else if (e.kind === 'case') openCase(e.id)
    else if (e.kind === 'injury') openInjuries()
    else if (e.kind === 'check') setOpenChildId(e.childId)
  }

  const concern = openConcernId ? data.concerns.find(c => c.id === openConcernId) : null
  const child = openChildId ? data.children.find(ch => ch.id === openChildId) : null

  const brand = orgBrand({ ...org, ...SG_COLOURS })
  const onHero = heroButtons(brand, { ...flowButton, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', fontFamily: 'inherit' })
  const leadFirst = (org.dsl_name || '').trim().split(/\s+/)[0]
  const current = TABS.find(t => t.key === tab) || TABS[0]
  const pad = mobile ? 16 : 24

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
      <style>{hubHomeKeyframes}</style>
      {/* The single scroller for the hub. None of the views brings a scroller
          of its own, so without this they were clipped at the fold. */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'radial-gradient(ellipse at 0% 0%, rgba(225,29,72,.07), transparent 46%), var(--bg)' }}>
        <div aria-hidden="true" style={{ height: 4, background: brand.stripe }} />
        <div style={{ padding: `${mobile ? 16 : 22}px ${pad}px 0`, width: '100%', maxWidth: 1320, margin: '0 auto', boxSizing: 'border-box' }}>
          {tab === 'overview' ? (
            <OrgPageHero org={{ ...org, ...SG_COLOURS }} mobile={mobile} title="Safeguarding"
              subtitle={data.loading ? 'Checking what needs you…' : hubSummary(attention, flow)}
              label="Safeguarding lead" detail={org.dsl_name || 'Not set yet'}
              actions={<>
                <button type="button" onClick={() => startReport()} style={{ ...onHero.main, flex: mobile ? '1 1 100%' : undefined }}><Icon name="🛡️" />Report a concern</button>
                {org.dsl_phone && <a href={`tel:${org.dsl_phone.replace(/\s+/g, '')}`} style={{ ...onHero.quiet, flex: mobile ? 1 : undefined }}><Icon name="📞" />{leadFirst ? `Call ${leadFirst}` : 'Call the lead'}</a>}
                <button type="button" onClick={() => setShowEmergency(true)} style={{ ...onHero.quiet, flex: mobile ? 1 : undefined }}><Icon name="🚨" />{mobile ? 'Emergency' : 'If a child is in danger'}</button>
              </>} />
          ) : (
            <section aria-label={`Safeguarding ${current.label}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderRadius: mobile ? 18 : 22, background: brand.hero, color: '#fff', padding: mobile ? '14px 14px' : '16px 22px', marginBottom: mobile ? 14 : 18, boxShadow: '0 18px 40px -30px rgba(159,18,57,.9)' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: '#ffffffd9' }}>Safeguarding</div>
                <h1 style={{ margin: '2px 0 0', fontFamily: 'var(--font-display, inherit)', fontSize: mobile ? 24 : 28, lineHeight: 1.1, fontWeight: 800, color: '#fff' }}>{current.label}</h1>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: mobile ? '100%' : undefined }}>
                <button type="button" onClick={() => startReport()} style={{ ...onHero.main, flex: mobile ? 1 : undefined }}><Icon name="🛡️" />Report a concern</button>
                <button type="button" onClick={() => setShowEmergency(true)} aria-label="If a child is in danger" style={{ ...onHero.quiet, padding: mobile ? '0 14px' : undefined }}><Icon name="🚨" />{mobile ? '' : 'Emergency'}</button>
              </div>
            </section>
          )}
        </div>

        <nav aria-label="Safeguarding" style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg)', borderBottom: '1px solid var(--border)', boxShadow: '0 8px 16px -16px rgba(15,23,42,.5)' }}>
          <div role="tablist" style={{ display: 'flex', gap: 4, padding: `8px ${pad}px`, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', maxWidth: 1320, margin: '0 auto', boxSizing: 'border-box' }}>
            {TABS.map(t => {
              const active = tab === t.key
              const n = counts[t.key]
              return (
                <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                    border: `1px solid ${active ? 'var(--danger-border)' : 'transparent'}`, background: active ? 'var(--danger-bg)' : 'transparent', color: active ? 'var(--danger-text)' : 'var(--text2)', transition: 'background .15s, color .15s' }}>
                  <span aria-hidden="true"><Icon name={t.icon} /></span>
                  {t.label}
                  {n > 0 && <span aria-label={`${n} open`} style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, fontSize: 11.5, fontWeight: 900, display: 'inline-grid', placeItems: 'center', background: active ? SG_RED : 'var(--surface2)', color: active ? '#fff' : 'var(--text)', boxSizing: 'border-box' }}>{n}</span>}
                </button>
              )
            })}
          </div>
        </nav>

        <div style={{ padding: `${mobile ? 14 : 20}px ${pad}px ${mobile ? 96 : 40}px`, width: '100%', maxWidth: 1320, margin: '0 auto', boxSizing: 'border-box' }}>
          {tab === 'overview' && (
            <SafeguardingOverview org={org} data={data} attention={attention} flow={flow} signals={signals} today={today}
              isAdmin={isAdmin} access={access} terms={terms} mobile={mobile} loading={data.loading}
              onAttention={onAttention} onFlow={onFlow} onOpenChild={setOpenChildId} onOpenActivity={onOpenActivity}
              onReport={startReport} onEmergency={() => setShowEmergency(true)} onNavigate={go} onTab={setTab} />
          )}
          {LIST_VIEWS.includes(tab) && (
            <SafeguardingDashboard org={org} userId={userId} view={tab} mobile={mobile}
              concerns={data.concerns} children={data.children} signals={signals} loading={data.loading} today={today}
              filter={concernFilter} setFilter={setConcernFilter}
              onOpenConcern={setOpenConcernId} onOpenChild={setOpenChildId} onCheckIn={setCheckInChild} onReport={startReport} />
          )}
          {tab === 'injuries' && <InjuryLog org={org} session={session} isAdmin={isAdmin} />}
          {tab === 'cases' && (
            <CaseManagement org={org} session={session} embedded onNavigate={caseNavigate} initialOpenCaseId={pendingCaseId}
              onOpenChildFile={setOpenChildId} onChanged={data.reload} />
          )}
        </div>
      </div>

      {concern && (
        <ConcernSheet key={concern.id} c={concern} orgId={org.id} userId={userId} children={data.children} today={today}
          onClose={() => setOpenConcernId(null)} onSaved={data.reload} onOpenCase={openCase}
          onOpenChild={(id) => { setOpenConcernId(null); setOpenChildId(id) }}
          onOpenRegister={access.registers ? (sessionId) => go('registers', { sessionId }) : null} />
      )}

      {child && !concern && (
        <ChildFileSheet key={child.id} child={child} data={data} signal={signals[child.id]} orgId={org.id} today={today} access={access}
          onClose={() => setOpenChildId(null)}
          onReport={(ch) => startReport({ child: ch })}
          onCheckIn={setCheckInChild}
          onOpenConcern={setOpenConcernId}
          onOpenCase={openCase}
          onOpenInjuries={openInjuries}
          onOpenProfile={(id) => go('children', { openChildId: id })}
          onOpenMedical={() => go('medical_alerts')}
          onOpenRegister={(sessionId) => go('registers', { sessionId })} />
      )}

      {checkInChild && (
        <WellbeingQuickLog child={checkInChild} orgId={org.id} userId={userId} onClose={() => setCheckInChild(null)} onLogged={data.reload} />
      )}

      {showEmergency && (
        <SessionSheet title="If a child is in danger" subtitle="What to do, in order. Keep this calm and simple." onClose={() => setShowEmergency(false)} width={520}>
          <ol style={{ margin: '0 0 18px', paddingLeft: 22, display: 'grid', gap: 10, fontSize: 15, lineHeight: 1.5, color: 'var(--text)' }}>
            {GUIDANCE.map(g => <li key={g}>{g}</li>)}
          </ol>
          <div style={{ display: 'grid', gap: 8 }}>
            {org.dsl_phone && (
              <a href={`tel:${org.dsl_phone.replace(/\s+/g, '')}`} style={{ ...flowButton, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', border: 'none', background: SG_RED, color: '#fff' }}>
                <Icon name="📞" /> <span style={{ flex: 1 }}>Call {org.dsl_name || 'the safeguarding lead'}</span> <b>{org.dsl_phone}</b>
              </a>
            )}
            {EMERGENCY_NUMBERS.map(n => (
              <a key={n.number} href={`tel:${n.number.replace(/\s+/g, '')}`} style={{ ...flowButton, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)' }}>
                <Icon name="📞" /> <span style={{ flex: 1 }}>{n.label}</span> <b style={{ color: 'var(--danger-text)' }}>{n.number}</b>
              </a>
            ))}
            <button type="button" onClick={() => { setShowEmergency(false); startReport() }} style={{ ...flowButton, marginTop: 6 }}>Report the concern now</button>
          </div>
        </SessionSheet>
      )}

      {report && (
        <>
          <div onClick={() => setReport(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10800, backdropFilter: 'blur(4px)' }} />
          <div role="dialog" aria-modal="true" aria-label="Report a concern" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px,96vw)', maxHeight: '92dvh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, zIndex: 10801, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <CauseForConcernForm key={report.key} org={org} session={session} initialChild={report.child || null} initialSession={report.session || null}
              onClose={() => setReport(null)} onSubmitted={data.reload} />
          </div>
        </>
      )}
    </div>
  )
}
