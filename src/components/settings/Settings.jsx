import React, { useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../context/OrgContext'
import OrgSettingsPanel from './OrgSettingsPanel'

const NAV = [
  { key: 'organisation', icon: '🏢', label: 'Organisation', group: 'Platform' },
  { key: 'users',        icon: '👥', label: 'Users & Permissions', group: 'Platform' },
  { key: 'branding',     icon: '🎨', label: 'Branding', group: 'Platform', requiresBranding: true },
  { key: 'safeguarding', icon: '🛡', label: 'Safeguarding', group: 'Operations' },
  { key: 'registers',    icon: '📋', label: 'Registers', group: 'Operations' },
  { key: 'sessions',     icon: '📅', label: 'Sessions', group: 'Operations' },
  { key: 'notifications',icon: '🔔', label: 'Notifications', group: 'Communications' },
  { key: 'communications',icon: '📢', label: 'Communications', group: 'Communications' },
  { key: 'security',     icon: '🔒', label: 'Security', group: 'Account' },
  { key: 'integrations', icon: '🔌', label: 'Integrations', group: 'Account' },
  { key: 'billing',      icon: '💳', label: 'Billing', group: 'Account' },
  { key: 'help',         icon: '📚', label: 'Help & Support', group: 'Account' },
]

const GROUPS = ['Platform', 'Operations', 'Communications', 'Account']

function SettingCard({ title, description, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)' }

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? '#1B9AAA' : '#D1D5DB', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  )
}

// ─── SECTIONS ─────────────────────────────────────────────────

function OrgSection({ org }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    name: org?.name || '',
    charity_number: org?.charity_number || '',
    website: org?.website || '',
    address: org?.address || '',
    contact_email: org?.contact_email || '',
    contact_phone: org?.contact_phone || '',
    description: org?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('organisations').update(form).eq('id', org?.id)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #0A0F1E, #1a2744)', borderRadius: 12, padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: org?.primary_color || '#1B9AAA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
          {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14 }} /> : (org?.name || 'O')[0]}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{org?.name || 'Your Organisation'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{org?.plan || 'starter'} plan</span>
            <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>● Active</span>
          </div>
        </div>
      </div>
      <SettingCard title="Organisation Profile" description="Basic information about your organisation">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="Organisation Name"><input style={inp} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Charity Number"><input style={inp} value={form.charity_number} onChange={e => set('charity_number', e.target.value)} placeholder="e.g. 1234567" /></Field>
        </div>
        <Field label="Website"><input style={inp} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." /></Field>
        <Field label="Address"><input style={inp} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="Contact Email"><input style={inp} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} /></Field>
          <Field label="Contact Phone"><input style={inp} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></Field>
        </div>
        <Field label="Description"><textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of your organisation..." /></Field>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#1B9AAA', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </SettingCard>

      <RegisterGroupsManager org={org} />
    </div>
  )
}

const GROUP_COLOR_PRESETS = ['#E53935', '#1B9AAA', '#417505', '#B8860B', '#7B2D8B', '#1A1A1A', '#F97316', '#0EA5E9', '#EC4899', '#64748B']

