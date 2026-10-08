import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import SignedImg from '../shared/SignedImg'
import { uploadStaffPhoto } from '../../lib/staffPhoto'
import Icon from '../../lib/icons'
import { planLabel } from '../../lib/moduleAccess'
import { orgBrand, OrgLogo } from '../shared/OrgPageHero'
import { withAlpha } from '../../lib/withAlpha'

// Your own profile: one scrolling sheet in the organisation's colours, full
// screen on a phone and a centred card on a desktop. It replaced a desktop
// sidebar that a phone squeezed into the top 40% of the screen, in
// LaunchSession blue whatever the organisation's brand.
//
// Everything here says only what is true. The old version had an Enable
// button for two-factor sign-in that did nothing, "Your account is secure",
// and "Last changed recently" for a date it never knew.

const ROLE_LABELS = {
  owner: 'Owner', admin: 'Administrator', manager: 'Manager', staff: 'Staff member',
  volunteer: 'Volunteer', parent: 'Parent or carer',
}

const FIELDS = {
  full_name: { label: 'Full name', icon: '👤', autoComplete: 'name', placeholder: 'e.g. Sam Taylor' },
  phone: { label: 'Phone number', icon: '📱', type: 'tel', autoComplete: 'tel', placeholder: 'e.g. 07700 900123' },
  location: { label: 'Location', icon: '📍', autoComplete: 'address-level2', placeholder: 'Town or city' },
  emergency_contact_name: { label: 'Contact name', icon: '❤️', placeholder: 'Who should we call?' },
  emergency_contact_phone: { label: 'Contact phone', icon: '📞', type: 'tel', placeholder: 'e.g. 07700 900456' },
  dbs_number: { label: 'Certificate number', icon: '🛡️', placeholder: '12-digit number on the certificate' },
  dbs_expiry: { label: 'Renewal date', icon: '📅', type: 'date' },
}

// What makes your profile useful to the people you run sessions with.
const CHECKLIST = [
  { done: p => !!p?.photo_url, label: 'Add a photo', why: 'so families and colleagues recognise you', action: 'photo' },
  { done: p => !!p?.phone, label: 'Add your phone number', why: 'so your team can reach you on the day', action: 'phone' },
  { done: p => !!(p?.emergency_contact_name && p?.emergency_contact_phone), label: 'Add an emergency contact', why: 'in case something happens to you during a session', action: p => p?.emergency_contact_name ? 'emergency_contact_phone' : 'emergency_contact_name' },
  { done: p => !!p?.dbs_number, label: 'Add your DBS details', why: 'so your organisation can keep its checks up to date', action: 'dbs_number' },
]

