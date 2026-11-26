import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'
import { LiveSessionPanel, ModalEdgeFade } from '../hub/Hub'

// The register. Every "Open register" in the dashboard opens this: the same
// dark register that Home's session cards open, over whatever page you are
// on, so closing it puts you back where you were. It used to depend on where
// you pressed: Home had this one, while Sessions, Calendar, Projects, Today,
// Safeguarding and Registers opened a different full-page register.
//
// Home already has the session, its young people and attendance loaded; this
// loads them for one session so any page can open it.
export default function RegisterSheet({ sessionId, org, authUserId, userRole, onClose, onNavigate }) {
  const isMobile = useIsMobile()
  const [state, setState] = useState({ loading: true })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let live = true
    setState({ loading: true })
    Promise.all([
      supabase.from('sessions').select('*').eq('org_id', org.id).eq('id', sessionId).single(),
      supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('first_name', { ascending: true }),
      supabase.from('attendance').select('*').eq('org_id', org.id).eq('session_id', sessionId),
      supabase.from('session_reflections').select('*').eq('org_id', org.id).eq('session_id', sessionId),
    ]).then(([s, c, a, r]) => {
      if (!live) return
      if (s.error || !s.data) { setState({ error: true }); return }
      setState({ session: s.data, children: c.data || [], attendance: a.data || [], reflections: r.data || [] })
    }).catch(() => { if (live) setState({ error: true }) })
    return () => { live = false }
  }, [org.id, sessionId, retry])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const stats = useCallback(item => {
    const records = (state.attendance || []).filter(a => a.session_id === item.id)
    const count = status => records.filter(a => a.status === status).length
    const signedIn = count('signed_in')
    return { signedIn, absent: count('absent'), signedOut: count('signed_out'), expected: count('expected'), percent: records.length ? Math.round((signedIn / records.length) * 100) : 0 }
  }, [state.attendance])

  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || '#0EA5E9'

  let body
  if (state.loading) {
    body = <div role="status" style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Opening register…</div>
  } else if (state.error) {
    body = (
      <div role="alert" style={{ padding: '32px 16px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>This register could not be opened.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>Check your connection and try again.</div>
        <button type="button" onClick={() => setRetry(n => n + 1)} style={{ marginTop: 16, minHeight: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: '#fff', color: '#0B1023', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Try again</button>
      </div>
    )
  } else {
    body = (
      <LiveSessionPanel
        sessions={[state.session]}
        childList={state.children}
        attendance={state.attendance}
        primary={primary}
        secondary={secondary}
        orgId={org.id}
        org={org}
        authUserId={authUserId}
        userRole={userRole}
        reflections={state.reflections}
        onNavigate={(tab, payload) => { onClose(); onNavigate?.(tab, payload) }}
        getLiveSessionStats={stats}
        onViewDetails={onNavigate ? s => { onClose(); onNavigate('planner', { editSessionId: s.id }) } : undefined}
        onClosed={onClose}
      />
    )
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Register" style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column',
      background: isMobile ? '#0B1023' : 'rgba(8,11,23,0.7)',
      alignItems: isMobile ? 'stretch' : 'center', justifyContent: isMobile ? 'flex-start' : 'center',
      padding: isMobile ? 0 : 24, boxSizing: 'border-box',
    }} onClick={isMobile ? undefined : e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: isMobile ? 'none' : 720, maxHeight: isMobile ? 'none' : '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: isMobile ? 0 : 26, flex: isMobile ? 1 : undefined,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '14px 14px 0', background: '#0B1023' }}>
          <button type="button" onClick={onClose} aria-label="Close register" style={{
            width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 18, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="✕" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 14px 24px' : '10px 20px 24px', background: '#0B1023' }}>
          {body}
        </div>
        <ModalEdgeFade />
      </div>
    </div>,
    document.body
  )
}