function RegisterGroupsManager({ org }) {

  const loadGroups = React.useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data: orgRow, error: orgErr } = await supabase.from('organisations').select('custom_groups').eq('id', orgId).single()
      if (orgErr) throw orgErr
      const g = orgRow?.custom_groups || []
      setGroups(g)

      const { data: childRows, error: childErr } = await supabase.from('children').select('group_name').eq('org_id', orgId).eq('active', true)
      if (childErr) throw childErr
      const countMap = {}
      ;(childRows || []).forEach(c => {
        const key = (c.group_name || '').trim().toLowerCase()
        if (!key) return
        countMap[key] = (countMap[key] || 0) + 1
      })
      setCounts(countMap)
    } catch (e) {
      setError(e.message || 'Failed to load groups')
    }
    setLoading(false)
  }, [orgId])

  React.useEffect(() => { loadGroups() }, [loadGroups])

  const persistGroups = async (updated) => {
    setGroups(updated)
    try {
      const { error: err } = await supabase.from('organisations').update({ custom_groups: updated }).eq('id', orgId)
      if (err) throw err
    } catch (e) {
      setError(e.message || 'Failed to save groups')
    }
  }

  const handleAdd = async () => {
    const label = newName.trim()
    if (!label) return
    if (groups.some(g => g.label.toLowerCase() === label.toLowerCase())) { setError('That group already exists.'); return }
    const color = GROUP_COLOR_PRESETS[groups.length % GROUP_COLOR_PRESETS.length]
    const updated = [...groups, { id: `group-${Date.now()}`, label, color }]
    setError('')
    setNewName('')
    setAdding(false)
    await persistGroups(updated)
  }

  const handleRename = async (id, newLabel) => {
    if (!newLabel.trim()) return
    await persistGroups(groups.map(g => g.id === id ? { ...g, label: newLabel.trim() } : g))
  }

  const handleColorChange = async (id, color) => {
    await persistGroups(groups.map(g => g.id === id ? { ...g, color } : g))
  }

  const handleDelete = async (id) => {
    const group = groups.find(g => g.id === id)
    const count = counts[(group?.label || '').toLowerCase()] || 0
    const msg = count > 0
      ? `Delete "${group.label}"? ${count} ${count === 1 ? 'child is' : 'children are'} currently in this group — they will keep the group name on their record, but it will no longer appear as a managed group.`
      : `Delete "${group?.label}"?`
    if (!window.confirm(msg)) return
    await persistGroups(groups.filter(g => g.id !== id))
  }

  return (
    <SettingCard title="Groups" description="Organise your register into groups like Red, Blue, Juniors or Teens">
      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, fontWeight: 600 }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Loading groups...</div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 16px', background: 'var(--surface2)', borderRadius: 14, border: '1.5px dashed var(--border2)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏷️</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>No groups yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Create groups like Red, Blue, Juniors or Teens to organise your register.</div>
          <button onClick={() => setAdding(true)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: org?.primary_color || '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Group</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
          {groups.map(g => (
            <GroupCard key={g.id} group={g} count={counts[g.label.toLowerCase()] || 0} onRename={handleRename} onColorChange={handleColorChange} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {groups.length > 0 && !adding && (
        <button onClick={() => setAdding(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${org?.primary_color || '#1B9AAA'}40`, background: (org?.primary_color || '#1B9AAA') + '0c', color: org?.primary_color || '#1B9AAA', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Group
        </button>
      )}

      {adding && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Red, Juniors, Coach A..." style={{ ...inp, flex: 1 }} />
          <button onClick={handleAdd} style={{ padding: '0 18px', borderRadius: 8, border: 'none', background: org?.primary_color || '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Add</button>
          <button onClick={() => { setAdding(false); setNewName(''); setError('') }} style={{ padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
    </SettingCard>
  )
}

function GroupCard({ group, count, onRename, onColorChange, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(group.label)
  const [showColors, setShowColors] = useState(false)

  const saveRename = () => {
    if (label.trim() && label.trim() !== group.label) onRename(group.id, label.trim())
    setEditing(false)
  }

  return (
    <div style={{ border: '1.5px solid var(--border)', borderRadius: 14, padding: '12px 14px', background: 'var(--surface)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <button onClick={() => setShowColors(v => !v)} title="Change colour"
          style={{ width: 20, height: 20, borderRadius: '50%', background: group.color, border: '2px solid #fff', boxShadow: '0 0 0 1.5px ' + group.color, cursor: 'pointer', flexShrink: 0 }} />
        {editing ? (
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)} onBlur={saveRename} onKeyDown={e => e.key === 'Enter' && saveRename()}
            style={{ flex: 1, fontSize: 14, fontWeight: 800, border: 'none', borderBottom: `1.5px solid ${group.color}`, outline: 'none', padding: '2px 0', fontFamily: 'inherit', background: 'transparent', color: 'var(--text)' }} />
        ) : (
          <div onClick={() => setEditing(true)} style={{ flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--text)', cursor: 'text' }}>{group.label}</div>
        )}
        <button onClick={() => onDelete(group.id)} title="Delete group" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#DC2626', opacity: 0.7, padding: 2 }}>🗑️</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{count} {count === 1 ? 'child' : 'children'}</div>

      {showColors && (
        <div style={{ position: 'absolute', top: '100%', left: 12, marginTop: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 8, display: 'flex', gap: 5, flexWrap: 'wrap', width: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 10 }}>
          {GROUP_COLOR_PRESETS.map(c => (
            <button key={c} onClick={() => { onColorChange(group.id, c); setShowColors(false) }}
              style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: c === group.color ? '2px solid #111' : '2px solid #fff', boxShadow: '0 0 0 1px #E5E7EB', cursor: 'pointer' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function BrandingSection({ org, refreshOrg }) {
  const isMobile = useIsMobile()
  const [color, setColor] = useState(org?.primary_color || '#1B9AAA')
  const [secondaryColor, setSecondaryColor] = useState(org?.secondary_color || '#0EA5E9')
  const [slogan, setSlogan] = useState(org?.slogan || '')
  const [logoPreview, setLogoPreview] = useState(org?.logo_url || '')
  const [logoFile, setLogoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previewTab, setPreviewTab] = useState('workspace') // workspace | login

  const palettes = [
    { name: 'Ocean', color: '#1B9AAA' },
    { name: 'Blaze', color: '#FF6B1A' },
    { name: 'Forest', color: '#16A34A' },
    { name: 'Violet', color: '#7C3AED' },
    { name: 'Navy', color: '#0B2D5E' },
    { name: 'Rose', color: '#E11D48' },
  ]

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    let logoUrl = org?.logo_url || ''

    if (logoFile) {
      const ext = logoFile.name.split('.').pop()
      const filePath = `${org.id}/logo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, logoFile, { upsert: true })

      if (!uploadError) {
        const { data } = supabase.storage.from('org-logos').getPublicUrl(filePath)
        logoUrl = data.publicUrl
      }
    }

    await supabase.from('organisations').update({
      primary_color: color,
      secondary_color: secondaryColor,
      slogan,
      logo_url: logoUrl,
    }).eq('id', org?.id)

    document.documentElement.style.setProperty('--org-primary', color)
    if (logoUrl) {
      const favicon = document.querySelector("link[rel='icon']") || document.createElement('link')
      favicon.rel = 'icon'
      favicon.href = logoUrl + '?t=' + Date.now()
      document.head.appendChild(favicon)
    }
    if (refreshOrg) await refreshOrg()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleReset = () => {
    if (!window.confirm('Reset branding to defaults? This clears your logo, colours and tagline in this form (not saved until you hit Save).')) return
    setColor('#1B9AAA')
    setSecondaryColor('#0EA5E9')
    setSlogan('')
    setLogoPreview('')
    setLogoFile(null)
  }

  const initials = (org?.name || 'LS').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const orgName = org?.name || 'Your Organisation'

  return (
    <div>
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#6366F1', letterSpacing: 2, textTransform: 'uppercase' }}>Branding Centre</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>Make LaunchSession feel like {orgName} ✨</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Customise your organisation's look and create a consistent, professional experience.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={handleReset} style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ↺ Reset to defaults
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: saving ? '#9ca3af' : color, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: saving ? 'none' : `0 8px 24px ${color}40`, display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save changes'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: 16 }}>
        <div>
          <SettingCard title="Logo" description="This logo will appear in the sidebar, login screen and workspace header.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface2)', border: '1.5px dashed var(--border2)', borderRadius: 14, padding: 16, marginBottom: 4 }}>
              <div style={{ width: 72, height: 72, borderRadius: 16, background: logoPreview ? '#fff' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontWeight: 900, fontSize: 22, color: '#fff', flexShrink: 0, boxShadow: `0 8px 24px ${color}40` }}>
                {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Upload your logo</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>PNG or SVG, recommended 512×512px, transparent background works best.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
                    Change logo
                    <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                  </label>
                  {logoPreview && (
                    <button onClick={() => { setLogoPreview(''); setLogoFile(null) }} style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                  )}
                </div>
              </div>
            </div>
          </SettingCard>

          <SettingCard title="Primary Colour" description="Used for primary buttons, highlights and active states.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 52, height: 44, borderRadius: 10, border: '1.5px solid #e5e7eb', cursor: 'pointer', padding: 2 }} />
              <input style={{ ...inp, flex: 1 }} value={color} onChange={e => setColor(e.target.value)} placeholder="#1B9AAA" />
              <div style={{ width: 44, height: 44, borderRadius: 10, background: color, flexShrink: 0, boxShadow: `0 8px 20px ${color}50` }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Presets</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {palettes.map(p => (
                <button key={p.color} onClick={() => setColor(p.color)} style={{ border: color === p.color ? `2px solid ${p.color}` : '1px solid var(--border)', background: 'var(--surface)', borderRadius: 999, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />{p.name}
                </button>
              ))}
            </div>
          </SettingCard>

          <SettingCard title="Secondary Colour" description="Used for accents, links and secondary elements.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ width: 52, height: 44, borderRadius: 10, border: '1.5px solid #e5e7eb', cursor: 'pointer', padding: 2 }} />
              <input style={{ ...inp, flex: 1 }} value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} placeholder="#0EA5E9" />
              <div style={{ width: 44, height: 44, borderRadius: 10, background: secondaryColor, flexShrink: 0, boxShadow: `0 8px 20px ${secondaryColor}50` }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Presets</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {palettes.map(p => (
                <button key={p.color} onClick={() => setSecondaryColor(p.color)} style={{ border: secondaryColor === p.color ? `2px solid ${p.color}` : '1px solid var(--border)', background: 'var(--surface)', borderRadius: 999, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />{p.name}
                </button>
              ))}
            </div>
          </SettingCard>

          <SettingCard title="Tagline" description="Shown on the login screen and workspace.">
            <Field label="Tagline" hint={`${slogan.length}/80`}>
              <input style={inp} value={slogan} onChange={e => setSlogan(e.target.value.slice(0, 80))} placeholder="e.g. Sport for every child" maxLength={80} />
            </Field>
          </SettingCard>
        </div>

        <div>
          <SettingCard title="Live Preview" description="This is how your brand will appear across LaunchSession.">
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'var(--surface2)', borderRadius: 10, padding: 4 }}>
              {[
                { key: 'workspace', label: '🖥 Workspace' },
                { key: 'login', label: '🔐 Login Screen' },
              ].map(t => (
                <button key={t.key} onClick={() => setPreviewTab(t.key)} style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: 'none', background: previewTab === t.key ? 'var(--surface)' : 'transparent', color: previewTab === t.key ? color : 'var(--text3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: previewTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {previewTab === 'workspace' && (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                <div style={{ background: `linear-gradient(135deg, ${color}, #0F172A)`, padding: 16, color: '#fff' }}>
                  <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 2, fontWeight: 800, marginBottom: 10 }}>WORKSPACE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontWeight: 900, fontSize: 14 }}>
                      {logoPreview ? <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>{orgName}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{slogan || 'Your tagline here'}</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: 14, background: 'var(--surface2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {['Sessions', 'Registers', 'Team', 'Reports'].map((item, i) => (
                      <div key={item} style={{ borderRadius: 8, padding: 10, background: i === 0 ? `${color}14` : '#fff', border: `1px solid ${i === 0 ? color + '40' : '#E5E7EB'}` }}>
                        <div style={{ width: 16, height: 3, borderRadius: 99, background: i === 0 ? color : secondaryColor, marginBottom: 6 }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{item}</div>
                      </div>
                    ))}
                  </div>
                  <button style={{ width: '100%', border: 'none', borderRadius: 8, padding: 10, background: `linear-gradient(135deg, ${color}, ${secondaryColor})`, color: '#fff', fontWeight: 700, fontSize: 12 }}>Primary Action</button>
                  <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', marginTop: 10 }}>Powered by LaunchSession</div>
                </div>
              </div>
            )}

            {previewTab === 'login' && (
              <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB', background: '#060B18', padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, margin: '0 auto 14px', background: logoPreview ? '#fff' : `linear-gradient(135deg, ${color}, ${secondaryColor})`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontWeight: 900, fontSize: 18, color: '#fff', boxShadow: `0 8px 24px ${color}40` }}>
                  {logoPreview ? <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initials}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{orgName}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>{slogan || 'Your tagline here'}</div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}30`, borderRadius: 14, padding: 18, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Sign in to {orgName}</div>
                  <div style={{ height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 10 }} />
                  <div style={{ height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${color}, ${secondaryColor})` }} />
                </div>
              </div>
            )}
          </SettingCard>

          <div style={{ background: `linear-gradient(135deg, ${color}12, ${secondaryColor}12)`, border: `1px solid ${color}30`, borderRadius: 14, padding: 16, marginTop: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>🚀</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: color }}>Your brand, your impact</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>A consistent brand builds confidence with parents, volunteers and partners.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SecuritySection() {
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  const handleChangePassword = async () => {
    setPwLoading(true)
    setPwMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) { setPwMsg('Could not find your email.'); setPwLoading(false); return }
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, { redirectTo: window.location.href })
    setPwLoading(false)
    setPwMsg(error ? 'Error: ' + error.message : '✅ Password reset email sent — check your inbox.')
  }

  return (
    <div>
      <SettingCard title="Password & Authentication">
        <button onClick={handleChangePassword} disabled={pwLoading} style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
          {pwLoading ? 'Sending...' : 'Change Password'}
        </button>
        {pwMsg && <div style={{ fontSize: 13, color: pwMsg.startsWith('✅') ? '#16A34A' : '#DC2626', marginBottom: 12, fontWeight: 600 }}>{pwMsg}</div>}
        <Toggle value={false} onChange={() => {}} label="Two-Factor Authentication (2FA) — coming soon" />
        <Toggle value={true} onChange={() => {}} label="Email login notifications" />
      </SettingCard>
      <SettingCard title="Active Sessions" description="Devices currently logged in to your account">
        <div style={{ background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Current Session</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Browser · Now</div>
          </div>
          <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Active</span>
        </div>
      </SettingCard>
    </div>
  )
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState({ safeguarding: true, sessions: true, attendance: true, volunteers: false })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const toggle = (k) => setPrefs(p => ({ ...p, [k]: !p[k] }))

  const handleSave = async () => {
    setSaving(true)
    // Save to user_profiles notification_prefs for current user
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await supabase.from('user_profiles').update({ notification_prefs: prefs }).eq('id', session.user.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SettingCard title="Notification Preferences" description="Choose what you want to be notified about">
      <Toggle value={prefs.safeguarding} onChange={() => toggle('safeguarding')} label="🛡 Safeguarding alerts" />
      <Toggle value={prefs.sessions}     onChange={() => toggle('sessions')}     label="📅 Session reminders" />
      <Toggle value={prefs.attendance}   onChange={() => toggle('attendance')}   label="📋 Attendance alerts" />
      <Toggle value={prefs.volunteers}   onChange={() => toggle('volunteers')}   label="❤️ Volunteer updates" />
      <div style={{ marginTop: 16 }}>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#1B9AAA', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Preferences'}
        </button>
      </div>
    </SettingCard>
  )
}

function IntegrationsSection() {
  const isMobile = useIsMobile()
  const integrations = [
    { name: 'Google Calendar', icon: '📅', status: 'available', desc: 'Sync sessions with Google Calendar' },
    { name: 'Microsoft Outlook', icon: '📧', status: 'connected', desc: 'Send emails via Outlook' },
    { name: 'Google Drive', icon: '📁', status: 'available', desc: 'Store documents and reports' },
    { name: 'Mailchimp', icon: '📬', status: 'available', desc: 'Send newsletters to parents' },
    { name: 'Zapier', icon: '⚡', status: 'coming_soon', desc: 'Automate workflows' },
    { name: 'Stripe', icon: '💳', status: 'coming_soon', desc: 'Accept payments and donations' },
  ]
  return (
    <SettingCard title="Integrations" description="Connect LaunchSession with your other tools">
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
        {integrations.map(i => (
          <div key={i.name} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{i.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{i.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i.desc}</div>
              </div>
            </div>
            <div>
              {i.status === 'connected' && <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>● Connected</span>}
              {i.status === 'available' && <button style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #1B9AAA', background: '#fff', color: '#1B9AAA', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Connect</button>}
              {i.status === 'coming_soon' && <span style={{ background: '#F3F4F6', color: '#9ca3af', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Coming Soon</span>}
            </div>
          </div>
        ))}
      </div>
    </SettingCard>
  )
}

function BillingSection({ org }) {
  return (
    <div>
      <SettingCard title="Current Plan">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', textTransform: 'capitalize' }}>{org?.plan || 'Starter'}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Contact us for pricing</div>
          </div>
          <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>Active</span>
        </div>
        <a href="mailto:hello@launchsession.co.uk?subject=Upgrade Plan" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Upgrade Plan</a>
      </SettingCard>
      <SettingCard title="Usage">
        {[
          { label: 'Staff Users', value: '—', max: 'Unlimited' },
          { label: 'Children on Register', value: '—', max: 'Unlimited' },
          { label: 'Sessions This Month', value: '—', max: 'Unlimited' },
        ].map(u => (
          <div key={u.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: 14, color: '#374151' }}>{u.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{u.value} <span style={{ color: '#9ca3af', fontWeight: 400 }}>/ {u.max}</span></span>
          </div>
        ))}
      </SettingCard>
    </div>
  )
}

function HelpSection() {
  const links = [
    { icon: '📖', title: 'Knowledge Base', desc: 'Guides and how-to articles', href: '#' },
    { icon: '🎥', title: 'Training Videos', desc: 'Step-by-step video tutorials', href: '#' },
    { icon: '💬', title: 'Contact Support', desc: 'Get help from our team', href: 'mailto:hello@launchsession.co.uk' },
    { icon: '💡', title: 'Feature Requests', desc: 'Suggest new features', href: 'mailto:hello@launchsession.co.uk?subject=Feature Request' },
    { icon: '🐛', title: 'Report a Bug', desc: 'Let us know something is broken', href: 'mailto:hello@launchsession.co.uk?subject=Bug Report' },
  ]
  return (
    <SettingCard title="Help & Support">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map(l => (
          <a key={l.title} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            <span style={{ fontSize: 22 }}>{l.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.title}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{l.desc}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 16 }}>›</span>
          </a>
        ))}
      </div>
    </SettingCard>
  )
}

function ComingSoon({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label} Settings</div>
      <div style={{ fontSize: 14 }}>This section is coming soon.</div>
    </div>
  )
}


function GroupsSection({ org }) {
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #0A0F1E, #1a2744)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 32 }}>👥</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Groups & Locations</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Define the groups and venues used across registers, sessions and reports</div>
        </div>
      </div>
      <OrgSettingsPanel orgId={org?.id} />
    </div>
  )
}

export default function Settings({ org, session, initialSection }) {
  const isMobile = useIsMobile()
  const [showSidebar, setShowSidebar] = useState(false)
  const { refreshOrg } = useOrg()
  const brandingEnabled = org?.branding_enabled !== false
  const [active, setActive] = useState(initialSection || 'organisation')
  const [search, setSearch] = useState('')

  const filtered = NAV.filter(n => (!search || n.label.toLowerCase().includes(search.toLowerCase())) && (!n.requiresBranding || brandingEnabled))
  const groups = GROUPS.map(g => ({ group: g, items: filtered.filter(n => n.group === g) })).filter(g => g.items.length > 0)

  const renderContent = () => {
    switch(active) {
      case 'organisation':   return <OrgSection org={org} />
      case 'branding':       return brandingEnabled ? <BrandingSection org={org} refreshOrg={refreshOrg} /> : (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: '#F8FAFC', borderRadius: 16, border: '1.5px dashed #CBD5E1' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Branding Centre is not enabled</div>
          <div style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>Contact your LaunchSession administrator to enable custom branding for your workspace.</div>
          <a href="mailto:hello@launchsession.co.uk" style={{ padding: '12px 28px', borderRadius: 10, background: '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Contact Support</a>
        </div>
      )
      case 'security':       return <SecuritySection />
      case 'notifications':  return <NotificationsSection />
      case 'integrations':   return <IntegrationsSection />
      case 'billing':        return <BillingSection org={org} />
      case 'registers':      return <GroupsSection org={org} />
      case 'help':           return <HelpSection />
      default:               return <ComingSoon label={NAV.find(n => n.key === active)?.label || active} />
    }
  }

  const current = NAV.find(n => n.key === active)

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* MOBILE NAV TOGGLE */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <button onClick={() => setShowSidebar(!showSidebar)} style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#F9FAFB', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#374151' }}>
            {showSidebar ? '✕ Close' : '☰ Settings'}
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{NAV.find(n => n.key === active)?.icon} {NAV.find(n => n.key === active)?.label}</div>
        </div>
      )}

      {/* SETTINGS SIDEBAR */}
      <div style={{ width: isMobile ? '100%' : 220, background: '#fff', borderRight: isMobile ? 'none' : '1px solid #e5e7eb', borderBottom: isMobile ? '1px solid #e5e7eb' : 'none', display: isMobile ? (showSidebar ? 'flex' : 'none') : 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', maxHeight: isMobile ? 320 : 'none' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>⚙️ Settings</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search settings..."
              style={{ width: '100%', padding: '7px 9px 7px 28px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#F9FAFB' }} />
          </div>
        </div>
        <div style={{ padding: '8px 8px', flex: 1 }}>
          {groups.map(({ group, items }) => (
            <div key={group} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px 4px' }}>{group}</div>
              {items.map(n => (
                <button key={n.key} onClick={() => { setActive(n.key); if (isMobile) setShowSidebar(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: active === n.key ? '#EFF6FF' : 'transparent', color: active === n.key ? '#1D4ED8' : '#374151', fontSize: 13, fontWeight: active === n.key ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 1, transition: 'all 0.1s' }}
                  onMouseEnter={e => { if (active !== n.key) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (active !== n.key) e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ fontSize: 15 }}>{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}>
        <div style={{ maxWidth: 700 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{current?.icon} {current?.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Manage your {current?.label?.toLowerCase()} settings</div>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
