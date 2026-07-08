import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'

const ACTIONS = [
  { key: 'concern', icon: '🛡️', label: 'Raise Concern', color: '#EF4444' },
  { key: 'hours', icon: '⏱️', label: 'Log Hours', color: '#7C5CFC' },
  { key: 'incident', icon: '📋', label: 'Incident Report', color: '#F59E0B' },
  { key: 'emergency', icon: '📞', label: 'Emergency Contact', color: '#DC2626' },
  { key: 'register', icon: '📖', label: 'View Register', color: '#0EA5E9' },
  { key: 'message', icon: '💬', label: 'Message Staff', color: '#16A34A' },
  { key: 'document', icon: '📎', label: 'Upload Document', color: '#8B5CF6' },
]

export default function VPQuickActionMenu({ open, onClose, org, user, todaySession, onNavigate, onGoRegister, onGoMessage, forceModal }) {
  const [modal, setModal] = useState(null)

  React.useEffect(() => {
    if (open && forceModal) setModal(forceModal)
    if (!open) setModal(null)
  }, [open, forceModal])

  const showRadial = open && !forceModal

  const handlePick = (key) => {
    if (key === 'register') { onClose(); onGoRegister && onGoRegister(); return }
    if (key === 'message') { onClose(); onGoMessage && onGoMessage(); return }
    setModal(key)
  }

  return (
    <>
      <AnimatePresence>
        {showRadial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.55)', backdropFilter: 'blur(6px)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 110 }}>
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
              <div style={{ background: 'rgba(20,26,38,0.92)', backdropFilter: 'blur(20px)', borderRadius: 26, padding: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14, textAlign: 'center' }}>Quick Actions</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {ACTIONS.map((a, i) => (
                    <motion.button key={a.key} onClick={() => handlePick(a.key)}
                      initial={{ opacity: 0, scale: 0.7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: i * 0.035, type: 'spring', stiffness: 400, damping: 22 }}
                      whileTap={{ scale: 0.92 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 6px', borderRadius: 18, border: 'none', background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 16, background: `${a.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{a.icon}</div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === 'concern' && <ConcernModal org={org} user={user} onClose={() => { setModal(null); onClose() }} />}
        {modal === 'hours' && <LogHoursModal org={org} user={user} todaySession={todaySession} onClose={() => { setModal(null); onClose() }} />}
        {modal === 'incident' && <IncidentModal org={org} user={user} onClose={() => { setModal(null); onClose() }} />}
        {modal === 'emergency' && <EmergencyModal org={org} onClose={() => { setModal(null); onClose() }} />}
        {modal === 'document' && <UploadDocModal org={org} user={user} onClose={() => { setModal(null); onClose() }} />}
      </AnimatePresence>
    </>
  )
}

function ModalShell({ title, icon, color, onClose, children, footer }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 700, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '26px 26px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{icon}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(15,23,42,0.06)' }}>{footer}</div>}
      </motion.div>
    </motion.div>
  )
}

const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(15,23,42,0.1)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const btnPrimary = (color) => ({ width: '100%', padding: '13px', borderRadius: 13, border: 'none', background: color, color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer' })

function ConcernModal({ org, user, onClose }) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const submit = async () => {
    if (!body.trim()) return
    setSaving(true)
    await supabase.from('cases').insert({
      org_id: org.id, child_name: 'Unspecified — raised via volunteer app', status: 'open',
      risk_level: 'medium', priority: 'medium', category: 'Other', summary: body.trim(), created_by: user?.id,
    })
    setSaving(false); setDone(true)
    setTimeout(onClose, 1400)
  }
  return (
    <ModalShell title="Raise a Safeguarding Concern" icon="🛡️" color="#EF4444" onClose={onClose}
      footer={!done && <button onClick={submit} disabled={saving || !body.trim()} style={btnPrimary('#EF4444')}>{saving ? 'Submitting…' : 'Submit to DSL'}</button>}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Sent to your Designated Safeguarding Lead</div>
        </div>
      ) : (
        <>
          <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.5 }}>
            If a child is in immediate danger, call 999 first. This form goes straight to your DSL.
          </div>
          <textarea autoFocus value={body} onChange={e => setBody(e.target.value)} placeholder="What did you see or hear? Include names, times, and anything said…" rows={6} style={{ ...inp, resize: 'vertical' }} />
        </>
      )}
    </ModalShell>
  )
}

