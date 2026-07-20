import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../context/OrgContext'
import OrgSettingsPanel from './OrgSettingsPanel'

// Shown everywhere an org logo would go, whenever the org hasn't set one (or has removed one)
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

const NAV = [
  { key: 'organisation', icon: '🏢', label: 'Organisation', group: 'Platform', requiresAdmin: true },
  { key: 'users',        icon: '👥', label: 'Admin', group: 'Platform' },
  { key: 'branding',     icon: '🎨', label: 'Branding', group: 'Platform', requiresBranding: true },
  { key: 'safeguarding', icon: '🛡', label: 'Safeguarding', group: 'Operations' },
  { key: 'registers',    icon: '📋', label: 'Registers', group: 'Operations' },
  { key: 'sessions',     icon: '📍', label: 'Venues', group: 'Operations' },
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
        <div style={{ width: 56, height: 56, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
          <img src={org?.logo_url || FALLBACK_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14 }} />
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
  const orgId = org?.id
  const [groups, setGroups] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

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

// ─── Colour math (hex <-> rgb <-> hsv, WCAG contrast) ───────────

function hexToRgb(hex) {
  const clean = (hex || '').replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const num = parseInt(full, 16)
  if (isNaN(num) || full.length !== 6) return { r: 0, g: 0, b: 0 }
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}
function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}
function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1)), l2 = relativeLuminance(hexToRgb(hex2))
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}
function contrastGrade(ratio) {
  if (ratio >= 7) return { label: 'AAA', color: '#16A34A', good: true, rank: 3 }
  if (ratio >= 4.5) return { label: 'AA', color: '#16A34A', good: true, rank: 2 }
  if (ratio >= 3) return { label: 'AA Large', color: '#D97706', good: true, rank: 1 }
  return { label: 'Fail', color: '#DC2626', good: false, rank: 0 }
}
// Suggests a secondary/accent pair by rotating hue around the primary colour.
function suggestPalette(hex) {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, v } = rgbToHsv(r, g, b)
  const rot = (deg) => {
    const nh = (h + deg + 360) % 360
    const c = hsvToRgb(nh, Math.min(1, Math.max(s, 0.55)), Math.max(v, 0.7))
    return rgbToHex(c.r, c.g, c.b)
  }
  return { secondary: rot(35), accent: rot(-35) }
}
// Best-effort dominant-colour extraction from an uploaded logo, skipping
// near-white/near-black/low-saturation pixels so it surfaces real brand
// colours rather than background/transparency artifacts.
function extractDominantColors(imgUrl) {
  return new Promise((resolve) => {
    if (!imgUrl) { resolve([]); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 40
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        const counts = {}
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 200) continue
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          if (max > 235 && min > 220) continue // near-white
          if (max < 25) continue // near-black
          if (max - min < 12) continue // low-saturation grey
          const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`
          counts[key] = (counts[key] || 0) + 1
        }
        resolve(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => {
          const [r, g, b] = key.split(',').map(Number)
          return rgbToHex(r, g, b)
        }))
      } catch (e) { resolve([]) }
    }
    img.onerror = () => resolve([])
    img.src = imgUrl
  })
}

// ─── Colour spectrum picker (SV square + hue slider) ───────────

function ColorSpectrumPicker({ hex, onChange }) {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, v } = rgbToHsv(r, g, b)
  const squareRef = useRef(null)
  const hueRef = useRef(null)
  const draggingRef = useRef(null)

  const updateFromSV = (clientX, clientY) => {
    const el = squareRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const c = hsvToRgb(h, x, 1 - y)
    onChange(rgbToHex(c.r, c.g, c.b))
  }
  const updateFromHue = (clientX) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const c = hsvToRgb(x * 360, s || 1, v || 1)
    onChange(rgbToHex(c.r, c.g, c.b))
  }

  useEffect(() => {
    const handleMove = (e) => {
      if (draggingRef.current === 'sv') updateFromSV(e.clientX, e.clientY)
      if (draggingRef.current === 'hue') updateFromHue(e.clientX)
    }
    const handleUp = () => { draggingRef.current = null }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, s, v])

  const pureHueC = hsvToRgb(h, 1, 1)
  const pureHueHex = rgbToHex(pureHueC.r, pureHueC.g, pureHueC.b)

  return (
    <div>
      <div ref={squareRef} onPointerDown={e => { draggingRef.current = 'sv'; updateFromSV(e.clientX, e.clientY) }}
        style={{ position: 'relative', width: '100%', height: 140, borderRadius: 10, cursor: 'crosshair', touchAction: 'none', marginBottom: 10,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${pureHueHex}` }}>
        <div style={{ position: 'absolute', left: `calc(${s * 100}% - 6px)`, top: `calc(${(1 - v) * 100}% - 6px)`, width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
      </div>
      <div ref={hueRef} onPointerDown={e => { draggingRef.current = 'hue'; updateFromHue(e.clientX) }}
        style={{ position: 'relative', width: '100%', height: 14, borderRadius: 99, cursor: 'pointer', touchAction: 'none',
          background: 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)' }}>
        <div style={{ position: 'absolute', left: `calc(${(h / 360) * 100}% - 9px)`, top: -2, width: 18, height: 18, borderRadius: '50%', background: pureHueHex, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

// A labeled colour field: swatch + hex input + contrast rating, expanding
// to a full spectrum picker with recently-used swatches on demand.
function ColorField({ label, hint, value, onChange, contrastAgainst, contrastLabel, recentColors, onCommit, compact }) {
  const [expanded, setExpanded] = useState(false)
  const ratio = contrastAgainst ? contrastRatio(value, contrastAgainst) : null
  const grade = ratio ? contrastGrade(ratio) : null

  if (compact) {
    return (
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setExpanded(x => !x)} style={{ width: 34, height: 34, borderRadius: 9, background: value, border: '1.5px solid rgba(0,0,0,0.08)', cursor: 'pointer', flexShrink: 0 }} />
          <input style={{ ...inp, flex: 1, fontSize: 12.5, padding: '9px 10px' }} value={value} onChange={e => onChange(e.target.value)} onBlur={() => onCommit && onCommit(value)} placeholder="#000000" />
        </div>
        <div style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            <div style={{ marginTop: 10, padding: 12, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <ColorSpectrumPicker hex={value} onChange={onChange} />
              {recentColors?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Recently used</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {recentColors.map(c => (
                      <button key={c} onClick={() => onChange(c)} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: value === c ? '2px solid #111' : '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>{hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setExpanded(x => !x)} style={{ width: 40, height: 40, borderRadius: 10, background: value, border: '1.5px solid rgba(0,0,0,0.08)', cursor: 'pointer', flexShrink: 0 }} />
        <input style={{ ...inp, flex: 1 }} value={value} onChange={e => onChange(e.target.value)} onBlur={() => onCommit && onCommit(value)} placeholder="#000000" />
        {grade && (
          <div title={`Accessibility contrast rating against ${contrastLabel || 'the paired colour'} — this doesn't affect saving.`}
            style={{ fontSize: 11, fontWeight: 800, color: grade.color, background: grade.color + '14', border: `1px solid ${grade.color}30`, borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Contrast {grade.label} · {ratio.toFixed(1)}:1
          </div>
        )}
      </div>
      {grade && !grade.good && (
        <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6, fontWeight: 600 }}>⚠ Low contrast against {contrastLabel || 'the paired colour'} — just a readability tip, this still saves fine.</div>
      )}
      <div style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ marginTop: 10, padding: 12, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <ColorSpectrumPicker hex={value} onChange={onChange} />
            {recentColors?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Recently used</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {recentColors.map(c => (
                    <button key={c} onClick={() => onChange(c)} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: value === c ? '2px solid #111' : '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// A logo/icon upload slot with zoom + reposition sliders once an image is set.
function LogoUploadBox({ label, hint, previewSrc, fallback, transform, onFileChange, onTransformChange, onRemove, boxSize = 84 }) {
  const t = transform || { zoom: 100, x: 0, y: 0 }
  // Scaling around the centre reveals up to (zoom-100)/2 % of extra image on
  // each side — panning further than that would just push the logo off the
  // edge into empty space, so the sliders' range is capped to what zoom
  // actually makes available.
  const maxOffset = Math.max(0, (t.zoom - 100) / 2)
  const clamp = (v) => Math.max(-maxOffset, Math.min(maxOffset, v))

  const handleZoomChange = (zoom) => {
    const newMaxOffset = Math.max(0, (zoom - 100) / 2)
    onTransformChange({
      zoom,
      x: Math.max(-newMaxOffset, Math.min(newMaxOffset, t.x)),
      y: Math.max(-newMaxOffset, Math.min(newMaxOffset, t.y)),
    })
  }

  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10 }}>{hint}</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: boxSize, height: boxSize, borderRadius: 16, background: '#fff', border: '1.5px dashed var(--border2)', overflow: 'hidden', flexShrink: 0 }}>
          <img src={previewSrc || fallback} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `translate(${t.x}%, ${t.y}%) scale(${t.zoom / 100})` }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <label style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
              Upload
              <input type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
            </label>
            {previewSrc && <button onClick={onRemove} style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑</button>}
          </div>
          {previewSrc && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Zoom</div>
              <input type="range" min="100" max="200" value={t.zoom} onChange={e => handleZoomChange(Number(e.target.value))} style={{ width: '100%', marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Horizontal</div>
                  <input type="range" min={-maxOffset} max={maxOffset} disabled={maxOffset === 0} value={clamp(t.x)} onChange={e => onTransformChange({ ...t, x: clamp(Number(e.target.value)) })} style={{ width: '100%', opacity: maxOffset === 0 ? 0.4 : 1 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Vertical</div>
                  <input type="range" min={-maxOffset} max={maxOffset} disabled={maxOffset === 0} value={clamp(t.y)} onChange={e => onTransformChange({ ...t, y: clamp(Number(e.target.value)) })} style={{ width: '100%', opacity: maxOffset === 0 ? 0.4 : 1 }} />
                </div>
              </div>
              {maxOffset === 0 && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>Zoom in first to reposition.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BrandingSection({ org, refreshOrg }) {
  const isMobile = useIsMobile()
  const [name, setName] = useState(org?.name || '')
  const [slogan, setSlogan] = useState(org?.slogan || '')
  const [color, setColor] = useState(org?.primary_color || '#1B9AAA')
  const [secondaryColor, setSecondaryColor] = useState(org?.secondary_color || '#0EA5E9')
  const [accentColor, setAccentColor] = useState(org?.accent_color || '#F59E0B')
  const [backgroundColor, setBackgroundColor] = useState(org?.background_color || '#FFFFFF')
  const [uiDensity, setUiDensity] = useState(org?.ui_density || 'rounded')
  const [welcomeMessage, setWelcomeMessage] = useState(org?.welcome_message || '')
  const [emailFooterText, setEmailFooterText] = useState(org?.email_footer_text || '')
  const [recentColors, setRecentColors] = useState(org?.recent_colors || [])

  const [logoPreview, setLogoPreview] = useState(org?.logo_url || '')
  const [logoFile, setLogoFile] = useState(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [logoTransform, setLogoTransform] = useState(org?.logo_transform || { zoom: 100, x: 0, y: 0 })

  const [iconPreview, setIconPreview] = useState(org?.icon_url || '')
  const [iconFile, setIconFile] = useState(null)
  const [iconRemoved, setIconRemoved] = useState(false)
  const [iconTransform, setIconTransform] = useState(org?.icon_transform || { zoom: 100, x: 0, y: 0 })

  const [loginBgPreview, setLoginBgPreview] = useState(org?.login_background_url || '')
  const [loginBgFile, setLoginBgFile] = useState(null)
  const [loginBgRemoved, setLoginBgRemoved] = useState(false)

  const [emailLogoPreview, setEmailLogoPreview] = useState(org?.email_logo_url || '')
  const [emailLogoFile, setEmailLogoFile] = useState(null)
  const [emailLogoRemoved, setEmailLogoRemoved] = useState(false)

  const [logoSuggestions, setLogoSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [previewTab, setPreviewTab] = useState('workspace')
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [highlightSection, setHighlightSection] = useState(null)
  const [showCompletionDropdown, setShowCompletionDropdown] = useState(false)
  const [showContrastDetails, setShowContrastDetails] = useState(false)
  const previewRef = useRef(null)
  const identityRef = useRef(null)
  const coloursRef = useRef(null)
  const appearanceRef = useRef(null)
  const loginRef = useRef(null)
  const sectionRefs = { identity: identityRef, colours: coloursRef, appearance: appearanceRef, login: loginRef }

  const jumpTo = (key) => {
    sectionRefs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlightSection(key)
    setTimeout(() => setHighlightSection(h => (h === key ? null : h)), 1400)
  }

  // Snapshot of the last-saved state, used purely to detect unsaved changes —
  // so people don't lose work by navigating away without noticing.
  const savedSnapshot = useRef(null)
  const currentSnapshot = () => JSON.stringify({
    name, slogan, color, secondaryColor, accentColor, backgroundColor, uiDensity,
    welcomeMessage, emailFooterText,
    logoPreview, iconPreview, loginBgPreview, emailLogoPreview, logoTransform, iconTransform,
  })
  useEffect(() => {
    if (savedSnapshot.current === null) savedSnapshot.current = currentSnapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const isDirty = savedSnapshot.current !== null && savedSnapshot.current !== currentSnapshot()

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => { if (logoPreview) extractDominantColors(logoPreview).then(setLogoSuggestions) }, [logoPreview])

  const commitRecentColor = (hex) => {
    if (!hex || !/^#[0-9A-Fa-f]{6}$/i.test(hex)) return
    setRecentColors(prev => [hex, ...prev.filter(c => c.toLowerCase() !== hex.toLowerCase())].slice(0, 8))
  }

  const palettes = [
    { name: 'Ocean', color: '#1B9AAA' }, { name: 'Blaze', color: '#FF6B1A' },
    { name: 'Forest', color: '#16A34A' }, { name: 'Violet', color: '#7C3AED' },
    { name: 'Navy', color: '#0B2D5E' }, { name: 'Rose', color: '#E11D48' },
  ]
  const suggested = useMemo(() => suggestPalette(color), [color])

  const handleFileChange = (setPreview, setFile, setRemoved) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFile(file); setPreview(URL.createObjectURL(file)); setRemoved(false)
  }

  async function uploadIfNeeded(file, existingUrl, removed, pathSuffix) {
    if (file) {
      const ext = file.name.split('.').pop()
      const filePath = `${org.id}/${pathSuffix}.${ext}`
      const { error } = await supabase.storage.from('org-logos').upload(filePath, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('org-logos').getPublicUrl(filePath)
        return `${data.publicUrl}?v=${Date.now()}`
      }
      return existingUrl
    }
    if (removed) return null
    return existingUrl
  }

  const completion = useMemo(() => {
    const checks = [
      { done: !!logoPreview, label: 'Upload your logo', section: 'identity' },
      { done: secondaryColor.toUpperCase() !== '#0EA5E9', label: 'Set a secondary colour', section: 'colours' },
      { done: !!accentColor && accentColor.toUpperCase() !== '#F59E0B', label: 'Set an accent colour', section: 'colours' },
      { done: !!slogan, label: 'Add a strapline', section: 'identity' },
      { done: !!welcomeMessage, label: 'Customise your login welcome message', section: 'login' },
      { done: !!emailLogoPreview, label: 'Upload an email logo', section: 'login' },
    ]
    const doneCount = checks.filter(c => c.done).length
    return { pct: Math.round((doneCount / checks.length) * 100), missing: checks.filter(c => !c.done) }
  }, [logoPreview, secondaryColor, accentColor, slogan, welcomeMessage, emailLogoPreview])

  const handleSave = async () => {
    setSaving(true); setSaveError('')
    const [logoUrl, iconUrl, loginBgUrl, emailLogoUrl] = await Promise.all([
      uploadIfNeeded(logoFile, org?.logo_url, logoRemoved, 'logo'),
      uploadIfNeeded(iconFile, org?.icon_url, iconRemoved, 'icon'),
      uploadIfNeeded(loginBgFile, org?.login_background_url, loginBgRemoved, 'login-bg'),
      uploadIfNeeded(emailLogoFile, org?.email_logo_url, emailLogoRemoved, 'email-logo'),
    ])

    const { error } = await supabase.from('organisations').update({
      name, primary_color: color, secondary_color: secondaryColor, accent_color: accentColor,
      background_color: backgroundColor, ui_density: uiDensity,
      slogan, logo_url: logoUrl, icon_url: iconUrl, logo_transform: logoTransform, icon_transform: iconTransform,
      login_background_url: loginBgUrl, welcome_message: welcomeMessage,
      email_logo_url: emailLogoUrl, email_footer_text: emailFooterText, recent_colors: recentColors,
    }).eq('id', org?.id)

    if (error) {
      setSaving(false)
      setSaveError(error.message || 'Something went wrong saving your branding. Please try again.')
      return
    }

    document.documentElement.style.setProperty('--org-primary', color)
    {
      const faviconTarget = iconUrl || logoUrl || FALLBACK_LOGO_URL
      const bustedIcon = faviconTarget + (faviconTarget.includes('?') ? '&' : '?') + 't=' + Date.now()
      const favicon = document.querySelector("link[rel='icon']") || document.createElement('link')
      favicon.rel = 'icon'
      favicon.href = bustedIcon
      document.head.appendChild(favicon)
      // iOS reads apple-touch-icon (not the manifest) for the actual
      // "Add to Home Screen" icon, so it needs the same swap.
      document.querySelectorAll("link[rel='apple-touch-icon']").forEach(el => { el.href = bustedIcon })
    }
    if (refreshOrg) await refreshOrg()
    savedSnapshot.current = currentSnapshot()
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const handleReset = () => {
    setConfirmingReset(false)
    setName(org?.name || '')
    setColor('#1B9AAA'); setSecondaryColor('#0EA5E9'); setAccentColor('#F59E0B'); setBackgroundColor('#FFFFFF')
    setUiDensity('rounded')
    setSlogan(''); setWelcomeMessage(''); setEmailFooterText('')
    setLogoPreview(''); setLogoFile(null); setLogoRemoved(true); setLogoTransform({ zoom: 100, x: 0, y: 0 })
    setIconPreview(''); setIconFile(null); setIconRemoved(true); setIconTransform({ zoom: 100, x: 0, y: 0 })
    setLoginBgPreview(''); setLoginBgFile(null); setLoginBgRemoved(true)
    setEmailLogoPreview(''); setEmailLogoFile(null); setEmailLogoRemoved(true)
  }

  const orgName = name || 'Your Organisation'
  const sectionWrapStyle = (key) => ({ borderRadius: 16, transition: 'box-shadow 0.3s ease', boxShadow: highlightSection === key ? `0 0 0 3px ${color}66` : 'none' })

  const contrastChecks = [
    { label: 'Primary vs white text', ratio: contrastRatio(color, '#FFFFFF') },
    { label: 'Secondary vs white text', ratio: contrastRatio(secondaryColor, '#FFFFFF') },
    { label: 'Accent vs white text', ratio: contrastRatio(accentColor, '#FFFFFF') },
  ].map(c => ({ ...c, grade: contrastGrade(c.ratio) }))
  const worstContrast = contrastChecks.reduce((worst, c) => (c.grade.rank < worst.grade.rank ? c : worst))
  const allContrastGood = contrastChecks.every(c => c.grade.good)

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>Branding Centre</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Shape how {orgName} appears across LaunchSession.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, position: 'relative' }}>
          {isDirty && !saving && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#D97706', background: '#D9770614', border: '1px solid #D9770630', borderRadius: 99, padding: '5px 12px', whiteSpace: 'nowrap' }}>● Unsaved</span>
          )}

          <button onClick={() => setShowCompletionDropdown(x => !x)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>Brand profile <span style={{ color }}>{completion.pct}%</span> complete</div>
              <div style={{ width: 120, height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: `${completion.pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text3)', transform: showCompletionDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
          </button>

          {showCompletionDropdown && (
            <div style={{ position: 'absolute', top: '110%', right: 0, minWidth: 260, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', padding: 12, zIndex: 10 }}>
              {completion.missing.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600, padding: '4px 2px' }}>🎉 Your brand profile is fully set up!</div>
              ) : (
                <>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Still to do</div>
                  {completion.missing.map(m => (
                    <button key={m.label} onClick={() => { jumpTo(m.section); setShowCompletionDropdown(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 8, border: 'none', background: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      + {m.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: saving ? '#9ca3af' : color, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: saving ? 'none' : `0 8px 24px ${color}40`, whiteSpace: 'nowrap' }}>
            {saving ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save changes'}
          </button>
          <button onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>👁 Preview brand</button>
          {confirmingReset ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1.5px solid #FCA5A5', borderRadius: 10, padding: '6px 6px 6px 12px' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Reset to defaults?</span>
              <button onClick={handleReset} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Yes, reset</button>
              <button onClick={() => setConfirmingReset(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingReset(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>↺ Reset to default</button>
          )}
        </div>
      </div>

      {saveError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠ Couldn't save your branding: {saveError}
          <button onClick={handleSave} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)', background: '#fff', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Try again</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <div ref={identityRef} style={sectionWrapStyle('identity')}>
          <SettingCard title="Brand Identity" description="Your name, logo and tagline across LaunchSession.">
            <Field label="Organisation name"><input style={inp} value={name} onChange={e => setName(e.target.value)} /></Field>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
              <LogoUploadBox label="Logo" hint="PNG or SVG, recommended 512×512px, transparent background works best."
                previewSrc={logoPreview} fallback={FALLBACK_LOGO_URL} transform={logoTransform}
                onFileChange={handleFileChange(setLogoPreview, setLogoFile, setLogoRemoved)} onTransformChange={setLogoTransform}
                onRemove={() => { setLogoPreview(''); setLogoFile(null); setLogoRemoved(true) }} boxSize={84} />
              <LogoUploadBox label="Compact icon" hint="Square, ideally 512×512px. It only ever displays at 36–56px in the app (sidebar, browser tab), so this just keeps it sharp on retina screens."
                previewSrc={iconPreview} fallback={logoPreview || FALLBACK_LOGO_URL} transform={iconTransform}
                onFileChange={handleFileChange(setIconPreview, setIconFile, setIconRemoved)} onTransformChange={setIconTransform}
                onRemove={() => { setIconPreview(''); setIconFile(null); setIconRemoved(true) }} boxSize={64} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>ℹ️</span>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
                This icon updates the browser tab and the icon your staff get if they use <strong style={{ color: 'var(--text2)' }}>"Add to Home Screen"</strong> from their phone's browser (this is the recommended way to install LaunchSession). It won't apply if LaunchSession is ever downloaded from the App Store or Google Play in future — store apps ship with one fixed icon for everyone, set at submission time, not per organisation.
              </div>
            </div>
            {logoSuggestions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Colours from your logo</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {logoSuggestions.map(c => (
                    <button key={c} onClick={() => { setColor(c); commitRecentColor(c) }} title={c} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            )}
            <Field label="Strapline" hint={`${slogan.length}/80`}>
              <input style={inp} value={slogan} onChange={e => setSlogan(e.target.value.slice(0, 80))} placeholder="e.g. Sport for every child" maxLength={80} />
            </Field>
          </SettingCard>
          </div>

          <div ref={coloursRef} style={sectionWrapStyle('colours')}>
          <SettingCard title="Brand Colours" description="Choose colours that reflect your brand.">
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
              <ColorField compact label="Primary colour" value={color} onChange={setColor} recentColors={recentColors} onCommit={commitRecentColor} />
              <ColorField compact label="Secondary colour" value={secondaryColor} onChange={setSecondaryColor} recentColors={recentColors} onCommit={commitRecentColor} />
              <ColorField compact label="Accent colour" value={accentColor} onChange={setAccentColor} recentColors={recentColors} onCommit={commitRecentColor} />
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Presets</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {palettes.map(p => (
                <button key={p.color} onClick={() => { setColor(p.color); commitRecentColor(p.color) }} style={{ border: color === p.color ? `2px solid ${p.color}` : '1px solid var(--border)', background: 'var(--surface)', borderRadius: 999, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />{p.name}
                </button>
              ))}
            </div>

            <div style={{ background: allContrastGood ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${allContrastGood ? '#16A34A30' : '#D9770630'}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: allContrastGood ? '#16A34A' : '#D97706', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{allContrastGood ? 'Good contrast' : `Low contrast — ${worstContrast.label}`}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{contrastChecks.map(c => c.grade.label).join(' · ')}</span>
                <button onClick={() => setShowContrastDetails(x => !x)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: color, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  {showContrastDetails ? 'Hide details' : 'View details'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateRows: showContrastDetails ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
                <div style={{ overflow: 'hidden', minHeight: 0 }}>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {contrastChecks.map(c => (
                      <div key={c.label} style={{ fontSize: 11.5, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.label}</span>
                        <span style={{ fontWeight: 700, color: c.grade.color }}>{c.grade.label} · {c.ratio.toFixed(1)}:1</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <ColorField label="Background colour" hint="Page background across the workspace." value={backgroundColor} onChange={setBackgroundColor} contrastAgainst={color} contrastLabel="your primary colour" recentColors={recentColors} onCommit={commitRecentColor} />

            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Suggested accessible combination</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>Based on your primary colour:</span>
                <button onClick={() => { setSecondaryColor(suggested.secondary); setAccentColor(suggested.accent); commitRecentColor(suggested.secondary); commitRecentColor(suggested.accent) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: suggested.secondary }} />
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: suggested.accent }} />
                  Use this pair
                </button>
              </div>
            </div>
          </SettingCard>
          </div>

          <div ref={appearanceRef} style={sectionWrapStyle('appearance')}>
          <SettingCard title="Appearance" description="Choose how LaunchSession looks for your users.">
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Interface style</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ k: 'rounded', i: '◠', l: 'Rounded' }, { k: 'compact', i: '▭', l: 'Compact' }].map(m => (
                <button key={m.k} onClick={() => setUiDensity(m.k)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 10px', borderRadius: 12, border: uiDensity === m.k ? `2px solid ${color}` : '1.5px solid var(--border)', background: uiDensity === m.k ? `${color}10` : 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 18 }}>{m.i}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: uiDensity === m.k ? color : 'var(--text2)' }}>{m.l}</span>
                </button>
              ))}
            </div>
          </SettingCard>
          </div>

          <div ref={loginRef} style={sectionWrapStyle('login')}>
          <SettingCard title="Login & Communications" description="Customise messages and visuals for key touchpoints.">
            <Field label="Login welcome message" hint={`${welcomeMessage.length}/80`}>
              <input style={inp} value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value.slice(0, 80))} placeholder="e.g. Welcome back! Sign in to continue making an impact." maxLength={80} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Login background</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 42, borderRadius: 8, background: loginBgPreview ? `url(${loginBgPreview}) center/cover` : 'linear-gradient(135deg, #0F172A, #1e293b)', border: '1px solid var(--border)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
                      Upload
                      <input type="file" accept="image/*" onChange={handleFileChange(setLoginBgPreview, setLoginBgFile, setLoginBgRemoved)} style={{ display: 'none' }} />
                    </label>
                    {loginBgPreview && <button onClick={() => { setLoginBgPreview(''); setLoginBgFile(null); setLoginBgRemoved(true) }} style={{ padding: '6px 8px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>🗑</button>}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Email header logo</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 8, background: '#fff', border: '1.5px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={emailLogoPreview || logoPreview || FALLBACK_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
                      Upload
                      <input type="file" accept="image/*" onChange={handleFileChange(setEmailLogoPreview, setEmailLogoFile, setEmailLogoRemoved)} style={{ display: 'none' }} />
                    </label>
                    {emailLogoPreview && <button onClick={() => { setEmailLogoPreview(''); setEmailLogoFile(null); setEmailLogoRemoved(true) }} style={{ padding: '6px 8px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>🗑</button>}
                  </div>
                </div>
              </div>
            </div>
            <Field label="Email footer text" hint={`${emailFooterText.length}/80`}>
              <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={emailFooterText} onChange={e => setEmailFooterText(e.target.value.slice(0, 80))} placeholder="e.g. Solidarity Sports · Registered Charity No. 123456" maxLength={80} />
            </Field>
          </SettingCard>
          </div>
        </div>

        <div ref={previewRef} style={{ position: isMobile ? 'static' : 'sticky', top: 16 }}>
          <SettingCard title="Live Preview" description="See how your brand appears across LaunchSession.">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                {[{ key: 'workspace', label: 'Workspace' }, { key: 'login', label: 'Login Screen' }, { key: 'email', label: 'Email' }].map(t => (
                  <button key={t.key} onClick={() => setPreviewTab(t.key)} style={{ padding: '0 0 10px', border: 'none', borderBottom: previewTab === t.key ? `2px solid ${color}` : '2px solid transparent', background: 'none', color: previewTab === t.key ? color : 'var(--text3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: -1 }}>{t.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {['desktop', 'mobile'].map(d => (
                  <button key={d} onClick={() => setPreviewDevice(d)} style={{ padding: '4px 10px', borderRadius: 99, border: `1.5px solid ${previewDevice === d ? color : 'var(--border)'}`, background: previewDevice === d ? `${color}12` : 'var(--surface)', color: previewDevice === d ? color : 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{d === 'desktop' ? '🖥 Desktop' : '📱 Mobile'}</button>
                ))}
              </div>
            </div>

            <div style={{ maxWidth: previewDevice === 'mobile' ? 260 : '100%', margin: previewDevice === 'mobile' ? '0 auto' : 0, transition: 'max-width 0.2s' }}>
              {previewTab === 'workspace' && (
                <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB', display: 'flex', height: 320, background: backgroundColor || '#F8FAFC' }}>
                  {previewDevice === 'desktop' && (
                    <div style={{ width: 56, background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, gap: 14, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fff', overflow: 'hidden' }}><img src={iconPreview || logoPreview || FALLBACK_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
                      {['🏠', '📅', '📋', '👥', '📊'].map((ic, i) => (
                        <div key={i} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: i === 0 ? color : 'transparent', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.4)' }}>{ic}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, overflow: 'hidden' }}><img src={logoPreview || FALLBACK_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#111827' }}>{orgName}</div>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <div style={{ fontSize: 13 }}>🔔</div>
                        <div style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: accentColor }} />
                      </div>
                    </div>
                    <div style={{ padding: 12, flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 6, fontWeight: 700 }}>{slogan || 'Your tagline here'}</div>
                      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: uiDensity === 'compact' ? 4 : 12, padding: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#111827' }}>Football Skills Session</div>
                          <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', background: color, borderRadius: 99, padding: '2px 6px' }}>LIVE</span>
                        </div>
                        <div style={{ fontSize: 9, color: '#6B7280' }}>12 signed in · Main Hall</div>
                      </div>
                      <button style={{ width: '100%', border: 'none', borderRadius: uiDensity === 'compact' ? 4 : 8, padding: 9, background: `linear-gradient(135deg, ${color}, ${secondaryColor})`, color: '#fff', fontWeight: 700, fontSize: 11 }}>Primary Action</button>
                      <div style={{ textAlign: 'center', fontSize: 9, color: '#9CA3AF', marginTop: 10 }}>Powered by LaunchSession</div>
                    </div>
                  </div>
                </div>
              )}

              {previewTab === 'login' && (
                <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB', background: loginBgPreview ? `url(${loginBgPreview}) center/cover` : '#060B18', padding: '32px 20px', textAlign: 'center', minHeight: 320 }}>
                  <div style={{ width: 56, height: 56, borderRadius: uiDensity === 'compact' ? 6 : 14, margin: '0 auto 14px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 8px 24px ${color}40` }}>
                    <img src={iconPreview || logoPreview || FALLBACK_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{orgName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{slogan || 'Your tagline here'}</div>
                  {welcomeMessage && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 16, fontStyle: 'italic' }}>{welcomeMessage}</div>}
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${color}30`, borderRadius: uiDensity === 'compact' ? 6 : 14, padding: 18, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Sign in to {orgName}</div>
                    <div style={{ height: 30, borderRadius: uiDensity === 'compact' ? 4 : 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 10 }} />
                    <div style={{ height: 30, borderRadius: uiDensity === 'compact' ? 4 : 8, background: `linear-gradient(135deg, ${color}, ${secondaryColor})` }} />
                  </div>
                </div>
              )}

              {previewTab === 'email' && (
                <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB', background: '#F1F5F9', padding: 16, minHeight: 320 }}>
                  <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                    <div style={{ background: `linear-gradient(135deg, ${color}, ${secondaryColor})`, padding: '20px 16px', textAlign: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, margin: '0 auto 8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src={emailLogoPreview || logoPreview || FALLBACK_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{orgName}</div>
                    </div>
                    <div style={{ padding: 16, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Welcome to {orgName}!</div>
                      <div style={{ fontSize: 10.5, color: '#6B7280', marginBottom: 14, lineHeight: 1.5 }}>You're all set to sign in and get started.</div>
                      <div style={{ display: 'inline-block', padding: '8px 18px', borderRadius: uiDensity === 'compact' ? 4 : 8, background: color, color: '#fff', fontWeight: 700, fontSize: 11 }}>Get Started</div>
                    </div>
                    <div style={{ borderTop: '1px solid #F1F5F9', padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#9CA3AF' }}>{emailFooterText || `${orgName} · Powered by LaunchSession`}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SettingCard>

          {completion.missing.length > 0 ? (
            <div style={{ background: `linear-gradient(135deg, ${color}12, ${secondaryColor}12)`, border: `1px solid ${color}30`, borderRadius: 14, padding: 16, marginTop: 16, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>📋</div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color }}>Complete your brand profile</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, marginBottom: 8, lineHeight: 1.5 }}>A few items are missing before your brand is complete.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {completion.missing.slice(0, 3).map(m => (
                    <div key={m.label} style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>● {m.label}</div>
                  ))}
                  {completion.missing.length > 3 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>and {completion.missing.length - 3} more...</div>
                  )}
                </div>
              </div>
              <button onClick={() => jumpTo(completion.missing[0].section)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: color, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Go to missing items</button>
            </div>
          ) : (
            <div style={{ background: `linear-gradient(135deg, ${color}12, ${secondaryColor}12)`, border: `1px solid ${color}30`, borderRadius: 14, padding: 16, marginTop: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>🎉</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color }}>Your brand profile is complete</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>A consistent brand builds confidence with parents, volunteers and partners.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ModulePasswordCard({ moduleKey, label, icon, accentColor }) {
  const isMobile = useIsMobile()
  const [pwStatus, setPwStatus] = useState('loading') // loading | set | unset
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.rpc(`${moduleKey}_password_status`).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setPwStatus('unset'); return }
      setPwStatus(data ? 'set' : 'unset')
    })
    return () => { cancelled = true }
  }, [moduleKey])

  const handleSetPassword = async () => {
    setPwError('')
    if (newPw.length < 4) { setPwError('Password must be at least 4 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    const { error } = await supabase.rpc(`set_${moduleKey}_password`, { new_password: newPw })
    setPwSaving(false)
    if (error) { setPwError(error.message || 'Could not save password.'); return }
    setPwStatus('set')
    setNewPw(''); setConfirmPw('')
    setPwSaved(true); setTimeout(() => setPwSaved(false), 2500)
  }

  const handleRemovePassword = async () => {
    if (!window.confirm(`Remove the ${label} access password? Anyone in your organisation will be able to open ${label} without a password.`)) return
    setRemoving(true)
    const { error } = await supabase.rpc(`clear_${moduleKey}_password`)
    setRemoving(false)
    if (error) { setPwError(error.message || 'Could not remove password.'); return }
    setPwStatus('unset')
  }

  return (
    <SettingCard title={`${icon} ${label} Access Password`} description={`Require a password before anyone — including staff — can open ${label}. Only admins can set or change it.`}>
      {pwStatus === 'loading' ? (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
      ) : (
        <>
          {pwStatus === 'set' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${accentColor}14`, border: `1px solid ${accentColor}40`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Password protection is currently ON</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Field label={pwStatus === 'set' ? 'New Password' : 'Password'}>
              <input type="password" style={inp} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 4 characters" />
            </Field>
            <Field label="Confirm Password">
              <input type="password" style={inp} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat password" />
            </Field>
          </div>
          {pwError && <div style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600, marginBottom: 12 }}>{pwError}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleSetPassword} disabled={pwSaving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: pwSaving ? '#9ca3af' : accentColor, color: '#fff', fontSize: 14, fontWeight: 700, cursor: pwSaving ? 'default' : 'pointer' }}>
              {pwSaving ? 'Saving...' : pwSaved ? '✓ Saved!' : pwStatus === 'set' ? 'Update Password' : 'Set Password'}
            </button>
            {pwStatus === 'set' && (
              <button onClick={handleRemovePassword} disabled={removing} style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 14, fontWeight: 700, cursor: removing ? 'default' : 'pointer' }}>
                {removing ? 'Removing...' : 'Remove Password'}
              </button>
            )}
          </div>
        </>
      )}
    </SettingCard>
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
      <ModulePasswordCard moduleKey="safeguarding" label="Safeguarding" icon="🛡" accentColor="#DC2626" />
      <ModulePasswordCard moduleKey="fundraising" label="Fundraising Hub" icon="💷" accentColor="#6647F0" />
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

const PLAN_DETAILS = [
  { key: 'starter', label: 'Starter', price: '£29/mo', blurb: 'For a single site getting started' },
  { key: 'pro', label: 'Pro', price: '£79/mo', blurb: 'For growing organisations with multiple sessions' },
  { key: 'enterprise', label: 'Enterprise', price: 'Contact us', blurb: 'For large or multi-site organisations' },
]

const STATUS_STYLE = {
  active:    { bg: '#DCFCE7', color: '#15803D', label: '● Active' },
  trialing:  { bg: '#DBEAFE', color: '#1D4ED8', label: '● Trial' },
  past_due:  { bg: '#FEF3C7', color: '#B45309', label: '● Payment overdue' },
  canceled:  { bg: '#FEE2E2', color: '#B91C1C', label: '● Canceled' },
  incomplete:{ bg: '#FEE2E2', color: '#B91C1C', label: '● Incomplete' },
}

function BillingSection({ org, session, isAdmin, refreshOrg }) {
  const [loadingPlan, setLoadingPlan] = useState(null) // which plan button is spinning
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')

  const status = org?.subscription_status
  const statusStyle = STATUS_STYLE[status] || { bg: '#F1F5F9', color: '#475569', label: status ? `● ${status}` : '● No active subscription' }

  const handleUpgrade = async (plan) => {
    setError('')
    setLoadingPlan(plan)
    try {
      const { data: { session: liveSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${liveSession?.access_token}` },
        body: JSON.stringify({ org_id: org.id, plan }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      window.location.href = json.url
    } catch (err) {
      setError(err.message || 'Failed to start checkout')
      setLoadingPlan(null)
    }
  }

  const handleManageBilling = async () => {
    setError('')
    setPortalLoading(true)
    try {
      const { data: { session: liveSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${liveSession?.access_token}` },
        body: JSON.stringify({ org_id: org.id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      window.location.href = json.url
    } catch (err) {
      setError(err.message || 'Failed to open billing portal')
      setPortalLoading(false)
    }
  }

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success' && refreshOrg) {
      refreshOrg()
    }
  }, [refreshOrg])

  return (
    <div>
      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>
      )}

      <SettingCard title="Current Plan">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', textTransform: 'capitalize' }}>{org?.plan || 'Starter'}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              {org?.current_period_end
                ? `Renews ${new Date(org.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'No billing history yet'}
            </div>
          </div>
          <span style={{ background: statusStyle.bg, color: statusStyle.color, borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>{statusStyle.label}</span>
        </div>

        {isAdmin && org?.stripe_customer_id && (
          <button onClick={handleManageBilling} disabled={portalLoading}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {portalLoading ? 'Opening...' : 'Manage Billing'}
          </button>
        )}
      </SettingCard>

      {isAdmin && (
        <SettingCard title="Plans" description="Upgrade or change your organisation's plan">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {PLAN_DETAILS.map(p => {
              const isCurrent = (org?.plan || 'starter') === p.key
              return (
                <div key={p.key} style={{ border: isCurrent ? '2px solid #1B9AAA' : '1.5px solid var(--border)', borderRadius: 14, padding: '18px 16px', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{p.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '4px 0' }}>{p.price}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, minHeight: 32 }}>{p.blurb}</div>
                  {isCurrent ? (
                    <div style={{ textAlign: 'center', padding: '9px 0', borderRadius: 8, background: '#DCFCE7', color: '#15803D', fontWeight: 700, fontSize: 13 }}>Current Plan</div>
                  ) : p.key === 'enterprise' ? (
                    <a href="mailto:hello@launchsession.co.uk?subject=Enterprise%20Plan" style={{ display: 'block', textAlign: 'center', padding: '9px 0', borderRadius: 8, border: 'none', background: '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Contact Us</a>
                  ) : (
                    <button onClick={() => handleUpgrade(p.key)} disabled={loadingPlan === p.key}
                      style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: loadingPlan === p.key ? '#9ca3af' : '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {loadingPlan === p.key ? 'Redirecting...' : 'Upgrade'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </SettingCard>
      )}

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

function SafeguardingSection({ org }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    dsl_name: org?.dsl_name || '',
    dsl_phone: org?.dsl_phone || '',
    dsl_email: org?.dsl_email || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [policyUrl, setPolicyUrl] = useState(org?.safeguarding_policy_url || '')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [reviewFreq, setReviewFreq] = useState(org?.safeguarding_review_freq || 'annually')
  const [alerts, setAlerts] = useState({ new_concern: true, dsl_only: false, ...(org?.safeguarding_alert_prefs || {}) })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('organisations').update({
      dsl_name: form.dsl_name || null,
      dsl_phone: form.dsl_phone || null,
      dsl_email: form.dsl_email || null,
    }).eq('id', org?.id)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const handlePolicyUpload = async (file) => {
    if (!file) return
    setUploadErr(''); setUploading(true)
    const path = `${org.id}/safeguarding-policy_${Date.now()}.${file.name.split('.').pop()}`
    const { error: upErr } = await supabase.storage.from('safeguarding-docs').upload(path, file)
    if (upErr) { setUploadErr(upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('safeguarding-docs').getPublicUrl(path)
    await supabase.from('organisations').update({ safeguarding_policy_url: publicUrl }).eq('id', org?.id)
    setPolicyUrl(publicUrl)
    setUploading(false)
  }

  return (
    <div>
      {/* Header banner */}
      <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', borderRadius: 12, padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🛡️</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Safeguarding Settings</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Configure your DSL contact, policy documents and alert preferences.</div>
        </div>
      </div>

      {/* DSL Contact */}
      <SettingCard title="Designated Safeguarding Lead (DSL)" description="This contact is shown to staff in the Safeguarding dashboard sidebar and on emergency guidance screens.">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="DSL Full Name">
            <input style={inp} value={form.dsl_name} onChange={e => set('dsl_name', e.target.value)} placeholder="e.g. Sarah Johnson" />
          </Field>
          <Field label="DSL Phone Number" hint="Staff can tap to call directly from the dashboard.">
            <input style={inp} type="tel" value={form.dsl_phone} onChange={e => set('dsl_phone', e.target.value)} placeholder="e.g. 07700 900 000" />
          </Field>
        </div>
        <Field label="DSL Email Address">
          <input style={inp} type="email" value={form.dsl_email} onChange={e => set('dsl_email', e.target.value)} placeholder="dsl@yourorg.org.uk" />
        </Field>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#DC2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save DSL Details'}
        </button>
      </SettingCard>

      {/* Safeguarding Policy */}
      <SettingCard title="Safeguarding Policy Document" description="Upload your organisation's safeguarding policy. Staff can access it directly from the dashboard.">
        {policyUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(220,38,38,0.06)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(220,38,38,0.15)', marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Policy document uploaded</div>
              <a href={policyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, textDecoration: 'none' }}>View / Download ↗</a>
            </div>
            <button onClick={() => setPolicyUrl('')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
          </div>
        ) : (
          <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No policy uploaded yet</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>PDF or Word document</div>
            <label style={{ padding: '9px 20px', borderRadius: 8, background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-block' }}>
              {uploading ? 'Uploading...' : 'Upload Policy'}
              <input type="file" hidden accept=".pdf,.doc,.docx" onChange={e => handlePolicyUpload(e.target.files[0])} disabled={uploading} />
            </label>
            {uploadErr && <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{uploadErr}</div>}
          </div>
        )}
        {policyUrl && (
          <label style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--surface2)', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-block' }}>
            {uploading ? 'Uploading...' : 'Replace document'}
            <input type="file" hidden accept=".pdf,.doc,.docx" onChange={e => handlePolicyUpload(e.target.files[0])} disabled={uploading} />
          </label>
        )}
      </SettingCard>

      {/* Review cycle */}
      <SettingCard title="Policy Review Cycle" description="How often your safeguarding policy and procedures are formally reviewed.">
        <Field label="Review frequency">
          <select style={{ ...inp, maxWidth: 280 }} value={reviewFreq} onChange={e => setReviewFreq(e.target.value)}>
            <option value="termly">Termly (3× per year)</option>
            <option value="biannually">Bi-annually (2× per year)</option>
            <option value="annually">Annually (recommended minimum)</option>
            <option value="custom">Custom / as needed</option>
          </select>
        </Field>
        <div style={{ fontSize: 12, color: 'var(--text3)', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          ⚠️ Ofsted and the NSPCC recommend reviewing safeguarding policies at least annually, or following any concern or legislative change.
        </div>
      </SettingCard>

      {/* Alert preferences */}
      <SettingCard title="Alert Preferences" description="Who gets notified when a new cause for concern is submitted.">
        <Toggle value={alerts.new_concern} onChange={v => setAlerts(a => ({ ...a, new_concern: v }))} label="🛡 Notify all admins when a new concern is submitted" />
        <Toggle value={alerts.dsl_only} onChange={v => setAlerts(a => ({ ...a, dsl_only: v }))} label="📧 Send concern summary email to DSL only" />
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>Email notification settings require your DSL email address to be set above.</div>
      </SettingCard>

      {/* Emergency contacts reference */}
      <SettingCard title="Emergency Reference Numbers" description="These are shown to all staff in the Safeguarding dashboard. They cannot be edited.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['Emergency services', '999'],
            ['NSPCC Helpline', '0808 800 5000'],
            ['Police (non-emergency)', '101'],
            ['Childline', '0800 1111'],
            ['LADO referral', 'via your Local Authority'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
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

function VenuesSection({ org, isAdmin }) {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const emptyForm = { name: '', address: '', capacity: '', default_meeting_point: '', notes: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (org?.id) loadVenues() }, [org?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVenues() {
    setLoading(true)
    const { data, error } = await supabase.from('venues').select('*').eq('org_id', org.id).order('name')
    if (!error) setVenues(data || [])
    setLoading(false)
  }

  function startAdd() { setForm(emptyForm); setEditingId(null); setAdding(true) }
  function startEdit(v) {
    setForm({ name: v.name, address: v.address || '', capacity: v.capacity || '', default_meeting_point: v.default_meeting_point || '', notes: v.notes || '' })
    setEditingId(v.id); setAdding(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Venue name is required.'); return }
    setSaving(true); setError('')
    const payload = {
      org_id: org.id,
      name: form.name.trim(),
      address: form.address.trim() || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      default_meeting_point: form.default_meeting_point.trim() || null,
      notes: form.notes.trim() || null,
    }
    const { error } = editingId
      ? await supabase.from('venues').update(payload).eq('id', editingId)
      : await supabase.from('venues').insert(payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    setAdding(false); setEditingId(null); setForm(emptyForm)
    loadVenues()
  }

  async function toggleActive(v) {
    await supabase.from('venues').update({ is_active: !v.is_active }).eq('id', v.id)
    loadVenues()
  }

  async function handleDelete(v) {
    if (!window.confirm(`Remove "${v.name}"? Past sessions keep their record of it, but it won't be selectable for new sessions.`)) return
    const { error } = await supabase.from('venues').delete().eq('id', v.id)
    if (error) { setError(error.message); return }
    loadVenues()
  }

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #0A0F1E, #1a2744)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 32 }}>📍</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Venues</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>The physical locations sessions run at — pick from these instead of retyping an address every time</div>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{error}</div>}

      <SettingCard title="Your venues" description="Add every regular site your sessions take place at">
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading...</div>
        ) : venues.length === 0 && !adding ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No venues yet — add your first one below.</div>
        ) : (
          venues.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6', opacity: v.is_active ? 1 : 0.5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {v.name} {!v.is_active && <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginLeft: 6 }}>INACTIVE</span>}
                </div>
                {v.address && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{v.address}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12 }}>
                  {v.capacity && <span>👥 Capacity {v.capacity}</span>}
                  {v.default_meeting_point && <span>📍 Meet at {v.default_meeting_point}</span>}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => startEdit(v)} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => toggleActive(v)} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{v.is_active ? 'Deactivate' : 'Reactivate'}</button>
                  <button onClick={() => handleDelete(v)} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                </div>
              )}
            </div>
          ))
        )}

        {isAdmin && !adding && (
          <button onClick={startAdd} style={{ marginTop: 14, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add Venue</button>
        )}

        {isAdmin && adding && (
          <div style={{ marginTop: 16, padding: 16, background: '#F8FAFC', borderRadius: 10, border: '1px solid var(--border)' }}>
            <Field label="Venue name *"><input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cassiobury Park Sports Hall" /></Field>
            <Field label="Address"><input style={inp} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, town, postcode" /></Field>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Capacity"><input style={inp} type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 40" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Default meeting point"><input style={inp} value={form.default_meeting_point} onChange={e => setForm({ ...form, default_meeting_point: e.target.value })} placeholder="e.g. Main entrance" /></Field></div>
            </div>
            <Field label="Notes" hint="Access codes, parking, anything staff should know"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Venue')}</button>
              <button onClick={() => { setAdding(false); setEditingId(null); setError('') }} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </SettingCard>
    </div>
  )
}

const ROLE_CONFIG = {
  admin:     { label: 'Admin',     color: '#7C3AED', bg: '#F3E8FF' },
  staff:     { label: 'Staff',     color: '#2563EB', bg: '#DBEAFE' },
  volunteer: { label: 'Volunteer', color: '#059669', bg: '#D1FAE5' },
}

function UsersSection({ org, session, isAdmin, currentUserId }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const loadUsers = React.useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    try {
      const { data, error: err } = await supabase.from('user_profiles').select('*').eq('org_id', org.id).order('created_at', { ascending: true })
      if (err) throw err
      setUsers(data || [])
    } catch (e) {
      setError(e.message || 'Failed to load users')
    }
    setLoading(false)
  }, [org?.id])

  React.useEffect(() => { loadUsers() }, [loadUsers])

  const handleRoleChange = async (userId, newRole) => {
    setBusyId(userId)
    try {
      const { error: err } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId)
      if (err) throw err
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (e) {
      setError(e.message || 'Failed to update role')
    }
    setBusyId(null)
  }

  const handleRemove = async (user) => {
    if (user.id === currentUserId) { setError("You can't remove your own account."); return }
    if (!window.confirm(`Remove ${user.full_name || user.email} from ${org?.name}? They will lose access immediately.`)) return
    setBusyId(user.id)
    try {
      const { error: err } = await supabase.from('user_profiles').delete().eq('id', user.id)
      if (err) throw err
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (e) {
      setError(e.message || 'Failed to remove user')
    }
    setBusyId(null)
  }

  const admins = users.filter(u => u.role === 'admin')
  const others = users.filter(u => u.role !== 'admin')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>👥 Admin</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Manage who has access to {org?.name || 'your organisation'} and what they can do.</div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: org?.primary_color || '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Invite Person
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, fontWeight: 600 }}>⚠️ {error}</div>
      )}

      {/* Admins */}
      <SettingCard title={`Admin accounts (${admins.length})`} description="Full access to organisation settings, branding, billing, and user management">
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
        ) : admins.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>No admin accounts yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {admins.map(u => (
              <UserRow key={u.id} user={u} isAdmin={isAdmin} isSelf={u.id === currentUserId} busy={busyId === u.id}
                onRoleChange={handleRoleChange} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </SettingCard>

      {/* Everyone else */}
      <SettingCard title={`Staff & Volunteers (${others.length})`} description="Day-to-day access without organisation-level settings">
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
        ) : others.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>No other accounts yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {others.map(u => (
              <UserRow key={u.id} user={u} isAdmin={isAdmin} isSelf={u.id === currentUserId} busy={busyId === u.id}
                onRoleChange={handleRoleChange} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </SettingCard>

      {showInvite && (
        <InviteUserModal org={org} session={session} onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); loadUsers() }} />
      )}
    </div>
  )
}

function UserRow({ user, isAdmin, isSelf, busy, onRoleChange, onRemove }) {
  const rc = ROLE_CONFIG[user.role] || ROLE_CONFIG.volunteer
  const initials = (user.full_name || user.email || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: rc.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, overflow: 'hidden' }}>
        {user.photo_url ? <img src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {user.full_name || user.email}
          {isSelf && <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>(you)</span>}
          {user.status === 'pending_invite' && <span style={{ fontSize: 9, fontWeight: 800, color: '#D97706', background: '#FEF3C7', borderRadius: 99, padding: '1px 7px' }}>PENDING</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user.email}</div>
      </div>
      {isAdmin ? (
        <select value={user.role} disabled={busy || isSelf} onChange={e => onRoleChange(user.id, e.target.value)}
          style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: isSelf ? 'default' : 'pointer' }}>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="volunteer">Volunteer</option>
        </select>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 800, color: rc.color, background: rc.bg, borderRadius: 99, padding: '4px 10px' }}>{rc.label}</span>
      )}
      {isAdmin && (
        <button onClick={() => onRemove(user)} disabled={busy || isSelf} title={isSelf ? "You can't remove yourself" : 'Remove'}
          style={{ border: 'none', background: 'none', cursor: isSelf ? 'default' : 'pointer', fontSize: 14, opacity: isSelf ? 0.3 : 0.7, padding: 4 }}>
          🗑️
        </button>
      )}
    </div>
  )
}

