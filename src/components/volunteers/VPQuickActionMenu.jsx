import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import Icon from '../../lib/icons'
import { todayInLondon } from '../../lib/today'

// The volunteer's quick actions, from the + in the portal's header.
//
// What changed, and why:
//
//   Raise a concern used to write into Case management as a case called
//   "Unspecified — raised via volunteer app", while telling the volunteer it
//   had gone to the safeguarding lead. It now files a cause for concern, the
//   record the safeguarding lead actually works from, as the register's own
//   concern button does.
//
//   Incident report wrote a fake case too. It is now a note on today's
//   register (accident, injury or anything else), which the session lead sees
//   on the register as it happens.
//
//   Log hours is gone. Hours come from the register now (lib/volunteerHours.js):
//   the time between the session lead signing someone in and signing them out.
//   A number anyone could type for themselves made every total meaningless.

const ACTIONS = [
  { key: 'concern', icon: '🛡️', label: 'Raise a concern', detail: 'Goes to the safeguarding lead', tone: 'danger' },
  { key: 'register', icon: '📖', label: 'Open today’s register', detail: 'Sign young people in and out', needsToday: true },
  { key: 'note', icon: '📝', label: 'Note on the register', detail: 'An accident, injury or anything the lead should know', needsToday: true },
  { key: 'message', icon: '💬', label: 'Message the team', detail: 'Questions, swaps, running late' },
  { key: 'emergency', icon: '📞', label: 'Emergency numbers', detail: '999 and your organisation' },
  { key: 'document', icon: '📎', label: 'Upload a certificate', detail: 'DBS, first aid, safeguarding' },
]

export default function VPQuickActionMenu({ open, onClose, org, user, profile, todaySession, onGoRegister, onGoMessage, forceModal }) {
  const [modal, setModal] = useState(null)

  useEffect(() => {
    if (open && forceModal) setModal(forceModal)
    if (!open) setModal(null)
  }, [open, forceModal])

  useEffect(() => {
    if (!open) return undefined
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const showMenu = open && !modal
  const actions = ACTIONS.filter(a => !a.needsToday || todaySession)

  const handlePick = (key) => {
    if (key === 'register') { onClose(); onGoRegister && onGoRegister(); return }
    if (key === 'message') { onClose(); onGoMessage && onGoMessage(); return }
    setModal(key)
  }
  const closeAll = () => { setModal(null); onClose() }

  return (
    <>
      <AnimatePresence>
        {showMenu && (
          <Sheet title="Quick actions" onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {actions.map(a => (
                <button key={a.key} onClick={() => handlePick(a.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 12px', borderRadius: 14, border: `1px solid ${a.tone === 'danger' ? 'var(--danger-border)' : 'var(--border)'}`, background: a.tone === 'danger' ? 'var(--danger-bg)' : 'var(--surface)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: a.tone === 'danger' ? 'var(--surface)' : 'var(--org-a10, #1B9AAA1a)', display: 'grid', placeItems: 'center', fontSize: 19, flexShrink: 0 }}><Icon name={a.icon} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: a.tone === 'danger' ? 'var(--danger-text)' : 'var(--text)' }}>{a.label}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 1 }}>{a.detail}</span>
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
                </button>
              ))}
            </div>
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === 'concern' && <ConcernModal org={org} user={user} profile={profile} todaySession={todaySession} onClose={closeAll} />}
        {modal === 'note' && <RegisterNoteModal org={org} user={user} todaySession={todaySession} onClose={closeAll} />}
        {modal === 'emergency' && <EmergencyModal org={org} onClose={closeAll} />}
        {modal === 'document' && <UploadDocModal org={org} user={user} onClose={closeAll} />}
      </AnimatePresence>
    </>
  )
}

function Sheet({ title, onClose, children, footer }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 700, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div role="dialog" aria-modal="true" aria-label={title}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: 'var(--surface2)', borderRadius: '24px 24px 0 0', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-soft)', background: 'var(--surface)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)', flex: 1 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div className="ls-scroll" style={{ padding: 16, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)', borderTop: '1px solid var(--border-soft)', background: 'var(--surface)' }}>{footer}</div>}
        {!footer && <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />}
      </motion.div>
    </motion.div>
  )
}

