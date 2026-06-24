import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CauseForConcernForm from './CauseForConcernForm'
import SafeguardingDashboard from './SafeguardingDashboard'

export default function Safeguarding({ org, session }) {
  const [role, setRole] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    supabase.from('user_profiles').select('role').eq('id', session?.user?.id).single()
      .then(({ data }) => setRole(data?.role || 'staff'))
  }, [session?.user?.id])

  const isAdmin = role === 'admin' || role === 'owner'

  if (role === null) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>Safeguarding</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{isAdmin ? 'DSL Dashboard' : 'Submit a concern'}</div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#DC2626,#B91C1C)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}
        >
          + Report Concern
        </button>
      </div>

      {/* Content */}
      {isAdmin ? (
        <SafeguardingDashboard org={org} session={session} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Safeguarding</div>
            <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 28 }}>
              If you have a concern about the welfare or safety of a child or young person, please report it immediately using the button below. All reports are confidential and reviewed by the Designated Safeguarding Lead.
            </div>
            <div style={{ background: 'rgba(220,38,38,0.06)', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(220,38,38,0.15)', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#DC2626', marginBottom: 8 }}>Remember:</div>
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                <li>Report every concern, no matter how small</li>
                <li>Do not investigate yourself — pass it to the DSL</li>
                <li>Do not promise confidentiality to a child</li>
                <li>If immediate danger, call 999 first</li>
              </ul>
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#DC2626,#B91C1C)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 24px rgba(220,38,38,0.3)' }}
            >
              🚨 Submit a Cause for Concern
            </button>
          </div>
        </div>
      )}

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
