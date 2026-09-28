import React, { useState, useEffect } from 'react'
import Safeguarding from './Safeguarding'
import CaseManagement from '../casemgmt/CaseManagement'
import InjuryLog from '../incidents/InjuryLog'
import Icon from '../../lib/icons'

// Safeguarding and Case Management used to be two sidebar tabs governed by two
// module keys. They are one tab now, because they were always one workflow: a
// cause for concern is raised, and if it escalates it becomes a case. Splitting
// that across two destinations meant the escalate button threw you out of the
// area you were working in, and the case you had just created opened somewhere
// you had to navigate back from.
//
// The `case_management` module key was merged into `safeguarding` in the
// database at the same time, so there is a single gate rather than a sub-tab
// that can be individually locked.
//
// That merge left the area with two stacked tab strips: three tabs here, and
// six more inside the Concerns one. Nine destinations on two rows, with
// "Concerns" containing "All concerns", and "Cases" sitting one level above a
// different "Cases". They are all peer views of the same area, so they are one
// row now and the words are distinct.

const TABS = [
  { key: 'overview',  label: 'Overview',      icon: '🏠' },
  { key: 'concerns',  label: 'Concerns',      icon: '🛡' },
  { key: 'cases',     label: 'Cases',         icon: '📁' },
  // The accident book reads here rather than getting a sidebar row of its own:
  // an injury and a concern are raised by the same person in the same moment,
  // and an accident book nobody can find is one nobody produces when asked.
  { key: 'injuries',  label: 'Accident book', icon: '🩹' },
  { key: 'children',  label: 'Children',      icon: '🧒' },
  { key: 'documents', label: 'Documents',     icon: '📎' },
  { key: 'audit',     label: 'Audit log',     icon: '🕐' },
]

// Views that SafeguardingDashboard renders. Kept in one list so the dashboard
// stays mounted while you move between them -- it holds the concern list every
// one of them reads, and remounting it refetched that list on every tab press.
const DASHBOARD_VIEWS = ['overview', 'concerns', 'children', 'documents', 'audit']

export default function SafeguardingHub({
  org,
  session,
  isAdmin,
  onNavigate,
  initialOpenConcernId,
  initialOpenCaseId,
  initialSubTab,
}) {
  const [tab, setTab] = useState(initialSubTab || (initialOpenCaseId ? 'cases' : 'overview'))

  // A deep link that arrives while the hub is already mounted -- escalating a
  // concern, or a push notification about a case -- has to move the tab as
  // well, otherwise the case opens behind whichever view is showing.
  useEffect(() => { if (initialOpenCaseId) setTab('cases') }, [initialOpenCaseId])
  useEffect(() => { if (initialOpenConcernId) setTab('concerns') }, [initialOpenConcernId])
  useEffect(() => { if (initialSubTab) setTab(initialSubTab) }, [initialSubTab])

  // SafeguardingDashboard escalates by calling onNavigate('case_management',
  // { openCaseId }). That used to be a tab change and is now a sub-tab change,
  // so it is intercepted here. Anything else is passed up untouched.
  const [pendingCaseId, setPendingCaseId] = useState(initialOpenCaseId || null)
  const handleInnerNavigate = (t, payload) => {
    if (t === 'case_management') {
      setPendingCaseId(payload?.openCaseId || null)
      setTab('cases')
      return
    }
    if (onNavigate) onNavigate(t, payload)
  }

  const onDashboard = DASHBOARD_VIEWS.includes(tab)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div
        style={{ display: 'flex', gap: 4, padding: '10px 16px 0', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        role="tablist"
        aria-label="Safeguarding Hub"
      >
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 14px', borderRadius: 11, cursor: 'pointer',
                fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
                whiteSpace: 'nowrap', flexShrink: 0,
                border: `1px solid ${active ? 'var(--danger-border)' : 'var(--border)'}`,
                background: active ? 'var(--danger-bg)' : 'transparent',
                color: active ? 'var(--danger-text)' : 'var(--text2)',
                transition: 'all 0.15s',
              }}
            >
              <span aria-hidden="true"><Icon name={t.icon} /></span>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* The single scroller for the hub. This was overflow: hidden, and none of
          the tabs below brings a scroller of its own -- every overflow rule
          inside them is on a fixed-position modal -- so all of them were
          clipped at the fold with no way to reach the rest. Cases showed it
          worst because its list is the longest. */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column' }}>
        {onDashboard && (
          <Safeguarding
            org={org}
            session={session}
            onNavigate={handleInnerNavigate}
            initialOpenConcernId={initialOpenConcernId}
            view={tab}
            onView={setTab}
          />
        )}
        {tab === 'injuries' && (
          <div style={{ padding: '14px 16px 24px' }}>
            <InjuryLog org={org} session={session} isAdmin={isAdmin} />
          </div>
        )}
        {tab === 'cases' && (
          <CaseManagement
            org={org}
            session={session}
            onNavigate={onNavigate}
            initialOpenCaseId={pendingCaseId}
          />
        )}
      </div>
    </div>
  )
}
