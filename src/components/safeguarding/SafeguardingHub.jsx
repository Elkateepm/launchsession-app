import React, { useState, useEffect } from 'react'
import Safeguarding from './Safeguarding'
import CaseManagement from '../casemgmt/CaseManagement'

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

const SUB_TABS = [
  { key: 'concerns', label: 'Concerns', icon: '🛡' },
  { key: 'cases', label: 'Cases', icon: '📁' },
]

export default function SafeguardingHub({
  org,
  session,
  onNavigate,
  initialOpenConcernId,
  initialOpenCaseId,
  initialSubTab,
}) {
  const [subTab, setSubTab] = useState(initialSubTab || (initialOpenCaseId ? 'cases' : 'concerns'))

  // A deep link that arrives while the hub is already mounted -- escalating a
  // concern, or a push notification about a case -- has to move the sub-tab as
  // well, otherwise the case opens behind the Concerns view.
  useEffect(() => { if (initialOpenCaseId) setSubTab('cases') }, [initialOpenCaseId])
  useEffect(() => { if (initialOpenConcernId) setSubTab('concerns') }, [initialOpenConcernId])
  useEffect(() => { if (initialSubTab) setSubTab(initialSubTab) }, [initialSubTab])

  // SafeguardingDashboard escalates by calling onNavigate('case_management',
  // { openCaseId }). That used to be a tab change and is now a sub-tab change,
  // so it is intercepted here. Anything else is passed up untouched.
  const [pendingCaseId, setPendingCaseId] = useState(initialOpenCaseId || null)
  const handleInnerNavigate = (tab, payload) => {
    if (tab === 'case_management') {
      setPendingCaseId(payload?.openCaseId || null)
      setSubTab('cases')
      return
    }
    if (onNavigate) onNavigate(tab, payload)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0', flexShrink: 0 }} role="tablist" aria-label="Safeguarding Hub">
        {SUB_TABS.map(t => {
          const active = subTab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 11, cursor: 'pointer',
                fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
                border: `1px solid ${active ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
                background: active ? 'rgba(239,68,68,0.10)' : 'transparent',
                color: active ? '#EF4444' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {subTab === 'concerns' && (
          <Safeguarding
            org={org}
            session={session}
            onNavigate={handleInnerNavigate}
            initialOpenConcernId={initialOpenConcernId}
          />
        )}
        {subTab === 'cases' && (
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