function LogHoursModal({ org, user, todaySession, onClose }) {
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const submit = async () => {
    const h = parseFloat(hours)
    if (!h || h <= 0) return
    setSaving(true)
    await supabase.from('volunteer_attendance').insert({
      org_id: org.id, volunteer_id: user.id, session_id: todaySession?.id || null,
      hours_logged: h, status: 'completed', notes: notes.trim() || null,
      signed_in_at: new Date().toISOString(), signed_out_at: new Date().toISOString(),
    })
    setSaving(false); setDone(true)
    setTimeout(onClose, 1200)
  }
  return (
    <ModalShell title="Log Volunteer Hours" icon="⏱️" color="#7C5CFC" onClose={onClose}
      footer={!done && <button onClick={submit} disabled={saving || !hours} style={btnPrimary('#7C5CFC')}>{saving ? 'Saving…' : 'Log Hours'}</button>}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Hours logged — thank you!</div>
        </div>
      ) : (
        <>
          {todaySession && <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12 }}>For: <strong>{todaySession.title}</strong></div>}
          <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>Hours</label>
          <input autoFocus type="number" step="0.5" min="0" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 2.5" style={{ ...inp, marginBottom: 14 }} />
          <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        </>
      )}
    </ModalShell>
  )
}

function IncidentModal({ org, user, onClose }) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const submit = async () => {
    if (!body.trim()) return
    setSaving(true)
    await supabase.from('cases').insert({
      org_id: org.id, child_name: 'Incident report — via volunteer app', status: 'open',
      risk_level: 'low', priority: 'low', category: 'Other', summary: `[INCIDENT] ${body.trim()}`, created_by: user?.id,
    })
    setSaving(false); setDone(true)
    setTimeout(onClose, 1200)
  }
  return (
    <ModalShell title="Submit Incident Report" icon="📋" color="#F59E0B" onClose={onClose}
      footer={!done && <button onClick={submit} disabled={saving || !body.trim()} style={btnPrimary('#F59E0B')}>{saving ? 'Submitting…' : 'Submit Report'}</button>}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Incident report submitted</div>
        </div>
      ) : (
        <textarea autoFocus value={body} onChange={e => setBody(e.target.value)} placeholder="Describe what happened — injuries, near-misses, equipment issues…" rows={6} style={{ ...inp, resize: 'vertical' }} />
      )}
    </ModalShell>
  )
}

function EmergencyModal({ org, onClose }) {
  return (
    <ModalShell title="Emergency Contacts" icon="📞" color="#DC2626" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="tel:999" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#FEF2F2', textDecoration: 'none' }}>
          <span style={{ fontSize: 22 }}>🚨</span>
          <div><div style={{ fontSize: 14, fontWeight: 800, color: '#7F1D1D' }}>999 — Emergency Services</div><div style={{ fontSize: 11.5, color: '#B91C1C' }}>Life-threatening emergency</div></div>
        </a>
        {org?.emergency_phone && (
          <a href={`tel:${org.emergency_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#F8FAFC', textDecoration: 'none' }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Designated Safeguarding Lead</div><div style={{ fontSize: 11.5, color: '#64748B' }}>{org.emergency_phone}</div></div>
          </a>
        )}
        <a href={org?.phone ? `tel:${org.phone}` : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: '#F8FAFC', textDecoration: 'none', opacity: org?.phone ? 1 : 0.5, pointerEvents: org?.phone ? 'auto' : 'none' }}>
          <span style={{ fontSize: 22 }}>🏢</span>
          <div><div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{org?.name || 'Your organisation'}</div><div style={{ fontSize: 11.5, color: '#64748B' }}>{org?.phone || 'No number on file'}</div></div>
        </a>
      </div>
    </ModalShell>
  )
}

function UploadDocModal({ org, user, onClose }) {
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef(null)
  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    const path = `certificates/${org.id}/${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from('safeguarding-docs').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('safeguarding-docs').getPublicUrl(path)
      await supabase.from('volunteer_training').insert({ org_id: org.id, volunteer_id: user.id, training_type: file.name, status: 'completed', completed_at: new Date().toISOString().slice(0, 10), certificate_url: urlData?.publicUrl })
      setDone(true)
    }
    setUploading(false)
    setTimeout(onClose, 1200)
  }
  return (
    <ModalShell title="Upload Document" icon="📎" color="#8B5CF6" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Uploaded</div>
        </div>
      ) : (
        <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed rgba(15,23,42,0.15)', borderRadius: 16, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: '#F8FAFC' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{uploading ? 'Uploading…' : 'Tap to choose a file'}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Certificates, ID, or other documents</div>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => upload(e.target.files?.[0])} />
        </div>
      )}
    </ModalShell>
  )
}