const formatDate = iso => {
  const d = iso ? new Date(iso) : null
  return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

export default function ProfilePage({ session, org, onClose, onSignOut, onProfileUpdate, onStartTour }) {
  const isMobile = useIsMobile()
  const userId = session?.user?.id
  const userEmail = session?.user?.email || ''
  const brand = orgBrand(org)
  const [profile, setProfile] = useState(null)
  const [toast, setToast] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [editing, setEditing] = useState(null) // a FIELDS key
  const [showPassword, setShowPassword] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_profiles').select('*').eq('id', userId).single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [userId])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !editing && !showPassword) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, showPassword, onClose])

  const flash = message => { setToast(message); setTimeout(() => setToast(''), 2200) }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return
    setPhotoUploading(true)
    setPhotoError('')
    try {
      // The object path (plus a version), never a URL: the bucket is private,
      // so signed URLs are minted at read time and a stored one would expire.
      const stored = await uploadStaffPhoto({ userId, file, previous: profile?.photo_url })
      const { error } = await supabase.from('user_profiles').update({ photo_url: stored }).eq('id', userId)
      if (error) throw new Error('Your photo uploaded but could not be saved to your profile. Please try again.')
      setProfile(p => ({ ...p, photo_url: stored }))
      if (onProfileUpdate) onProfileUpdate()
      flash('Photo updated')
    } catch (err) {
      setPhotoError(err.message)
    }
    setPhotoUploading(false)
  }

  // Resolves to an error message, or null once saved.
  const saveField = async (field, value) => {
    const clean = typeof value === 'string' ? value.trim() : value
    const { error } = await supabase.from('user_profiles').update({ [field]: clean || null }).eq('id', userId)
    if (error) return 'That did not save. Check your connection and try again.'
    setProfile(p => ({ ...p, [field]: clean || null }))
    if (onProfileUpdate) onProfileUpdate()
    flash('Saved')
    return null
  }

  const name = profile?.full_name || userEmail.split('@')[0] || 'You'
  const firstName = name.trim().split(/\s+/)[0]
  const initials = name.split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel = ROLE_LABELS[profile?.role] || 'Team member'
  const done = CHECKLIST.filter(c => c.done(profile)).length
  const next = CHECKLIST.find(c => !c.done(profile))
  const startNext = () => {
    const action = typeof next.action === 'function' ? next.action(profile) : next.action
    if (action === 'photo') fileInputRef.current?.click()
    else setEditing(action)
  }

  const expiry = profile?.dbs_expiry ? new Date(profile.dbs_expiry) : null
  const daysLeft = expiry && !isNaN(expiry) ? Math.ceil((expiry - new Date()) / 86400000) : null
  const dbsStatus = daysLeft === null ? null
    : daysLeft < 0 ? { tone: 'danger', text: 'Expired' }
    : daysLeft < 60 ? { tone: 'warn', text: `Renew in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` }
    : { tone: 'ok', text: 'In date' }

  const row = (field, extra) => (
    <Row key={field} icon={FIELDS[field].icon} label={FIELDS[field].label}
      value={field === 'dbs_expiry' ? formatDate(profile?.dbs_expiry) : profile?.[field]}
      onClick={() => setEditing(field)} {...extra} />
  )

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(8,12,24,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24,
    }}>
      <div role="dialog" aria-modal="true" aria-label="Your profile" onClick={e => e.stopPropagation()} style={{
        position: 'relative', width: '100%', maxWidth: isMobile ? 'none' : 560, height: isMobile ? '100%' : 'auto', maxHeight: isMobile ? 'none' : '92vh',
        background: 'var(--surface2)', borderRadius: isMobile ? 0 : 26, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 90px -30px rgba(0,0,0,0.55)',
      }}>
        <div className="ls-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

          {/* HERO: the organisation's colours, your photo and name */}
          <div style={{ position: 'relative', background: brand.hero, color: '#fff', padding: `calc(env(safe-area-inset-top, 0px) + ${isMobile ? 14 : 18}px) 18px ${isMobile ? 46 : 50}px`, textAlign: 'center', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', width: 300, height: 300, right: -120, top: -160, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, '99')}` }} />
            <div aria-hidden="true" style={{ position: 'absolute', width: 240, height: 240, left: -120, bottom: -150, borderRadius: '50%', border: `2px solid ${withAlpha(brand.accent, 'A6')}` }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <OrgLogo org={org} height={34} maxWidth={110} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffffd9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org?.name}</span>
              </span>
              <button onClick={onClose} aria-label="Close profile" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 99, border: '1px solid #ffffff40', background: '#ffffff1f', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>×</button>
            </div>

            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button onClick={() => fileInputRef.current?.click()} aria-label={profile?.photo_url ? 'Change your photo' : 'Add a photo'} style={{
                position: 'relative', width: 108, height: 108, borderRadius: '50%', padding: 0, border: '4px solid #ffffff', cursor: 'pointer', overflow: 'hidden',
                background: '#fff', color: brand.ink, fontSize: 36, fontWeight: 800,
                fontFamily: 'var(--font-display, inherit)', boxShadow: '0 16px 34px -12px rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center',
              }}>
                {profile?.photo_url
                  ? <SignedImg bucket="staff-photos" src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{initials}</span>}
                {photoUploading && <span style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>Uploading…</span>}
              </button>
              <span aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 4, width: 36, height: 36, borderRadius: '50%', background: brand.ink, color: '#fff', border: '3px solid #fff', boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 15, boxShadow: '0 6px 14px rgba(0,0,0,0.25)', pointerEvents: 'none' }}><Icon name="📷" /></span>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </div>

            <h2 style={{ position: 'relative', margin: '12px 0 6px', fontFamily: 'var(--font-display, inherit)', fontSize: isMobile ? 26 : 28, fontWeight: 800, letterSpacing: -0.5, color: '#fff', overflowWrap: 'anywhere' }}>Hi, {firstName}</h2>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={heroPill}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: brand.accent }} />{roleLabel}</span>
              <span style={heroPill}>{planLabel(org?.plan)}</span>
            </div>
          </div>

          {/* BODY: a card that overlaps the hero */}
          <div style={{ position: 'relative', marginTop: -28, padding: isMobile ? '0 14px 24px' : '0 22px 26px', display: 'grid', gap: 14 }}>
            {photoError && <div role="alert" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 14, padding: '10px 14px' }}>{photoError}</div>}

            {next ? (
              <div style={{ ...card, padding: 16, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <ProgressRing value={done / CHECKLIST.length} color={brand.ink} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Your profile is {done} of {CHECKLIST.length} done</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Next: {next.label.toLowerCase()}, {next.why}.</div>
                  </div>
                </div>
                <button onClick={startNext} style={{ ...primaryButton(brand), width: '100%' }}>{next.label}</button>
              </div>
            ) : (
              <div style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--org-a10)', color: 'var(--org-ink)', fontSize: 18 }}><Icon name="🎉" /></span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Your profile is complete</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>Thanks, {firstName}. Your team has what they need.</div>
                </div>
              </div>
            )}

            <Section title="About you">
              <Row icon="✉️" label="Email" value={userEmail} hint="You sign in with this" />
              {row('full_name')}
              {row('phone')}
              {row('location')}
            </Section>

            <Section title="Emergency contact" note="Who to call if something happens to you during a session.">
              {row('emergency_contact_name')}
              {row('emergency_contact_phone')}
            </Section>

            <Section title="DBS check">
              {row('dbs_number')}
              {row('dbs_expiry', { badge: dbsStatus })}
            </Section>

            <Section title="Account">
              <Row icon="🔑" label="Password" value="Change your password" onClick={() => setShowPassword(true)} plain />
              {onStartTour && <Row icon="🧭" label="Take the tour" value="A one-minute look around the app" onClick={onStartTour} plain />}
              <Row icon="🚪" label="Sign out" value={`Signed in as ${userEmail}`} onClick={() => onSignOut && onSignOut()} danger plain />
            </Section>
          </div>
        </div>

        {toast && (
          <div role="status" style={{ position: 'absolute', left: '50%', bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--surface)', borderRadius: 99, padding: '10px 18px', fontSize: 14, fontWeight: 700, boxShadow: '0 12px 30px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <Icon name="✓" /> {toast}
          </div>
        )}
      </div>

      {editing && (
        <EditSheet field={editing} value={profile?.[editing]} isMobile={isMobile} brand={brand}
          onClose={() => setEditing(null)} onSave={value => saveField(editing, value)} />
      )}
      {showPassword && <PasswordSheet isMobile={isMobile} brand={brand} onClose={() => setShowPassword(false)} onDone={() => flash('Password changed')} />}
    </div>
  )
}

