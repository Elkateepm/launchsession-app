import React, { useState } from 'react'
import CauseForConcernForm from './CauseForConcernForm'
import SafeguardingDashboard from './SafeguardingDashboard'

export default function Safeguarding({ org, session }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SafeguardingDashboard org={org} session={session} onReportConcern={() => setShowForm(true)} />

      {/* Form modal */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px,96vw)', maxHeight: '92dvh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, zIndex: 100, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <CauseForConcernForm
              org={org}
              session={session}
              onClose={() => setShowForm(false)}
              onSubmitted={() => {}}
            />
          </div>
        </>
      )}
    </div>
  )
}
