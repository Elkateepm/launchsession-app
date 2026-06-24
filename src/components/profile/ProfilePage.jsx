import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ROLE_CONFIG = {
  admin:     { label: 'Admin',        color: '#4F6EF7', light: '#EEF2FF', dark: '#3730A3' },
  staff:     { label: 'Staff',        color: '#1B9AAA', light: '#F0FDFA', dark: '#0E7490' },
  volunteer: { label: 'Volunteer',    color: '#10B981', light: '#ECFDF5', dark: '#065F46' },
  parent:    { label: 'Parent/Carer', color: '#F59E0B', light: '#FFFBEB', dark: '#92400E' },
}

function InfoRow({ label, value, icon }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--border, #f3f4f6)' }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3, #9ca3af)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text, #111)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

function EditProfileModal({ profile, userId, onClose, onSaved }) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [emergencyName, setEmergencyName] = useState(profile?.emergency_contact_name || '')
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_contact_phone || '')
  const [dbsNumber, setDbsNumber] = useState(profile?.dbs_number || '')
  const [dbsExpiry, setDbsExpiry] = useState(profile?.dbs_expiry || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border, #e5e7eb)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12, background: 'var(--surface, #fff)', color: 'var(--text, #111)' }
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text3, #6b7280)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }

  const handleSave = async () => {
    if (!fullName.trim()) { setError('Full name is required.'); return }
    setSaving(true); setError('')
    const updates = { full_name: fullName.trim(), phone: phone || null, location: location || null, emergency_contact_name: emergencyName || null, emergency_contact_phone: emergencyPhone || null, dbs_number: dbsNumber || null, dbs_expiry: dbsExpiry || null }
    const { error: err } = await supabase.from('user_profiles').update(updates).eq('id', profile?.id || userId)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved({ ...profile, ...updates })
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', paddingBottom: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--surface, #fff)', padding: '14px 20px 12px', borderBottom: '1px solid var(--border, #e5e7eb)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text, #111)' }}>Edit Profile</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3, #9ca3af)' }}>×</button>
          </div>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          {error && <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
          <label style={lbl}>Full Name *</label>
          <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          <label style={lbl}>Phone Number</label>
          <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="07700 900000" type="tel" />
          <label style={lbl}>Location</label>
          <input style={inp} value={location} onChange={e => setLocation(e.target.value)} placeholder="City, e.g. London" />
          <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1D4ED8', marginBottom: 10 }}>🚨 Emergency Contact</div>
            <label style={lbl}>Name</label>
            <input style={inp} value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Contact name" />
            <label style={lbl}>Phone</label>
            <input style={{ ...inp, marginBottom: 0 }} value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="07700 900000" type="tel" />
          </div>
          <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E', marginBottom: 10 }}>🪪 DBS Check</div>
            <label style={lbl}>DBS Number</label>
            <input style={inp} value={dbsNumber} onChange={e => setDbsNumber(e.target.value)} placeholder="DBS reference number" />
            <label style={lbl}>Expiry Date</label>
            <input style={{ ...inp, marginBottom: 0 }} type="date" value={dbsExpiry} onChange={e => setDbsExpiry(e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: saving ? '#9ca3af' : '#4F6EF7', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordModal({ onClose }) {
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border, #e5e7eb)', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12, background: 'var(--surface, #fff)', color: 'var(--text, #111)' }
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text3, #6b7280)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }

  const handleSave = async () => {
    if (newPw !== confirm) { setError('Passwords do not match.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: newPw })
    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true); setSaving(false)
    setTimeout(onClose, 1500)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', borderRadius: 20, width: '100%', maxWidth: 500, paddingBottom: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text, #111)' }}>Change Password</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3, #9ca3af)' }}>×</button>
          </div>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          {error && <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
          {success && <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#15803D', fontWeight: 600 }}>✓ Password updated!</div>}
          <label style={lbl}>New Password</label>
          <input style={inp} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
          <label style={lbl}>Confirm Password</label>
          <input style={{ ...inp, marginBottom: 20 }} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: saving ? '#9ca3af' : '#4F6EF7', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage({ session, org, onClose, onSignOut }) {
  const userId = session?.user?.id
  const userEmail = session?.user?.email || ''
  const [profile, setProfile] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_profiles').select('*').eq('id', userId).single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [userId])

  const role = ROLE_CONFIG[profile?.role] || ROLE_CONFIG.staff
  const initials = (profile?.full_name || userEmail).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const dbsExpiry = profile?.dbs_expiry ? new Date(profile.dbs_expiry) : null
  const daysUntilExpiry = dbsExpiry ? Math.ceil((dbsExpiry - new Date()) / (1000 * 60 * 60 * 24)) : null
  const dbsWarning = daysUntilExpiry !== null && daysUntilExpiry < 60

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setPhotoUploading(true)
    const ext = file.name.split('.').pop()
    const filePath = `${userId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('staff-photos').upload(filePath, file, { upsert: true })
    if (!uploadError) {
      const { data } = supabase.storage.from('staff-photos').getPublicUrl(filePath)
      const url = data.publicUrl + '?t=' + Date.now()
      await supabase.from('user_profiles').update({ photo_url: url }).eq('id', userId)
      setProfile(p => ({ ...p, photo_url: url }))
    }
    setPhotoUploading(false)
  }

  const primary = org?.primary_color || '#4F6EF7'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface2, #f9fafb)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>

        {/* Header */}
        <div style={{ background: 'var(--surface, #fff)', borderBottom: '1px solid var(--border, #e5e7eb)', padding: '14px 20px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ width: 36, height: 4, background: 'var(--border, #e5e7eb)', borderRadius: 2, margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text, #111)' }}>My Profile</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowEdit(true)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text, #111)' }}>Edit</button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3, #9ca3af)', lineHeight: 1 }}>×</button>
            </div>
          </div>
        </div>

        {/* Profile hero */}
        <div style={{ background: 'var(--surface, #fff)', margin: '12px 16px', borderRadius: 16, border: '1px solid var(--border, #e5e7eb)', padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div onClick={() => fileInputRef.current?.click()} style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', cursor: 'pointer', overflow: 'hidden', border: `3px solid ${primary}` }}>
                {profile?.photo_url ? (
                  <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : photoUploading ? (
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} />
                ) : initials}
              </div>
              <div onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', fontSize: 11 }}>📷</div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text, #111)', letterSpacing: -0.3 }}>{profile?.full_name || 'Your Name'}</div>
              <div style={{ fontSize: 12, color: 'var(--text3, #6b7280)', marginTop: 2 }}>{userEmail}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: role.dark, background: role.light, borderRadius: 20, padding: '3px 10px' }}>{role.label}</span>
              </div>
            </div>
          </div>
        </div>

        {dbsWarning && (
          <div style={{ margin: '0 16px 12px', background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>DBS Expiring Soon</div>
              <div style={{ fontSize: 12, color: '#92400E' }}>Your DBS check expires in {daysUntilExpiry} days. Please renew it.</div>
            </div>
          </div>
        )}

        {/* Info rows */}
        <div style={{ background: 'var(--surface, #fff)', margin: '0 16px 12px', borderRadius: 16, border: '1px solid var(--border, #e5e7eb)', padding: '4px 16px' }}>
          <InfoRow icon="✉️" label="Email" value={userEmail} />
          <InfoRow icon="📱" label="Phone" value={profile?.phone} />
          <InfoRow icon="📍" label="Location" value={profile?.location} />
        </div>

        {(profile?.emergency_contact_name || profile?.emergency_contact_phone) && (
          <div style={{ background: 'var(--surface, #fff)', margin: '0 16px 12px', borderRadius: 16, border: '1px solid var(--border, #e5e7eb)', padding: '4px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3, #9ca3af)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '12px 0 4px' }}>Emergency Contact</div>
            <InfoRow icon="👤" label="Name" value={profile?.emergency_contact_name} />
            <InfoRow icon="📱" label="Phone" value={profile?.emergency_contact_phone} />
          </div>
        )}

        {(profile?.dbs_number || profile?.dbs_expiry) && (
          <div style={{ background: 'var(--surface, #fff)', margin: '0 16px 12px', borderRadius: 16, border: '1px solid var(--border, #e5e7eb)', padding: '4px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3, #9ca3af)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '12px 0 4px' }}>DBS Check</div>
            <InfoRow icon="🪪" label="DBS Number" value={profile?.dbs_number} />
            <InfoRow icon="📅" label="Expiry Date" value={profile?.dbs_expiry} />
          </div>
        )}

        {/* Actions */}
        <div style={{ background: 'var(--surface, #fff)', margin: '0 16px 12px', borderRadius: 16, border: '1px solid var(--border, #e5e7eb)', overflow: 'hidden' }}>
          <button onClick={() => setShowPassword(true)} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', borderBottom: '1px solid var(--border, #f3f4f6)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #111)' }}>Change Password</div>
            <span style={{ marginLeft: 'auto', color: 'var(--text3, #9ca3af)', fontSize: 18 }}>›</span>
          </button>
          <button onClick={() => { supabase.auth.signOut(); onSignOut && onSignOut() }} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚪</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>Sign Out</div>
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3, #9ca3af)', fontWeight: 600, padding: '4px 0 8px' }}>
          LaunchSession · {role.label} Account · {org?.name || ''}
        </div>
      </div>

      {showEdit && <EditProfileModal profile={profile} userId={userId} onClose={() => setShowEdit(false)} onSaved={updated => setProfile(updated)} />}
      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
    </div>
  )
}
