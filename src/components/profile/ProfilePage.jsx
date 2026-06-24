import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ROLE_CONFIG = {
  admin:     { label: 'Administrator', badge: 'Admin',     color: '#4F6EF7', light: '#EEF2FF' },
  staff:     { label: 'Staff Member',  badge: 'Staff',     color: '#1B9AAA', light: '#F0FDFA' },
  volunteer: { label: 'Volunteer',     badge: 'Volunteer', color: '#10B981', light: '#ECFDF5' },
  parent:    { label: 'Parent/Carer',  badge: 'Parent',    color: '#F59E0B', light: '#FFFBEB' },
}

function EditFieldModal({ label, value, onClose, onSave }) {
  const [val, setVal] = useState(value || '')
  const [saving, setSaving] = useState(false)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 16 }}>Change {label}</div>
        <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Cancel</button>
          <button onClick={async () => { setSaving(true); await onSave(val); setSaving(false); onClose() }}
            style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#4F6EF7', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            {saving ? 'Saving...' : 'Save'}
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
  const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', marginBottom: 12 }

  const handleSave = async () => {
    if (newPw !== confirm) { setError('Passwords do not match.'); return }
    if (newPw.length < 8) { setError('Min. 8 characters.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: newPw })
    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true); setSaving(false)
    setTimeout(onClose, 1500)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 16 }}>Change Password</div>
        {error && <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
        {success && <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#15803D', fontWeight: 600 }}>✓ Password updated!</div>}
        <input style={inp} type="password" placeholder="New password (min. 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} />
        <input style={{ ...inp, marginBottom: 16 }} type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#4F6EF7', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage({ session, org, onClose, onSignOut, onProfileUpdate }) {
  const userId = session?.user?.id
  const userEmail = session?.user?.email || ''
  const [profile, setProfile] = useState(null)
  const [activeSection, setActiveSection] = useState('profile')
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const hasEdits = Object.keys(edits).length > 0
  const [photoUploading, setPhotoUploading] = useState(false)
  const [editField, setEditField] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_profiles').select('*').eq('id', userId).single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [userId])

  const role = ROLE_CONFIG[profile?.role] || ROLE_CONFIG.staff
  const initials = (profile?.full_name || userEmail).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const primary = org?.primary_color || '#4F6EF7'

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
      if (onProfileUpdate) onProfileUpdate()
    }
    setPhotoUploading(false)
  }

  const saveField = (field, value) => {
    setEdits(e => ({ ...e, [field]: value }))
    setProfile(p => ({ ...p, [field]: value }))
  }

  const handleSaveAll = async () => {
    if (!hasEdits) return
    setSaving(true)
    await supabase.from('user_profiles').update(edits).eq('id', userId)
    setEdits({})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const NAV = [
    { key: 'profile',   icon: '👤', label: 'My Profile',        sub: 'View and edit your details' },
    { key: 'security',  icon: '🔒', label: 'Account & Security', sub: 'Password, 2FA and login' },
    { key: 'dbs',       icon: '🪪', label: 'DBS & Compliance',   sub: 'DBS check and expiry' },
    { key: 'emergency', icon: '🚨', label: 'Emergency Contact',  sub: 'Next of kin details' },
  ]

  const InfoRow = ({ icon, label, value, actionLabel, onAction }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: value ? '#111' : '#d1d5db', marginTop: 1 }}>{value || 'Not set'}</div>
      </div>
      {onAction && (
        <button onClick={onAction} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151', flexShrink: 0 }}>{actionLabel || 'Change'}</button>
      )}
    </div>
  )

  const dbsExpiry = profile?.dbs_expiry ? new Date(profile.dbs_expiry) : null
  const daysUntilExpiry = dbsExpiry ? Math.ceil((dbsExpiry - new Date()) / (1000 * 60 * 60 * 24)) : null
  const dbsWarning = daysUntilExpiry !== null && daysUntilExpiry < 60

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '90vh', overflow: 'hidden', display: 'flex', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: 260, background: '#fafafa', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

          {/* Avatar */}
          <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
              <div onClick={() => fileInputRef.current?.click()} style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', cursor: 'pointer', overflow: 'hidden', margin: '0 auto' }}>
                {profile?.photo_url
                  ? <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : photoUploading ? '...' : initials}
              </div>
              <div onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', fontSize: 10 }}>📷</div>
              <div style={{ position: 'absolute', bottom: 2, left: 2, width: 12, height: 12, borderRadius: '50%', background: '#10B981', border: '2px solid #fff' }} />
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>{profile?.full_name || 'Your Name'}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{role.label}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: role.color, background: role.light, borderRadius: 20, padding: '3px 10px' }}>{role.badge}</span>
            </div>
          </div>

          {/* Org info */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#fff', border: '1px solid #f0f0f0' }}>
              {org?.logo_url
                ? <img src={org.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
                : <div style={{ width: 28, height: 28, borderRadius: 6, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{(org?.name || 'O')[0]}</div>}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{org?.name || 'Organisation'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'capitalize' }}>{org?.plan || 'Starter'} Plan</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
            {NAV.map(n => (
              <button key={n.key} onClick={() => setActiveSection(n.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: activeSection === n.key ? '#EEF2FF' : 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'background 0.15s' }}>
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{n.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: activeSection === n.key ? '#4F6EF7' : '#374151' }}>{n.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{n.sub}</div>
                </div>
                {activeSection === n.key && <span style={{ color: '#4F6EF7', fontSize: 16 }}>›</span>}
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
            <button onClick={() => { supabase.auth.signOut(); onSignOut && onSignOut() }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#DC2626' }}>
              <span style={{ fontSize: 16 }}>🚪</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Sign Out</div>
                <div style={{ fontSize: 11, color: '#fca5a5' }}>Sign out of your account</div>
              </div>
            </button>
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{NAV.find(n => n.key === activeSection)?.label}</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Manage your personal information and account details.</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexShrink: 0 }}>×</button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px' }}>

            {activeSection === 'profile' && (
              <div>
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151' }}>Personal Information</div>
                  <InfoRow icon="✉️" label="Email address" value={userEmail} />
                  <InfoRow icon="👤" label="Full name" value={profile?.full_name} onAction={() => setEditField({ field: 'full_name', label: 'Full Name', value: profile?.full_name })} />
                  <InfoRow icon="📱" label="Phone number" value={profile?.phone} onAction={() => setEditField({ field: 'phone', label: 'Phone Number', value: profile?.phone })} />
                  <InfoRow icon="📍" label="Location" value={profile?.location} onAction={() => setEditField({ field: 'location', label: 'Location', value: profile?.location })} />
                </div>

                <div style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', border: '1px solid #E0E7FF', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#4F6EF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✅</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#3730A3' }}>Your account is active</div>
                    <div style={{ fontSize: 12, color: '#6366F1' }}>LaunchSession · {role.badge} Account · {org?.name || ''}</div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div>
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151' }}>Account Security</div>
                  <InfoRow icon="🔒" label="Password" value="Last changed recently" onAction={() => setShowPassword(true)} actionLabel="Update" />
                  <InfoRow icon="🛡️" label="Two-factor authentication" value="Not enabled" onAction={() => {}} actionLabel="Enable" />
                </div>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 28 }}>🔐</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D' }}>Your account is secure</div>
                    <div style={{ fontSize: 12, color: '#16A34A' }}>We'll notify you if we see any suspicious activity.</div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'dbs' && (
              <div>
                {dbsWarning && (
                  <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 22 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>DBS Expiring Soon</div>
                      <div style={{ fontSize: 12, color: '#92400E' }}>Your DBS check expires in {daysUntilExpiry} days. Please renew it.</div>
                    </div>
                  </div>
                )}
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151' }}>DBS Check</div>
                  <InfoRow icon="🪪" label="DBS Number" value={profile?.dbs_number} onAction={() => setEditField({ field: 'dbs_number', label: 'DBS Number', value: profile?.dbs_number })} />
                  <InfoRow icon="📅" label="Expiry Date" value={profile?.dbs_expiry} onAction={() => setEditField({ field: 'dbs_expiry', label: 'DBS Expiry Date', value: profile?.dbs_expiry })} />
                </div>
              </div>
            )}

            {activeSection === 'emergency' && (
              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: '#374151' }}>Emergency Contact</div>
                <InfoRow icon="👤" label="Contact Name" value={profile?.emergency_contact_name} onAction={() => setEditField({ field: 'emergency_contact_name', label: 'Emergency Contact Name', value: profile?.emergency_contact_name })} />
                <InfoRow icon="📱" label="Contact Phone" value={profile?.emergency_contact_phone} onAction={() => setEditField({ field: 'emergency_contact_phone', label: 'Emergency Contact Phone', value: profile?.emergency_contact_phone })} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 28px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            {hasEdits ? (
              <button onClick={handleSaveAll} disabled={saving} style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: saved ? '#10B981' : '#4F6EF7', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s' }}>
                {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
              </button>
            ) : <div />}
            <div style={{ fontSize: 11, color: '#d1d5db' }}>
            LaunchSession · {role.badge} Account · {org?.name || ''}
            </div>
          </div>
        </div>
      </div>

      {editField && (
        <EditFieldModal
          label={editField.label}
          value={editField.value}
          onClose={() => setEditField(null)}
          onSave={val => saveField(editField.field, val)}
        />
      )}
      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
    </div>
  )
}
