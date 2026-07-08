import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { activityTheme } from './vp_shared'

export default function VPSessionDetail({ session, org, onClose, onNavigateTab, primary }) {
  const theme = activityTheme(session.session_type)
  const todayStr = new Date().toLocaleDateString('en-CA')
  const isToday = session.session_date === todayStr
  const isLiveNow = isToday && (() => {
    const now = new Date()
    const start = session.start_time ? new Date(`${session.session_date}T${session.start_time}`) : null
    const end = session.end_time ? new Date(`${session.session_date}T${session.end_time}`) : null
    return (!start || start <= now) && (!end || end >= now)
  })()

  const [showRegister, setShowRegister] = useState(false)
  const [staff, setStaff] = useState([])

  useEffect(() => {
    supabase.from('session_staff').select('*, user_profiles(full_name, photo_url, role)').eq('session_id', session.id).then(({ data }) => setStaff(data || []))
  }, [session.id])

  const row = (icon, label, value) => value ? (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
      <span style={{ fontSize: 16, width: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  ) : null

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 600, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ background: theme.gradient, padding: '18px 18px 22px', color: '#fff', position: 'relative', flexShrink: 0 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, left: 16, width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>←</button>
        {isLiveNow && (
          <motion.div animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.25)', borderRadius: 99, padding: '4px 11px', fontSize: 10, fontWeight: 900 }}>● LIVE</motion.div>
        )}
        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>{theme.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{session.title}</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>{new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} · {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 100px' }}>
        {row('📍', 'Location', session.location)}
        {row('🎫', 'Type', theme.label)}
        {row('👥', 'Volunteer Staff', staff.length ? staff.map(s => s.user_profiles?.full_name).filter(Boolean).join(', ') : null)}
        {row('🔢', 'Capacity', session.max_capacity ? `${session.max_capacity} young people` : null)}
        {row('📝', 'Description', session.description)}

        {isLiveNow && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => setShowRegister(true)} style={{ padding: '13px', borderRadius: 14, border: 'none', background: theme.gradient, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📖 Open Register</button>
            <button onClick={() => onNavigateTab('messages')} style={{ padding: '13px', borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.1)', background: '#fff', color: '#334155', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>💬 Message Staff</button>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: session.location ? '1fr 1fr' : '1fr', gap: 10 }}>
          {session.location && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(session.location)}`} target="_blank" rel="noreferrer"
              style={{ padding: '13px', borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.1)', textAlign: 'center', color: '#334155', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>🧭 Navigate</a>
          )}
          <a href="tel:999" style={{ padding: '13px', borderRadius: 14, border: '1.5px solid #FCA5A5', textAlign: 'center', color: '#DC2626', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>📞 Emergency</a>
        </div>
      </div>

      <AnimatePresence>
        {showRegister && <VPRegister session={session} org={org} primary={primary} theme={theme} onClose={() => setShowRegister(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}

function VPRegister({ session, org, primary, theme, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('attendance').select('*, children(id, first_name, last_name, photo_url, has_epipen, has_asthma, takes_medication)').eq('session_id', session.id).order('created_at')
    setRows(data || [])
    setLoading(false)
  }, [session.id])

  useEffect(() => { load() }, [load])

  const toggle = async (row) => {
    setBusy(row.id)
    const next = row.status === 'signed_in' ? 'signed_out' : 'signed_in'
    const patch = next === 'signed_in' ? { status: 'signed_in', signed_in_at: new Date().toISOString() } : { status: 'signed_out', signed_out_at: new Date().toISOString() }
    await supabase.from('attendance').update(patch).eq('id', row.id)
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, ...patch } : r))
    setBusy(null)
  }

  const signedInCount = rows.filter(r => r.status === 'signed_in').length

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 650, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: theme.gradient, padding: '16px 18px', color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer' }}>✕</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>Register — {session.title}</div>
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>{signedInCount} / {rows.length} signed in</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading register…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No one on the register for this session yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(r => {
              const c = r.children
              if (!c) return null
              const alert = c.has_epipen || c.has_asthma || c.takes_medication
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.08)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F1F5F9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#64748B', flexShrink: 0 }}>
                    {c.photo_url ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{c.first_name} {c.last_name}</div>
                    {alert && <div style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 700 }}>⚠ Medical alert</div>}
                  </div>
                  <button onClick={() => toggle(r)} disabled={busy === r.id}
                    style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: r.status === 'signed_in' ? '#FEF2F2' : theme.gradient, color: r.status === 'signed_in' ? '#DC2626' : '#fff', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', flexShrink: 0 }}>
                    {busy === r.id ? '…' : r.status === 'signed_in' ? 'Sign Out' : 'Sign In'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