function Section({ title, note, children }) {
  return (
    <section>
      <h3 style={{ margin: '4px 6px 8px', fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text3)' }}>{title}</h3>
      <div style={{ ...card, overflow: 'hidden' }}>{children}</div>
      {note && <p style={{ margin: '8px 6px 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text3)' }}>{note}</p>}
    </section>
  )
}

// One line of your profile. The whole row is the button, so it is an easy
// tap on a phone; a missing value says "Add" in the brand colour.
function Row({ icon, label, value, hint, onClick, badge, danger, plain }) {
  const content = (
    <>
      <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 17, background: danger ? 'var(--danger-bg)' : 'var(--org-a10)', color: danger ? 'var(--danger-text)' : 'var(--org-ink)' }}><Icon name={icon} /></span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: plain ? 15 : 12.5, fontWeight: plain ? 700 : 600, color: danger ? 'var(--danger-text)' : plain ? 'var(--text)' : 'var(--text3)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: plain ? 12.5 : 15, fontWeight: plain ? 500 : 700, marginTop: 1, overflowWrap: 'anywhere', color: plain ? 'var(--text3)' : value ? 'var(--text)' : 'var(--org-ink)' }}>
          {value || (onClick ? 'Add' : 'Not set')}
        </span>
        {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{hint}</span>}
      </span>
      {badge && <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 9px', borderRadius: 99, flexShrink: 0, background: `var(--${badge.tone}-bg)`, color: `var(--${badge.tone}-text)` }}>{badge.text}</span>}
      {onClick && <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 20, flexShrink: 0 }}>›</span>}
    </>
  )
  const style = { width: '100%', minHeight: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border-soft)', background: 'transparent', fontFamily: 'inherit', boxSizing: 'border-box' }
  return onClick
    ? <button onClick={onClick} aria-label={`${label}: ${value || 'not set'}`} style={{ ...style, cursor: 'pointer' }}>{content}</button>
    : <div style={style}>{content}</div>
}