function InviteUserModal({ org, session, onClose, onInvited }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('staff')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleInvite = async () => {
    if (!email.trim()) { setError('Enter an email address.'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/invite-volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), org_id: org.id, org_slug: org.slug, role }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onInvited()
    } catch (e) {
      setError(e.message || 'Failed to send invite')
    }
    setSending(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>Invite to {org?.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>They'll get a branded email with a link to set up their account.</div>

        {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, fontWeight: 600 }}>⚠️ {error}</div>}

        <Field label="Full Name"><input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" /></Field>
        <Field label="Email"><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" /></Field>
        <Field label="Role">
          <select style={inp} value={role} onChange={e => setRole(e.target.value)}>
            <option value="admin">Admin — full access</option>
            <option value="staff">Staff — day-to-day access</option>
            <option value="volunteer">Volunteer — limited access</option>
          </select>
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleInvite} disabled={sending} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: sending ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings({ org, session, userProfile, initialSection }) {
  const isMobile = useIsMobile()
  const [showSidebar, setShowSidebar] = useState(false)
  const { refreshOrg } = useOrg()
  const brandingEnabled = org?.branding_enabled !== false
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'owner'
  const [active, setActive] = useState((initialSection === 'organisation' && !isAdmin) ? 'users' : (initialSection || (isAdmin ? 'organisation' : 'users')))
  const [search, setSearch] = useState('')

  const filtered = NAV.filter(n => (!search || n.label.toLowerCase().includes(search.toLowerCase())) && (!n.requiresBranding || brandingEnabled) && (!n.requiresAdmin || isAdmin))
  const groups = GROUPS.map(g => ({ group: g, items: filtered.filter(n => n.group === g) })).filter(g => g.items.length > 0)

  const renderContent = () => {
    switch(active) {
      case 'organisation':   return isAdmin ? <OrgSection org={org} /> : (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: '#F8FAFC', borderRadius: 16, border: '1.5px dashed #CBD5E1' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Admins only</div>
          <div style={{ fontSize: 14, color: '#64748B' }}>Organisation settings can only be changed by an admin. Ask your organisation's admin if you need something updated here.</div>
        </div>
      )
      case 'branding':       return brandingEnabled ? <BrandingSection org={org} refreshOrg={refreshOrg} /> : (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: '#F8FAFC', borderRadius: 16, border: '1.5px dashed #CBD5E1' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Branding Centre is not enabled</div>
          <div style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>Contact your LaunchSession administrator to enable custom branding for your workspace.</div>
          <a href="mailto:hello@launchsession.co.uk" style={{ padding: '12px 28px', borderRadius: 10, background: '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Contact Support</a>
        </div>
      )
      case 'users':           return <UsersSection org={org} session={session} isAdmin={isAdmin} currentUserId={session?.user?.id} />
      case 'security':       return <SecuritySection />
      case 'notifications':  return <NotificationsSection />
      case 'integrations':   return <IntegrationsSection />
      case 'billing':        return <BillingSection org={org} session={session} isAdmin={isAdmin} refreshOrg={refreshOrg} />
      case 'registers':      return <GroupsSection org={org} />
      case 'sessions':       return <VenuesSection org={org} isAdmin={isAdmin} />
      case 'safeguarding':   return <SafeguardingSection org={org} />
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
      <div style={{ width: isMobile ? '100%' : 190, background: '#fff', borderRight: isMobile ? 'none' : '1px solid #e5e7eb', borderBottom: isMobile ? '1px solid #e5e7eb' : 'none', display: isMobile ? (showSidebar ? 'flex' : 'none') : 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', maxHeight: isMobile ? 320 : 'none' }}>
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
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: active === n.key ? `${org?.primary_color || '#1B9AAA'}12` : 'transparent', color: active === n.key ? (org?.primary_color || '#1B9AAA') : '#374151', fontSize: 13, fontWeight: active === n.key ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 1, transition: 'all 0.1s' }}
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
        <div style={{ maxWidth: active === 'branding' ? 'none' : 700 }}>
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