const label = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 14 }
const inp = { width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'inherit' }
const mainBtn = (danger) => ({ width: '100%', minHeight: 50, borderRadius: 13, border: 'none', background: danger ? 'var(--danger-text)' : 'var(--org-primary, #1B9AAA)', color: danger ? '#fff' : 'var(--org-on-primary, #fff)', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' })

function Done({ title, detail }) {
  return (
    <div role="status" style={{ textAlign: 'center', padding: '24px 8px' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}><Icon name="✅" /></div>
      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>{title}</div>
      {detail && <div style={{ fontSize: 13.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>{detail}</div>}
    </div>
  )
}

function ConcernModal({ org, user, profile, todaySession, onClose }) {
  const [about, setAbout] = useState('')
  const [body, setBody] = useState('')
  const [where, setWhere] = useState(todaySession?.location || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    if (!body.trim()) return
    setSaving(true); setError('')
    // No .select() after the insert: a volunteer can file a concern but is
    // not able to read concerns back.
    const { error: err } = await supabase.from('cause_for_concern').insert({
      org_id: org.id, submitted_by: user.id,
      submitter_name: profile?.full_name || user.email || 'Volunteer', submitter_role: 'Volunteer',
      child_name: about.trim() || 'Not named', concern_type: 'other', description: body.trim(),
      date_of_incident: todayInLondon(), location: where.trim() || 'Not given',
      session_id: todaySession?.id || null, status: 'open', priority: 'medium',
    })
    setSaving(false)
    if (err) { setError('That did not send. Check your connection and try again. If a child is in danger, call 999 now.'); return }
    setDone(true)
  }
  return (
    <Sheet title="Raise a concern" onClose={onClose}
      footer={done ? <button onClick={onClose} style={mainBtn()}>Done</button>
        : <button onClick={submit} disabled={saving || !body.trim()} style={{ ...mainBtn(true), opacity: body.trim() ? 1 : 0.55 }}>{saving ? 'Sending…' : 'Send to the safeguarding lead'}</button>}>
      {done ? (
        <Done title="Sent to your safeguarding lead" detail="Thank you. They will follow it up. Tell your session lead too if it is about today." />
      ) : (
        <>
          <div style={{ background: 'var(--danger-bg)', border: '1.5px solid var(--danger-border)', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 14, fontWeight: 700, color: 'var(--danger-text)', lineHeight: 1.5 }}>
            If a child is in immediate danger, call 999 now.
          </div>
          {error && <div role="alert" style={{ marginBottom: 12, fontSize: 13.5, fontWeight: 700, color: 'var(--danger-text)' }}>{error}</div>}
          <label style={label}>Who is it about?
            <input value={about} onChange={e => setAbout(e.target.value)} placeholder="A name, or describe who" style={inp} />
          </label>
          <label style={label}>What did you see or hear?
            <textarea autoFocus value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Use their words where you can. Include the time and anything already done." style={{ ...inp, resize: 'vertical' }} />
          </label>
          <label style={label}>Where?
            <input value={where} onChange={e => setWhere(e.target.value)} style={inp} />
          </label>
        </>
      )}
    </Sheet>
  )
}

const NOTE_TYPES = [
  { key: 'incident', label: 'Accident or incident' },
  { key: 'injury', label: 'Injury or first aid' },
  { key: 'general', label: 'Something else' },
]

function RegisterNoteModal({ org, user, todaySession, onClose }) {
  const [type, setType] = useState('incident')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    if (!body.trim() || !todaySession) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from('session_notes').insert({
      org_id: org.id, session_id: todaySession.id, note_type: type, content: body.trim(), created_by: user.id,
    })
    setSaving(false)
    if (err) { setError('That did not save. Check your connection and try again.'); return }
    setDone(true)
  }
  return (
    <Sheet title={`Note on ${todaySession?.title || 'today’s register'}`} onClose={onClose}
      footer={done ? <button onClick={onClose} style={mainBtn()}>Done</button>
        : <button onClick={submit} disabled={saving || !body.trim()} style={{ ...mainBtn(), opacity: body.trim() ? 1 : 0.55 }}>{saving ? 'Saving…' : 'Add to the register'}</button>}>
      {done ? (
        <Done title="Added to the register" detail="Your session lead can see it under Notes." />
      ) : (
        <>
          {error && <div role="alert" style={{ marginBottom: 12, fontSize: 13.5, fontWeight: 700, color: 'var(--danger-text)' }}>{error}</div>}
          <div role="radiogroup" aria-label="Type of note" style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {NOTE_TYPES.map(t => (
              <button key={t.key} role="radio" aria-checked={type === t.key} onClick={() => setType(t.key)}
                style={{ minHeight: 48, borderRadius: 12, textAlign: 'left', padding: '0 14px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${type === t.key ? 'var(--org-primary, #1B9AAA)' : 'var(--border)'}`, background: type === t.key ? 'var(--org-a10, #1B9AAA1a)' : 'var(--surface)', color: type === t.key ? 'var(--org-ink)' : 'var(--text2)' }}>
                {t.label}
              </button>
            ))}
          </div>
          <label style={label}>What happened?
            <textarea autoFocus value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Who, what, when, and anything already done." style={{ ...inp, resize: 'vertical' }} />
          </label>
        </>
      )}
    </Sheet>
  )
}

function EmergencyModal({ org, onClose }) {
  const link = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '12px 14px', borderRadius: 14, textDecoration: 'none', boxSizing: 'border-box' }
  return (
    <Sheet title="Emergency numbers" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="tel:999" style={{ ...link, background: 'var(--danger-bg)', border: '1.5px solid var(--danger-border)' }}>
          <span aria-hidden="true" style={{ fontSize: 22 }}><Icon name="🚨" /></span>
          <div><div style={{ fontSize: 16, fontWeight: 900, color: 'var(--danger-text)' }}>999 · Emergency services</div><div style={{ fontSize: 13, color: 'var(--danger-text)' }}>Life-threatening emergency or a child in danger</div></div>
        </a>
        {org?.emergency_phone && (
          <a href={`tel:${org.emergency_phone}`} style={{ ...link, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}><Icon name="🛡️" /></span>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Safeguarding lead</div><div style={{ fontSize: 13, color: 'var(--text3)' }}>{org.emergency_phone}</div></div>
          </a>
        )}
        {org?.phone ? (
          <a href={`tel:${org.phone}`} style={{ ...link, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}><Icon name="🏢" /></span>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{org?.name || 'Your organisation'}</div><div style={{ fontSize: 13, color: 'var(--text3)' }}>{org.phone}</div></div>
          </a>
        ) : (
          <div style={{ ...link, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}><Icon name="🏢" /></span>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{org?.name || 'Your organisation'}</div><div style={{ fontSize: 13, color: 'var(--text3)' }}>No number on file. Message the team instead.</div></div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function UploadDocModal({ org, user, onClose }) {
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const upload = async (file) => {
    if (!file) return
    setUploading(true); setError('')
    const path = `certificates/${org.id}/${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('safeguarding-docs').upload(path, file)
    // Private bucket: store the path, and sign it when it is opened.
    const { error: rowErr } = upErr ? { error: upErr } : await supabase.from('volunteer_training').insert({ org_id: org.id, volunteer_id: user.id, training_type: file.name, status: 'completed', completed_at: todayInLondon(), certificate_url: path })
    setUploading(false)
    if (upErr || rowErr) { setError('That did not upload. Check your connection and try again.'); return }
    setDone(true)
  }
  return (
    <Sheet title="Upload a certificate" onClose={onClose} footer={done ? <button onClick={onClose} style={mainBtn()}>Done</button> : null}>
      {done ? (
        <Done title="Uploaded" detail="The team will check it and update your record." />
      ) : (
        <>
          {error && <div role="alert" style={{ marginBottom: 12, fontSize: 13.5, fontWeight: 700, color: 'var(--danger-text)' }}>{error}</div>}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ width: '100%', border: '2px dashed var(--border)', borderRadius: 16, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', fontFamily: 'inherit' }}>
            <div aria-hidden="true" style={{ fontSize: 28, marginBottom: 8 }}><Icon name="📎" /></div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{uploading ? 'Uploading…' : 'Choose a file or take a photo'}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>DBS, first aid or safeguarding certificates</div>
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => upload(e.target.files?.[0])} />
        </>
      )}
    </Sheet>
  )
}