function ProgressRing({ value, color }) {
  const r = 22, c = 2 * Math.PI * r
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 28 28)" style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      <text x="28" y="32.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text)">{Math.round(value * 100)}%</text>
    </svg>
  )
}

// A bottom sheet on a phone, a small dialog on a desktop.
function Sheet({ title, isMobile, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(8,12,24,0.45)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: isMobile ? 'none' : 420, background: 'var(--surface)', borderRadius: isMobile ? '24px 24px 0 0' : 20,
        padding: `${isMobile ? 10 : 22}px 20px calc(20px + env(safe-area-inset-bottom, 0px))`, boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', boxSizing: 'border-box',
      }}>
        {isMobile && <div aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 99, background: 'var(--border)', margin: '0 auto 14px' }} />}
        <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function EditSheet({ field, value, isMobile, brand, onClose, onSave }) {
  const config = FIELDS[field]
  const [val, setVal] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    const problem = await onSave(val)
    setSaving(false)
    if (problem) setError(problem)
    else onClose()
  }
  return (
    <Sheet title={value ? `Change ${config.label.toLowerCase()}` : `Add ${config.label.toLowerCase()}`} isMobile={isMobile} onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor="profile-edit" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{config.label}</label>
        <input id="profile-edit" autoFocus type={config.type || 'text'} autoComplete={config.autoComplete} placeholder={config.placeholder}
          value={val} onChange={e => setVal(e.target.value)} style={inputStyle} />
        {error && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: 'var(--danger-text)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...primaryButton(brand), flex: 2, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Sheet>
  )
}

function PasswordSheet({ isMobile, brand, onClose, onDone }) {
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async e => {
    e.preventDefault()
    if (newPw.length < 8) { setError('Use at least 8 characters.'); return }
    if (newPw !== confirm) { setError('The two passwords do not match.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (err) { setError(err.message); return }
    onDone()
    onClose()
  }
  return (
    <Sheet title="Change your password" isMobile={isMobile} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
        <label htmlFor="pw-new" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>New password</label>
        <input id="pw-new" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputStyle} />
        <label htmlFor="pw-confirm" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Type it again</label>
        <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} />
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger-text)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...primaryButton(brand), flex: 2, opacity: saving ? 0.7 : 1 }}>{saving ? 'Changing…' : 'Change password'}</button>
        </div>
      </form>
    </Sheet>
  )
}

const card = { background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border-soft, var(--border))', boxShadow: '0 10px 30px -22px rgba(15,23,42,0.45)' }
const heroPill = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: '#ffffff24', border: '1px solid #ffffff38', fontSize: 12.5, fontWeight: 700, color: '#fff' }
const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: 50, padding: '12px 14px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none' }
const secondaryButton = { flex: 1, minHeight: 50, borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const primaryButton = brand => ({ minHeight: 50, borderRadius: 14, border: 'none', background: brand.ink, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 12px 26px -14px ${withAlpha(brand.primary, 'CC')}` })
