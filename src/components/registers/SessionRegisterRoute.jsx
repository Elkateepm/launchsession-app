import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LiveRegister from './LiveRegister'

export default function SessionRegisterRoute({ sessionId, org, authSession, userRole, onClose, onNavigate, backLabel = 'Back to registers' }) {
  const [result, setResult] = useState({ loading: true })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setResult({ loading: true })
    supabase.from('sessions').select('*').eq('org_id', org.id).eq('id', sessionId).single()
      .then(({ data, error }) => { if (active) setResult({ data, error: error || (!data && new Error('Unavailable')) }) })
      .catch(error => { if (active) setResult({ error }) })
    return () => { active = false }
  }, [org.id, sessionId, retry])
  if (result.loading) return <p role="status">Opening register…</p>
  if (result.error) return <div role="alert">
    <p>This register could not be opened. Check your connection and access.</p>
    <button style={{ minHeight: 44 }} onClick={() => setRetry(n => n + 1)}>Retry</button>
    <button style={{ minHeight: 44 }} onClick={onClose}>{backLabel}</button>
  </div>
  return <LiveRegister key={sessionId} session={result.data} org={org} authUserId={authSession?.user?.id} userRole={userRole} onClose={onClose} backLabel={backLabel} onNavigate={onNavigate} />
}
