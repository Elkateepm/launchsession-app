import React, { useState, useEffect } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabase } from '../../lib/supabase'
import { useOrg, useTerms } from '../../context/OrgContext'
import { HIDEABLE_ITEMS } from '../dashboard/sidebar/navConfig'
import { makeHasModule, trialDaysRemaining, isPlanEnded, ACCESS_MODULES } from '../../lib/moduleAccess'
import OrgSettingsPanel from './OrgSettingsPanel'
import AccessSection from './AccessSection'
import {
  isPushSupported, getNotificationPermission, subscribeToPush, unsubscribeFromPush,
  getCurrentSubscription, listMySubscriptions, revokeSubscriptionById, sendTestNotification,
} from '../../services/pushNotifications'
import { hasPlatformAuthenticator, enrolBiometric, clearEnrolment, isEnrolledFor, getLockAfterMs, setLockAfterMs, isAppLockPlatform } from '../../lib/biometricLock'
import { getTerms } from '../../lib/terminology'
import SignedImg from '../shared/SignedImg'
import { signOne } from '../../lib/storageUrl'
import Icon from '../../lib/icons'
import BrandingCentre from './branding/BrandingCentre'

// Shown everywhere an org logo would go, whenever the org hasn't set one (or has removed one)
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

const NAV = [
  { key: 'organisation', icon: '🏢', label: 'Organisation', group: 'Platform', requiresAdmin: true },
  { key: 'users',        icon: '👥', label: 'Admin', group: 'Platform' },
  { key: 'branding',     icon: '🎨', label: 'Branding', group: 'Platform', requiresBranding: true, requiresAdmin: true },
  { key: 'display',      icon: '🖥', label: 'Display', group: 'Platform', requiresAdmin: true },
  { key: 'access',       icon: '🔑', label: 'Role Access', group: 'Platform', requiresAdmin: true },
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

const BRANDING_PREMIUM_FEATURES = [
  ['Workspace identity', 'Logo, app icon, colours, type and interface feel across the team app.'],
  ['First impression', 'A branded sign-in screen and welcome message before staff reach Home.'],
  ['External communications', 'Email sender, footer and logo controls for supported messages.'],
  ['Brand handover', 'Downloadable brand guide for designers, funders and communications teams.'],
]

function SettingCard({ title, description, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? '#1B9AAA' : '#D1D5DB', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  )
}

// ─── SECTIONS ─────────────────────────────────────────────────

// Changing organisation type changes what the app calls things, so the control
// shows the effect before it's applied rather than after. Modules are opt-in on
// change: once someone has configured their sidebar, silently adding and
// removing modules because they corrected their type would be jarring.
const ORG_TYPE_OPTIONS = [
  { key: 'charity', label: 'Charity' },
  { key: 'sports_club', label: 'Sports Club' },
  { key: 'community_centre', label: 'Community Centre' },
  { key: 'after_school', label: 'After-School Club' },
  { key: 'youth_club', label: 'Youth Club' },
  { key: 'faith_community', label: 'Faith or Community Group' },
  { key: 'holiday_club', label: 'Holiday Club' },
  { key: 'mentoring', label: 'Mentoring Programme' },
  { key: 'education', label: 'Education Provider' },
  { key: 'local_authority', label: 'Local Authority' },
  { key: 'social_enterprise', label: 'Social Enterprise' },
  { key: 'other', label: 'Other' },
]

// ── DISPLAY ───────────────────────────────────────────────────────────────
// What the organisation sees, as opposed to what it has. Modules decide what an
// organisation may open; this decides what it wants shown, and the two are kept
// apart on purpose -- "we don't run mentoring" and "mentoring is not on our
// plan" are different sentences, and collapsing them would make switching a tab
// back on look like a purchase.
function SidebarDisplayCard({ org, isAdmin }) {
  const { refreshOrg } = useOrg()
  const terms = useTerms()
  const hasModule = makeHasModule(org)
  const [hidden, setHidden] = useState(org?.hidden_nav_items || [])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setHidden(org?.hidden_nav_items || []) }, [org?.hidden_nav_items])

  const labelFor = (item) => item.label || terms[item.termKey] || item.id

  // Only offer what this organisation would otherwise see. A row for a module
  // it has not got is a switch with nothing behind it.
  const groups = HIDEABLE_ITEMS
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        if (i.adminOnly && !isAdmin) return false
        if (i.moduleKey && !hasModule(i.moduleKey)) return false
        return true
      }),
    }))
    .filter(g => g.items.length > 0)

  const isOn = (id) => !hidden.includes(id)
  const toggle = (id) => setHidden(h => (h.includes(id) ? h.filter(x => x !== id) : [...h, id]))

  const dirty = JSON.stringify([...hidden].sort()) !== JSON.stringify([...(org?.hidden_nav_items || [])].sort())
  const offCount = hidden.length

  const save = async () => {
    setSaving(true); setMsg('')
    const { error } = await supabase.from('organisations')
      .update({ hidden_nav_items: hidden }).eq('id', org?.id)
    setSaving(false)
    if (error) { setMsg('Could not save: ' + error.message); return }
    setMsg('✅ Saved. The sidebar updates for everyone in your organisation.')
    if (refreshOrg) refreshOrg()
  }

  return (
    <SettingCard
      title="Sidebar"
      description="Turn off the areas your organisation does not use. This changes the sidebar for everyone here, and nothing is deleted — switch one back on and it returns with its data untouched."
    >
      {groups.map(g => (
        <div key={g.group} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{g.group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.items.map(item => {
              const on = isOn(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  role="switch"
                  aria-checked={on}
                  aria-label={labelFor(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%', minHeight: 46,
                    padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    fontFamily: 'inherit', opacity: on ? 1 : 0.55,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 15, display: 'inline-flex', color: 'var(--text2)' }}>
                    <Icon name={item.icon} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                    {labelFor(item)}
                  </span>
                  {/* Reads as a state, not a verb: the row says whether the tab
                      is shown, rather than what tapping it will do. */}
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: on ? '#16A34A' : 'var(--text3)',
                    flexShrink: 0, minWidth: 46, textAlign: 'right',
                  }}>{on ? 'Shown' : 'Hidden'}</span>
                  <span style={{
                    width: 38, height: 22, borderRadius: 99, flexShrink: 0, position: 'relative',
                    background: on ? '#16A34A' : 'var(--border)', transition: 'background 0.15s',
                  }}>
                    <span style={{
                      position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16,
                      borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.15s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    }} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55, marginBottom: 14 }}>
        Hiding an area does not remove anyone's access to it — it stays reachable
        by a direct link, and its records are untouched. To take access away, use
        Role Access or the module settings instead.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            minHeight: 44, padding: '0 20px', borderRadius: 10, border: 'none', fontFamily: 'inherit',
            background: dirty && !saving ? 'var(--org-primary, #6D5DF6)' : 'var(--border)',
            color: dirty && !saving ? '#fff' : 'var(--text3)',
            fontSize: 13.5, fontWeight: 800, cursor: dirty && !saving ? 'pointer' : 'default',
          }}
        >{saving ? 'Saving…' : 'Save changes'}</button>
        {offCount > 0 && (
          <button onClick={() => setHidden([])} style={{
            minHeight: 44, padding: '0 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)',
            fontSize: 13, fontWeight: 700,
          }}>Show all {offCount === 1 ? 'again' : `${offCount} again`}</button>
        )}
        {msg && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>{msg}</span>}
      </div>
    </SettingCard>
  )
}

function OrgTypeCard({ org }) {
  const { refreshOrg } = useOrg()
  const current = org?.type || 'charity'
  const [selected, setSelected] = useState(current)
  const [alsoModules, setAlsoModules] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setSelected(org?.type || 'charity') }, [org?.type])

  const currentTerms = getTerms(current)
  const nextTerms = getTerms(selected)
  const changed = selected !== current
  // Only show rows that actually differ, so the preview is about the change
  // rather than a wall of identical words.
  const diffs = [
    ['People', currentTerms.People, nextTerms.People],
    ['Sessions', currentTerms.Sessions, nextTerms.Sessions],
    ['Staff', currentTerms.Staff, nextTerms.Staff],
    ['Groups', currentTerms.Groups, nextTerms.Groups],
  ].filter(([, a, b]) => a !== b)

  const handleSave = async () => {
    setSaving(true); setMsg('')
    const patch = { type: selected }
    if (alsoModules) {
      const { data, error: rpcErr } = await supabase.rpc('default_modules_for_org_type', { p_type: selected })
      if (!rpcErr && Array.isArray(data)) patch.modules = data
    }
    const { error } = await supabase.from('organisations').update(patch).eq('id', org?.id)
    setSaving(false)
    if (error) { setMsg('Could not save: ' + error.message); return }
    setMsg('✅ Updated. Terminology across the app now matches.')
    if (refreshOrg) refreshOrg()
  }

  return (
    <SettingCard title="Organisation type" description="Changes what the app calls things — young people, sessions, staff.">
      <Field label="Type">
        <select style={inp} value={selected} onChange={e => { setSelected(e.target.value); setMsg('') }}>
          {ORG_TYPE_OPTIONS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </Field>

      {changed && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
            What will change
          </div>
          {diffs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              Wording stays the same for this type — only the type label itself changes.
            </div>
          ) : diffs.map(([label, from, to]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 6 }}>
              <span style={{ width: 76, color: 'var(--text3)', fontWeight: 600, flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'var(--text3)', textDecoration: 'line-through' }}>{from}</span>
              <span style={{ color: 'var(--text3)' }}><Icon name="→" /></span>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{to}</span>
            </div>
          ))}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={alsoModules} onChange={e => setAlsoModules(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
              Also reset my modules to the suggested set for this type.
              <span style={{ color: 'var(--text3)' }}> Off by default — your current modules are kept, and you can change them any time in Modules.</span>
            </span>
          </label>
        </div>
      )}

      <button onClick={handleSave} disabled={!changed || saving}
        style={{ marginTop: 14, padding: '10px 20px', borderRadius: 8, border: 'none',
          background: (!changed || saving) ? 'var(--border)' : 'linear-gradient(135deg,#7C3AED,#3B82F6)',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: (!changed || saving) ? 'default' : 'pointer' }}>
        {saving ? 'Saving...' : changed ? 'Save type' : 'Saved'}
      </button>
      {msg && <div style={{ fontSize: 13, marginTop: 12, fontWeight: 600, color: msg.startsWith('✅') ? '#16A34A' : '#DC2626' }}>{msg}</div>}
    </SettingCard>
  )
}

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
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
          <img src={org?.logo_url || FALLBACK_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 14 }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{org?.name || 'Your Organisation'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{org?.plan || 'trial'} plan</span>
            <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>● Active</span>
          </div>
        </div>
      </div>
      <OrgTypeCard org={org} />
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
    const trimmed = newLabel.trim()
    if (!trimmed) return
    const group = groups.find(g => g.id === id)
    const oldLabel = group?.label
    await persistGroups(groups.map(g => g.id === id ? { ...g, label: trimmed } : g))
    if (oldLabel && oldLabel !== trimmed) {
      await supabase.from('children').update({ group_name: trimmed }).eq('org_id', orgId).ilike('group_name', oldLabel)
      setCounts(prev => {
        const next = { ...prev }
        const oldCount = next[oldLabel.toLowerCase()] || 0
        delete next[oldLabel.toLowerCase()]
        next[trimmed.toLowerCase()] = oldCount
        return next
      })
    }
  }

  const handleColorChange = async (id, color) => {
    await persistGroups(groups.map(g => g.id === id ? { ...g, color } : g))
  }

  const handleDelete = async (id) => {
    const group = groups.find(g => g.id === id)
    const count = counts[(group?.label || '').toLowerCase()] || 0
    const msg = count > 0
      ? `Delete "${group.label}"? ${count} ${count === 1 ? 'child is' : 'children are'} currently in this group — they will become ungrouped.`
      : `Delete "${group?.label}"?`
    if (!window.confirm(msg)) return
    await persistGroups(groups.filter(g => g.id !== id))
    if (group?.label) {
      await supabase.from('children').update({ group_name: null }).eq('org_id', orgId).ilike('group_name', group.label)
      setCounts(prev => ({ ...prev, [group.label.toLowerCase()]: 0 }))
    }
  }

  return (
    <SettingCard title="Groups" description="Organise your register into groups like Red, Blue, Juniors or Teens">
      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, fontWeight: 600 }}><Icon name="⚠️" /> {error}</div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Loading groups...</div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 16px', background: 'var(--surface2)', borderRadius: 14, border: '1.5px dashed var(--border2)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}><Icon name="🏷️" /></div>
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
        <button onClick={() => onDelete(group.id)} title="Delete group" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#DC2626', opacity: 0.7, padding: 2 }}><Icon name="🗑️" /></button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{count} {count === 1 ? 'child' : 'children'}</div>

      {showColors && (
        <div style={{ position: 'absolute', top: '100%', left: 12, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 8, display: 'flex', gap: 5, flexWrap: 'wrap', width: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 10 }}>
          {GROUP_COLOR_PRESETS.map(c => (
            <button key={c} onClick={() => { onColorChange(group.id, c); setShowColors(false) }}
              style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: c === group.color ? '2px solid #111' : '2px solid #fff', boxShadow: '0 0 0 1px #E5E7EB', cursor: 'pointer' }} />
          ))}
        </div>
      )}
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

// Device-local biometric app lock. Only offered where there's actually a
// built-in authenticator to use, so it doesn't appear as a dead toggle on a
// desktop with no Touch ID -- and only where the lock actually runs, which is
// phones and tablets. A Touch ID MacBook can satisfy the authenticator check
// but no longer locks, so offering the toggle there would enrol a device and
// then do nothing with it.
function BiometricUnlockCard() {
  const [available, setAvailable] = useState(null)
  const [userId, setUserId] = useState(null)
  const [enrolled, setEnrolled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [lockAfter, setLockAfterState] = useState(getLockAfterMs())

  useEffect(() => {
    let cancelled = false
    hasPlatformAuthenticator().then(v => { if (!cancelled) setAvailable(v) })
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const uid = data?.session?.user?.id || null
      setUserId(uid)
      setEnrolled(isEnrolledFor(uid))
    })
    return () => { cancelled = true }
  }, [])

  const handleEnable = async () => {
    setBusy(true); setMsg('')
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    const res = await enrolBiometric({ userId: user?.id, userName: user?.email, displayName: user?.email })
    setBusy(false)
    if (res.ok) { setEnrolled(true); setMsg('✅ Biometric unlock is on for this device.') }
    else setMsg(res.message)
  }

  const handleDisable = () => {
    clearEnrolment()
    setEnrolled(false)
    setMsg('Biometric unlock turned off for this device.')
  }

  if (available === false) return null
  if (available === null) return null

  // Enrolled on a desktop under the previous behaviour: say so plainly and let
  // them clear it, rather than showing a green "Enabled" for a lock that will
  // never engage here.
  if (!isAppLockPlatform()) {
    return (
      <SettingCard title="App lock" description="Lock the app behind Face ID, Touch ID or your fingerprint.">
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: enrolled ? 14 : 0 }}>
          App lock runs on phones and tablets, where the app might be left open and unattended during a session.
          On a computer it's your operating system's screen lock that does this job, so LaunchSession doesn't
          add a second one.
        </div>
        {enrolled && (
          <>
            <div style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 13px', marginBottom: 14, lineHeight: 1.5 }}>
              This computer was set up for app lock previously. It no longer locks.
            </div>
            <button onClick={handleDisable}
              style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Clear the setting on this computer
            </button>
          </>
        )}
        {msg && <div style={{ fontSize: 13, color: msg.startsWith('✅') ? '#16A34A' : '#DC2626', marginTop: 12, fontWeight: 600 }}>{msg}</div>}
      </SettingCard>
    )
  }

  return (
    <SettingCard title="Biometric unlock" description="Use Face ID, Touch ID or your fingerprint to unlock the app on this device.">
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 13px', fontSize: 12.5, color: '#92400E', marginBottom: 14, lineHeight: 1.5 }}>
        This locks the app on this device. It doesn't replace your password, and
        anyone who already knows your password can still sign in normally.
      </div>

      {enrolled ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#15803D', marginBottom: 14 }}>
            <span><Icon name="✅" /></span> Enabled on this device
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Lock after</label>
            <select value={lockAfter} onChange={e => { const v = parseInt(e.target.value, 10); setLockAfterState(v); setLockAfterMs(v) }}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--surface)', color: 'var(--text)' }}>
              <option value={0}>Immediately</option>
              <option value={60 * 1000}>1 minute</option>
              <option value={3 * 60 * 1000}>3 minutes</option>
              <option value={15 * 60 * 1000}>15 minutes</option>
              <option value={60 * 60 * 1000}>1 hour</option>
            </select>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 5 }}>How long the app can be in the background before it locks. It always locks when reopened from closed.</div>
          </div>
          <button onClick={handleDisable}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Turn off on this device
          </button>
        </>
      ) : (
        <button onClick={handleEnable} disabled={busy || !userId}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: busy ? 'var(--border)' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Setting up...' : 'Enable on this device'}
        </button>
      )}
      {msg && <div style={{ fontSize: 13, color: msg.startsWith('✅') ? '#16A34A' : '#DC2626', marginTop: 12, fontWeight: 600 }}>{msg}</div>}
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
      <BiometricUnlockCard />
      <SettingCard title="Active Sessions" description="Devices currently logged in to your account">
        <div style={{ background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Current Session</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Browser · Now</div>
          </div>
          <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Active</span>
        </div>
      </SettingCard>
      <ModulePasswordCard moduleKey="children" label="Children" icon="🧒" accentColor="#2563EB" />
      <ModulePasswordCard moduleKey="safeguarding" label="Safeguarding" icon="🛡" accentColor="#DC2626" />
    </div>
  )
}

// Mirrors the EVENT_TEMPLATES categories/priorities in api/send-form-email.js
// exactly -- this is the actual, complete list of notification types the
// system sends today. Kept here rather than generated, since the two files
// can't share code (one's a Vercel API route, one's the React app), but
// they must be kept in sync by hand whenever a new event type is added.
// TEST_NOTIFICATION is deliberately omitted -- it's a manual "send test"
// action, not something a person opts in/out of.
const NOTIFICATION_GROUPS = [
  {
    key: 'safeguarding', icon: '🛡', label: 'Safeguarding & Security', locked: true,
    description: "Critical alerts. Only admins can change how these are routed — they can't be turned off by ordinary staff.",
    events: [
      { key: 'SAFEGUARDING_ACTION_REQUIRED', label: 'Safeguarding action required' },
      { key: 'SECURITY_ALERT', label: 'Security alerts (e.g. role changes)' },
    ],
  },
  {
    key: 'sessions', icon: '📅', label: 'Sessions & Registers',
    description: 'Session timing, cancellations, staffing changes, and registers that need closing.',
    events: [
      { key: 'SESSION_STARTING_SOON', label: 'Session starting in 30 minutes' },
      { key: 'SESSION_CANCELLED', label: 'Session cancelled' },
      { key: 'STAFF_ADDED_TO_SESSION', label: "You've been added to a session" },
      { key: 'SESSION_CREATED', label: 'New session created' },
      { key: 'SESSION_EDITED', label: 'A session you\u2019re on has been updated' },
      { key: 'REGISTER_INCOMPLETE', label: 'Register closed with attendance unresolved', category: 'registers' },
      { key: 'REGISTER_LEFT_OPEN', label: "Register still open, session ended", category: 'registers' },
    ],
  },
  {
    key: 'volunteers', icon: '❤️', label: 'Volunteers & Forms',
    description: 'Cover requests, invitation responses, and form submissions.',
    events: [
      { key: 'VOLUNTEER_COVER_REQUIRED', label: 'Volunteer cover needed' },
      { key: 'INVITATION_ACCEPTED', label: 'Invitation accepted' },
      { key: 'FORM_SUBMISSION_RECEIVED', label: 'New form submission', category: 'forms' },
    ],
  },
  {
    key: 'consents', icon: '✅', label: "Children's Records",
    description: 'Consent expiry and medical information changes.',
    events: [
      { key: 'CONSENT_EXPIRING', label: 'Consent record expiring soon' },
      { key: 'MEDICAL_INFO_UPDATED', label: "Medical information updated", category: 'medical' },
    ],
  },
  {
    key: 'resources', icon: '📦', label: 'Resources & Reflections',
    description: 'Risk assessments, bookings, and session reflections.',
    events: [
      { key: 'RISK_ASSESSMENT_DUE', label: 'Risk assessment due for review' },
      { key: 'RESOURCE_BOOKING_UPDATE', label: 'Resource booking approved or changed' },
      { key: 'REFLECTION_DUE', label: 'Session ready for reflection', category: 'reflections' },
    ],
  },
  {
    key: 'messaging', icon: '💬', label: 'Messages', description: 'New messages sent to you.',
    events: [{ key: 'NEW_MESSAGE', label: 'New message' }],
  },
]

function NotificationsSection({ org, session: authSession }) {
  const userId = authSession?.user?.id
  const supported = isPushSupported()
  const [permission, setPermission] = useState(getNotificationPermission())
  const [isSubscribedHere, setIsSubscribedHere] = useState(false)
  const [devices, setDevices] = useState([])
  const [prefs, setPrefs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [testState, setTestState] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [error, setError] = useState('')
  const [expandedGroups, setExpandedGroups] = useState({})

  const load = async () => {
    if (!userId) return
    const sub = await getCurrentSubscription()
    setIsSubscribedHere(!!sub)
    setDevices(await listMySubscriptions(userId))
    const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle()
    setPrefs(data || { push_enabled: true, email_enabled: true, event_overrides: {}, quiet_hours_enabled: false, quiet_hours_start: null, quiet_hours_end: null, timezone: 'Europe/London', ...Object.fromEntries(NOTIFICATION_GROUPS.map(g => [g.key, true])) })
    setPermission(getNotificationPermission())
  }

  useEffect(() => { load() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = !supported ? 'unsupported' : permission === 'denied' ? 'blocked' : isSubscribedHere ? 'enabled' : 'not_enabled'
  const statusMeta = {
    unsupported: { label: 'Unsupported', color: 'var(--text-faint)', bg: '#F1F5F9' },
    blocked:     { label: 'Blocked', color: '#DC2626', bg: '#FEF2F2' },
    enabled:     { label: 'Enabled', color: '#16A34A', bg: '#F0FDF4' },
    not_enabled: { label: 'Not enabled', color: '#D97706', bg: '#FFFBEB' },
  }[status]

  const handleEnable = async () => {
    setError(''); setBusy(true)
    const result = await subscribeToPush(org?.id, userId)
    setBusy(false)
    if (!result.success) {
      if (result.error === 'blocked') setError('Notifications are blocked in your browser.')
      else if (result.error !== 'dismissed') setError(result.error || 'Could not enable notifications.')
    }
    await load()
  }

  const handleDisable = async () => {
    setBusy(true)
    await unsubscribeFromPush()
    setBusy(false)
    await load()
  }

  const handleRemoveDevice = async (id) => {
    await revokeSubscriptionById(id)
    await load()
  }

  const handleTest = async () => {
    setTestState('sending')
    const result = await sendTestNotification()
    setTestState(result.success && result.sent > 0 ? 'sent' : 'error')
    setTimeout(() => setTestState(null), 3500)
  }

  const savePrefs = async (next) => {
    setPrefs(next)
    await supabase.from('notification_preferences').upsert({ ...next, org_id: org?.id, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }

  const toggleCategory = (key, locked) => {
    if (!prefs || locked) return
    savePrefs({ ...prefs, [key]: !prefs[key] })
  }

  // A per-type override is only meaningful once it diverges from the
  // category default -- so "on" means "follow the category toggle above"
  // until someone explicitly flips this one specific alert.
  const isEventEnabled = (group, eventKey) => {
    const override = prefs?.event_overrides?.[eventKey]
    if (override !== undefined) return override
    return group.locked ? true : !!prefs?.[group.key]
  }
  const toggleEventOverride = (group, eventKey) => {
    if (!prefs || group.locked) return
    const current = isEventEnabled(group, eventKey)
    savePrefs({ ...prefs, event_overrides: { ...(prefs.event_overrides || {}), [eventKey]: !current } })
  }
  const updateQuietHours = (patch) => { if (prefs) savePrefs({ ...prefs, ...patch }) }

  return (
    <>
      <SettingCard title="Push Notifications" description="Get alerted the moment something needs your attention — even when LaunchSession isn't open.">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: statusMeta.color, background: statusMeta.bg, borderRadius: 99, padding: '5px 12px' }}>{statusMeta.label}</span>
            {status === 'blocked' && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Update this in your browser's site settings, then reload.</span>}
          </div>
          {status === 'enabled' ? (
            <button onClick={handleDisable} disabled={busy} style={{ padding: '9px 16px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Working…' : 'Disable on this device'}
            </button>
          ) : status === 'not_enabled' ? (
            <button onClick={handleEnable} disabled={busy} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
              {busy ? 'Enabling…' : 'Enable notifications'}
            </button>
          ) : null}
        </div>

        {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}

        {status === 'unsupported' && (
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Push notifications aren't supported on this browser. You'll still see everything in-app, and can turn on email notifications below.</div>
        )}

        {status === 'enabled' && (
          <button onClick={handleTest} disabled={testState === 'sending'} style={{ padding: '9px 16px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}>
            {testState === 'sending' ? 'Sending…' : testState === 'sent' ? '✅ Sent — check your notifications' : testState === 'error' ? '⚠ Could not send' : 'Send test notification'}
          </button>
        )}
      </SettingCard>

      {devices.length > 0 && (
        <SettingCard title="Your devices" description="Browsers and devices currently set up to receive push notifications for your account.">
          {devices.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.device_name || 'Unknown device'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Last active: {d.last_used_at ? new Date(d.last_used_at).toLocaleDateString('en-GB') : '—'}</div>
              </div>
              <button onClick={() => handleRemoveDevice(d.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
        </SettingCard>
      )}

      <SettingCard title="Notification Types" description="Choose what you want to be notified about. Expand a group to fine-tune individual alerts within it.">
        {prefs && NOTIFICATION_GROUPS.map(g => {
          const isExpanded = !!expandedGroups[g.key]
          const groupOn = g.locked ? true : !!prefs[g.key]
          return (
            <div key={g.key} style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ opacity: g.locked ? 0.75 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 4px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>{g.icon} {g.label}{g.locked ? ' (required)' : ''}</span>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{g.description}</div>
                  </div>
                  <div onClick={() => toggleCategory(g.key, g.locked)} style={{ width: 40, height: 22, borderRadius: 11, background: groupOn ? '#1B9AAA' : '#D1D5DB', position: 'relative', cursor: g.locked ? 'default' : 'pointer', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ position: 'absolute', top: 2, left: groupOn ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
                <button onClick={() => setExpandedGroups(prev => ({ ...prev, [g.key]: !prev[g.key] }))} style={{ background: 'none', border: 'none', padding: '0 0 10px', color: '#1B9AAA', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                  {isExpanded ? '▾ Hide individual alerts' : `▸ Customise ${g.events.length} individual alert${g.events.length > 1 ? 's' : ''}`}
                </button>
              </div>

              {isExpanded && (
                <div style={{ paddingLeft: 14, marginBottom: 8 }}>
                  {g.events.map(ev => {
                    const on = isEventEnabled(g, ev.key)
                    return (
                      <div key={ev.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', opacity: g.locked ? 0.75 : 1 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{ev.label}</span>
                        <div onClick={() => toggleEventOverride(g, ev.key)} style={{ width: 32, height: 18, borderRadius: 9, background: on ? '#1B9AAA' : '#D1D5DB', position: 'relative', cursor: g.locked ? 'default' : 'pointer', flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </SettingCard>

      <SettingCard title="Quiet Hours" description="Pause push notifications during set hours. Critical safeguarding and security alerts still come through regardless.">
        <Toggle value={!!prefs?.quiet_hours_enabled} onChange={() => updateQuietHours({ quiet_hours_enabled: !prefs?.quiet_hours_enabled })} label="🌙 Enable quiet hours" />
        {prefs?.quiet_hours_enabled && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: '14px 0 4px' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>From</div>
              <input type="time" value={prefs?.quiet_hours_start?.slice(0, 5) || '21:00'} onChange={e => updateQuietHours({ quiet_hours_start: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>To</div>
              <input type="time" value={prefs?.quiet_hours_end?.slice(0, 5) || '07:00'} onChange={e => updateQuietHours({ quiet_hours_end: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Time zone</div>
              <select value={prefs?.timezone || 'Europe/London'} onChange={e => updateQuietHours({ timezone: e.target.value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', width: '100%' }}>
                <option value="Europe/London">UK (Europe/London)</option>
                <option value="Europe/Dublin">Ireland (Europe/Dublin)</option>
                <option value="Europe/Paris">Central Europe (Europe/Paris)</option>
              </select>
            </div>
          </div>
        )}
      </SettingCard>

      <SettingCard title="Email Notifications" description="Also receive important updates by email.">
        <Toggle value={prefs?.email_enabled ?? true} onChange={() => prefs && savePrefs({ ...prefs, email_enabled: !prefs.email_enabled })} label="📧 Email me for the categories above" />
      </SettingCard>
    </>
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
          <div key={i.name} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}><Icon name={i.icon} /></span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{i.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i.desc}</div>
              </div>
            </div>
            <div>
              {i.status === 'connected' && <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>● Connected</span>}
              {i.status === 'available' && <button style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #1B9AAA', background: 'var(--surface)', color: '#1B9AAA', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Connect</button>}
              {i.status === 'coming_soon' && <span style={{ background: 'var(--surface3)', color: 'var(--text-faint)', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Coming Soon</span>}
            </div>
          </div>
        ))}
      </div>
    </SettingCard>
  )
}

const STATUS_STYLE = {
  active:    { bg: '#DCFCE7', color: '#15803D', label: '● Active' },
  trialing:  { bg: '#DBEAFE', color: '#1D4ED8', label: '● Trial' },
  past_due:  { bg: '#FEF3C7', color: '#B45309', label: '● Payment overdue' },
  unpaid:    { bg: '#FEE2E2', color: '#B91C1C', label: '● Unpaid' },
  canceled:  { bg: '#FEE2E2', color: '#B91C1C', label: '● Canceled' },
  incomplete:{ bg: '#FEE2E2', color: '#B91C1C', label: '● Incomplete' },
}

const CYCLES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'annual',  label: 'Annual' },
]

// The Access screens already name every module for humans; reusing that list
// keeps one spelling of "Impact & Outcomes" rather than two.
const MODULE_LABEL = Object.fromEntries(ACCESS_MODULES.map(m => [m.key, m.label]))

const poundsPerMonth = (pence) => `£${Math.round(pence / 100)}`

function BillingSection({ org, session, isAdmin, refreshOrg }) {
  const isMobile = useIsMobile()
  const [plans, setPlans] = useState(null)      // null while loading
  const [plansError, setPlansError] = useState('')
  const [cycle, setCycle] = useState(org?.billing_cycle === 'annual' ? 'annual' : 'monthly')
  const [loadingPlan, setLoadingPlan] = useState(null) // which plan button is spinning
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [usage, setUsage] = useState(null)

  const currentPlan = org?.plan || 'trial'
  const status = org?.subscription_status
  const statusStyle = STATUS_STYLE[status] || { bg: '#F1F5F9', color: '#475569', label: status ? `● ${status}` : '● No active subscription' }
  const daysLeft = trialDaysRemaining(org)
  const planEnded = isPlanEnded(org)

  // The catalogue lives in the database so the app, the Stripe webhook and the
  // Command Centre cannot hold three different ideas of what a plan includes.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('plan_entitlements')
        .select('plan, label, blurb, modules, child_limit, price_monthly_pence, price_annual_pence, sort, self_serve')
        .order('sort')
      if (cancelled) return
      if (err) { setPlansError('Could not load the plans right now.'); setPlans([]); return }
      setPlans(data || [])
    })()
    return () => { cancelled = true }
  }, [])

  // Counted in the database rather than from a fetched list: this is the same
  // number enforce_child_limit() checks against, so the screen cannot claim
  // there is room when the trigger will refuse.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase.rpc('org_child_usage')
      if (cancelled || err) return
      setUsage(Array.isArray(data) ? data[0] : data)
    })()
    return () => { cancelled = true }
  }, [org?.plan])

  const currentEntitlement = (plans || []).find(p => p.plan === currentPlan)
  const sellable = (plans || []).filter(p => p.self_serve)

  const handleChoose = async (plan) => {
    setError(''); setNotice('')
    setLoadingPlan(plan)
    try {
      const { data: { session: liveSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${liveSession?.access_token}` },
        body: JSON.stringify({ org_id: org.id, plan, cycle }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // An organisation that already has a subscription changes price in place
      // rather than going through Checkout again, so there is no URL to follow.
      if (json.updated) {
        setNotice('Your plan has been changed. The difference appears on your next invoice.')
        setLoadingPlan(null)
        if (refreshOrg) refreshOrg()
        return
      }
      window.location.href = json.url
    } catch (err) {
      setError(err.message || 'Failed to start checkout')
      setLoadingPlan(null)
    }
  }

  const handleManageBilling = async () => {
    setError(''); setNotice('')
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

  // Stripe redirects back here the moment the payment clears, but the webhook
  // that records the plan can land a second or two later. Refetch a few times
  // rather than showing the old plan and leaving the customer wondering
  // whether their payment worked.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'success' || !refreshOrg) return
    setNotice('Payment received — setting up your plan.')
    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      refreshOrg()
      if (tries >= 5) clearInterval(timer)
    }, 1500)
    return () => clearInterval(timer)
  }, [refreshOrg])

  return (
    <div>
      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}><Icon name="⚠️" /> {error}</div>
      )}
      {notice && (
        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', color: '#15803D', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>{notice}</div>
      )}

      <SettingCard title="Current Plan">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>
              {currentEntitlement?.label || currentPlan}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              {planEnded
                ? 'Read-only — choose a plan to start making changes again'
                : daysLeft !== null
                  ? `${daysLeft === 1 ? '1 day' : `${daysLeft} days`} left · no card required`
                  : org?.current_period_end
                    ? `Renews ${new Date(org.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'No billing history yet'}
            </div>
          </div>
          <span style={{ background: statusStyle.bg, color: statusStyle.color, borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
            {!status && daysLeft !== null ? '● Trial' : statusStyle.label}
          </span>
        </div>

        {isAdmin && org?.stripe_customer_id && (
          <button onClick={handleManageBilling} disabled={portalLoading}
            style={{ minHeight: 44, padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {portalLoading ? 'Opening...' : 'Manage Billing'}
          </button>
        )}
      </SettingCard>

      {isAdmin && (
        <SettingCard title="Plans" description="Every plan starts with the 14-day trial. Change or cancel at any time.">
          {plansError && (
            <div style={{ fontSize: 13, color: '#B91C1C', marginBottom: 12 }}>{plansError}</div>
          )}
          {plans === null ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Loading plans…</div>
          ) : (
            <>
              <div role="group" aria-label="Billing cycle" style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: 16 }}>
                {CYCLES.map(c => (
                  <button key={c.key} onClick={() => setCycle(c.key)}
                    aria-pressed={cycle === c.key}
                    style={{
                      minHeight: 36, padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: cycle === c.key ? '#1B9AAA' : 'transparent',
                      color: cycle === c.key ? '#fff' : 'var(--text3)',
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    }}>
                    {c.key === 'annual' ? 'Annual · save ~20%' : c.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {sellable.map(p => {
                  const isCurrent = currentPlan === p.plan
                  const pence = cycle === 'annual' ? p.price_annual_pence : p.price_monthly_pence
                  return (
                    <div key={p.plan} style={{ border: isCurrent ? '2px solid #1B9AAA' : '1.5px solid var(--border)', borderRadius: 14, padding: '18px 16px', background: 'var(--surface)' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{p.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '4px 0' }}>
                        {pence == null ? '—' : <>{poundsPerMonth(pence)}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>/mo</span></>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>
                        {cycle === 'annual' ? 'billed annually' : 'billed monthly'}
                        {p.child_limit ? ` · up to ${p.child_limit} children` : ' · unlimited children'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, minHeight: 48, lineHeight: 1.5 }}>{p.blurb}</div>
                      {isCurrent ? (
                        <div style={{ textAlign: 'center', padding: '12px 0', borderRadius: 8, background: '#DCFCE7', color: '#15803D', fontWeight: 700, fontSize: 13 }}>Current Plan</div>
                      ) : (
                        <button onClick={() => handleChoose(p.plan)} disabled={loadingPlan === p.plan}
                          style={{ width: '100%', minHeight: 44, borderRadius: 8, border: 'none', background: loadingPlan === p.plan ? '#9ca3af' : '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {loadingPlan === p.plan ? 'Redirecting...' : org?.stripe_subscription_id ? `Switch to ${p.label}` : `Choose ${p.label}`}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '14px 0 0', lineHeight: 1.6 }}>
                Registered charity? <a href="mailto:hello@launchsession.co.uk?subject=Charity%20discount" style={{ color: '#1B9AAA', fontWeight: 600 }}>Ask about our discount</a>.
                {' '}Need more than Pro+? <a href="mailto:hello@launchsession.co.uk?subject=Enterprise%20Plan" style={{ color: '#1B9AAA', fontWeight: 600 }}>Talk to us</a>.
              </p>
            </>
          )}
        </SettingCard>
      )}

      <SettingCard title="Young people">
        {usage == null ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Counting…</div>
        ) : (() => {
          const used = usage.used || 0
          const cap = usage.child_limit
          if (cap == null) {
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{used}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>on the register · no limit on this plan</span>
              </div>
            )
          }
          const pct = Math.min(100, Math.round((used / cap) * 100))
          const full = used >= cap
          const tone = full ? '#DC2626' : pct >= 80 ? '#B45309' : '#1B9AAA'
          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{used} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)' }}>of {cap}</span></span>
                <span style={{ fontSize: 13, color: tone, fontWeight: 600 }}>
                  {full ? 'Limit reached' : `${cap - used} place${cap - used === 1 ? '' : 's'} left`}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--bg)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: tone, borderRadius: 99 }} />
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text3)' }}>
                {full
                  ? 'Archiving someone who has left frees a place, or move to a plan with no limit. Nobody already on the register is affected.'
                  : 'Only active young people count. Archiving someone who has left frees a place.'}
              </p>
            </div>
          )
        })()}
      </SettingCard>

      <SettingCard title="What your plan includes">
        {currentEntitlement ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(currentEntitlement.modules || []).length === 0
              ? <span style={{ fontSize: 13, color: 'var(--text3)' }}>No modules — this organisation is read-only until a plan is chosen.</span>
              : (currentEntitlement.modules || []).map(m => (
                <span key={m} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2, #475569)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 11px' }}>
                  {MODULE_LABEL[m] || m}
                </span>
              ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>—</span>
        )}
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
          <a key={l.title} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            <span style={{ fontSize: 22 }}><Icon name={l.icon} /></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{l.desc}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: 16 }}>›</span>
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
    // Store the object path. The bucket is private, so a stored URL is dead on
    // arrival; links are signed at the point they are opened.
    await supabase.from('organisations').update({ safeguarding_policy_url: path }).eq('id', org?.id)
    setPolicyUrl(path)
    setUploading(false)
  }

  return (
    <div>
      {/* Header banner */}
      <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', borderRadius: 12, padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}><Icon name="🛡️" /></div>
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
            <span style={{ fontSize: 22 }}><Icon name="📄" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Policy document uploaded</div>
              <button type="button" onClick={async () => { const u = await signOne('safeguarding-docs', policyUrl, 300); if (u) window.open(u, '_blank', 'noopener,noreferrer') }} style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, textDecoration: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>View / Download <Icon name="↗" /></button>
            </div>
            <button onClick={() => setPolicyUrl('')} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
          </div>
        ) : (
          <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}><Icon name="📋" /></div>
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
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
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
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-faint)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{label} Settings</div>
      <div style={{ fontSize: 14 }}>This section is coming soon.</div>
    </div>
  )
}


function GroupsSection({ org, refreshOrg }) {
  const [collectionRequired, setCollectionRequired] = useState(org?.collection_recording_required !== false)
  const [identityCheckRequired, setIdentityCheckRequired] = useState(org?.identity_check_required || false)
  const [staffRatio, setStaffRatio] = useState(org?.default_staff_ratio || 8)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSaveRegisterOptions = async () => {
    setSaving(true)
    await supabase.from('organisations').update({
      collection_recording_required: collectionRequired,
      identity_check_required: identityCheckRequired,
      default_staff_ratio: Number(staffRatio) || 8,
    }).eq('id', org.id)
    if (refreshOrg) await refreshOrg()
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  // null = "Never" for both -- the safe, opt-in default. Nothing archives
  // or deletes for an org until they explicitly pick a value here.
  const [retentionMonths, setRetentionMonths] = useState(org?.register_retention_months ?? '')
  const [deletionGraceMonths, setDeletionGraceMonths] = useState(org?.register_deletion_grace_months ?? '')
  const [retentionSaving, setRetentionSaving] = useState(false)
  const [retentionSaved, setRetentionSaved] = useState(false)

  const handleSaveRetention = async () => {
    setRetentionSaving(true)
    await supabase.from('organisations').update({
      register_retention_months: retentionMonths === '' ? null : Number(retentionMonths),
      register_deletion_grace_months: deletionGraceMonths === '' ? null : Number(deletionGraceMonths),
    }).eq('id', org.id)
    if (refreshOrg) await refreshOrg()
    setRetentionSaving(false); setRetentionSaved(true); setTimeout(() => setRetentionSaved(false), 2000)
  }

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #0A0F1E, #1a2744)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 32 }}><Icon name="📋" /></div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Registers</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Groups, locations, and how sign-in/sign-out works across your sessions</div>
        </div>
      </div>

      <SettingCard title="Register Options" description="Control what staff are asked for when signing young people in and out.">
        <Toggle value={collectionRequired} onChange={setCollectionRequired} label="Require collection details on sign-out" />
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: -8, marginBottom: 16, paddingLeft: 2 }}>
          When on, staff must record who's collecting each child (approved adult, parent, leaving independently, etc.) before they can sign out. Turn this off if your organisation doesn't need collection records — sign-out becomes a single tap.
        </div>

        <Toggle value={identityCheckRequired} onChange={setIdentityCheckRequired} label="Require identity check confirmation on sign-out" />
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: -8, marginBottom: 16, paddingLeft: 2 }}>
          When on, staff must tick "Identity checked" before confirming a sign-out. Only applies if collection details are required above.
        </div>

        <Field label="Default staff-to-child ratio" hint="Used to warn staff during live sessions if a session doesn't set its own ratio. Enter the number of children per 1 staff member.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>1 :</span>
            <input type="number" min="1" style={{ ...inp, maxWidth: 100 }} value={staffRatio} onChange={e => setStaffRatio(e.target.value)} />
          </div>
        </Field>

        <button onClick={handleSaveRegisterOptions} disabled={saving} style={{ marginTop: 4, padding: '10px 20px', borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : '#1B9AAA', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Register Options'}
        </button>
      </SettingCard>

      <SettingCard title="Data Retention" description="Control how long closed registers stay in your main Past Registers list before moving to Archive, and whether they're eventually deleted for good.">
        <Field label="Archive registers after" hint="Closed registers older than this move from Past Registers into the Archive tab. They're still fully viewable there — this just keeps your main list to recent sessions.">
          <select style={{ ...inp, maxWidth: 280 }} value={retentionMonths} onChange={e => setRetentionMonths(e.target.value)}>
            <option value="">Never (keep in Past Registers indefinitely)</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">1 year</option>
            <option value="24">2 years</option>
            <option value="36">3 years</option>
            <option value="60">5 years</option>
            <option value="84">7 years</option>
          </select>
        </Field>

        <Field label="Permanently delete archived registers after" hint="Once a register has been in Archive for this long, it's permanently deleted — attendance records and all. A minimal record (session title, date, and that it existed) is kept for audit purposes; the attendance detail itself cannot be recovered.">
          <select style={{ ...inp, maxWidth: 280 }} value={deletionGraceMonths} onChange={e => setDeletionGraceMonths(e.target.value)}>
            <option value="">Never (keep archived registers forever)</option>
            <option value="1">1 month after archiving</option>
            <option value="3">3 months after archiving</option>
            <option value="6">6 months after archiving</option>
            <option value="12">1 year after archiving</option>
            <option value="24">2 years after archiving</option>
          </select>
        </Field>

        {deletionGraceMonths !== '' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>
            ⚠ With this set, registers will be permanently and automatically deleted once they've reached the end of both periods — this cannot be undone. Any linked safeguarding concerns are preserved regardless.
          </div>
        )}

        <button onClick={handleSaveRetention} disabled={retentionSaving} style={{ marginTop: 4, padding: '10px 20px', borderRadius: 10, border: 'none', background: retentionSaving ? '#9CA3AF' : '#1B9AAA', color: '#fff', fontSize: 13, fontWeight: 700, cursor: retentionSaving ? 'default' : 'pointer' }}>
          {retentionSaving ? 'Saving...' : retentionSaved ? '✓ Saved' : 'Save Data Retention'}
        </button>
      </SettingCard>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8, paddingLeft: 2 }}>Groups & Locations</div>
        <OrgSettingsPanel orgId={org?.id} />
      </div>
    </div>
  )
}

function VenuesSection({ org, isAdmin }) {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const emptyForm = { name: '', address: '', capacity: '', default_meeting_point: '', notes: '', defibrillator_location: '', nearest_hospital: '', default_hazards: [] }
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
    setForm({
      name: v.name, address: v.address || '', capacity: v.capacity || '', default_meeting_point: v.default_meeting_point || '', notes: v.notes || '',
      defibrillator_location: v.defibrillator_location || '', nearest_hospital: v.nearest_hospital || '', default_hazards: v.default_hazards || [],
    })
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
      defibrillator_location: form.defibrillator_location.trim() || null,
      nearest_hospital: form.nearest_hospital.trim() || null,
      default_hazards: form.default_hazards.filter(h => h.hazard && h.hazard.trim()),
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
        <div style={{ fontSize: 32 }}><Icon name="📍" /></div>
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
            <div key={v.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-soft)', opacity: v.is_active ? 1 : 0.5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {v.name} {!v.is_active && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', marginLeft: 6 }}>INACTIVE</span>}
                </div>
                {v.address && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{v.address}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {v.capacity && <span><Icon name="👥" /> Capacity {v.capacity}</span>}
                  {v.default_meeting_point && <span><Icon name="📍" /> Meet at {v.default_meeting_point}</span>}
                  {v.default_hazards?.length > 0 && <span>🛡️ {v.default_hazards.length} default hazard{v.default_hazards.length === 1 ? '' : 's'}</span>}
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
          <div style={{ marginTop: 16, padding: 16, background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <Field label="Venue name *"><input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cassiobury Park Sports Hall" /></Field>
            <Field label="Address"><input style={inp} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, town, postcode" /></Field>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Capacity"><input style={inp} type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 40" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Default meeting point"><input style={inp} value={form.default_meeting_point} onChange={e => setForm({ ...form, default_meeting_point: e.target.value })} placeholder="e.g. Main entrance" /></Field></div>
            </div>
            <Field label="Notes" hint="Access codes, parking, anything staff should know"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>

            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 6 }}>Emergency details (used by Risk Assessments)</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Nearest hospital / A&E"><input style={inp} value={form.nearest_hospital} onChange={e => setForm({ ...form, nearest_hospital: e.target.value })} placeholder="Name and address" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Defibrillator location"><input style={inp} value={form.defibrillator_location} onChange={e => setForm({ ...form, defibrillator_location: e.target.value })} placeholder="e.g. Main reception" /></Field></div>
            </div>

            <VenueDefaultHazardsEditor hazards={form.default_hazards} onChange={h => setForm(f => ({ ...f, default_hazards: h }))} />

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Venue')}</button>
              <button onClick={() => { setAdding(false); setEditingId(null); setError('') }} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </SettingCard>
    </div>
  )
}

// Lightweight repeatable list for a venue's default hazards — these get offered
// (and can auto-seed) whenever this venue is picked on a new Risk Assessment.
function VenueDefaultHazardsEditor({ hazards, onChange }) {
  const add = () => onChange([...(hazards || []), { hazard: '', who_at_risk: '', likelihood: 2, severity: 2, control_measures: '' }])
  const update = (i, patch) => onChange(hazards.map((h, idx) => idx === i ? { ...h, ...patch } : h))
  const remove = (i) => onChange(hazards.filter((_, idx) => idx !== i))
  const smallInp = { ...inp, padding: '7px 9px', fontSize: 12.5 }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Default hazards for this venue</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Added automatically (or offered) whenever a Risk Assessment is created for this venue — e.g. water hazards, uneven terrain.</div>
      {(hazards || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {hazards.map((h, i) => (
            <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9, padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input style={{ ...smallInp, flex: 1 }} value={h.hazard} onChange={e => update(i, { hazard: e.target.value })} placeholder="e.g. Slips on wet flooring" />
                <button onClick={() => remove(i)} style={{ padding: '0 10px', borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
              </div>
              <input style={{ ...smallInp, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} value={h.control_measures || ''} onChange={e => update(i, { control_measures: e.target.value })} placeholder="Control measures" />
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Likelihood
                  <select style={{ ...smallInp, width: 50 }} value={h.likelihood || 2} onChange={e => update(i, { likelihood: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Severity
                  <select style={{ ...smallInp, width: 50 }} value={h.severity || 2} onChange={e => update(i, { severity: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={add} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'none', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>+ Add default hazard</button>
    </div>
  )
}

const ROLE_CONFIG = {
  owner:     { label: 'Owner',     color: '#B45309', bg: '#FEF3C7' },
  admin:     { label: 'Admin',     color: '#7C3AED', bg: '#F3E8FF' },
  manager:   { label: 'Manager',   color: '#0891B2', bg: '#CFFAFE' },
  staff:     { label: 'Staff',     color: '#2563EB', bg: '#DBEAFE' },
  volunteer: { label: 'Volunteer', color: '#059669', bg: '#D1FAE5' },
}
// A role we do not recognise reads as exactly that. Falling back to Volunteer
// understated someone's access on the one screen that exists to show it.
const ROLE_UNKNOWN = { label: 'Unknown role', color: 'var(--text3)', bg: '#F1F5F9' }

// Access tiers, most privileged first. `always` keeps a card on screen when it
// is empty, because "no admins" is information; an empty Managers card is not.
const ACCESS_TIERS = [
  { key: 'leadership', title: 'Owners & admins', roles: ['owner', 'admin'], always: true,
    description: 'Full access to organisation settings, branding, billing and user management' },
  { key: 'managers', title: 'Managers', roles: ['manager'],
    description: 'Run delivery and approve work, without organisation-level settings' },
  { key: 'team', title: 'Staff & volunteers', roles: ['staff', 'volunteer'], always: true,
    description: 'Day-to-day access, without organisation-level settings' },
]

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
    // Guarded here too: the button is disabled, but losing the owner would
    // leave the organisation with nobody holding it.
    if (user.role === 'owner') { setError("The owner can't be removed here. Transfer ownership first."); return }
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

  const tiers = ACCESS_TIERS
    .map(t => ({ ...t, members: users.filter(u => t.roles.includes(u.role)) }))
    .filter(t => t.always || t.members.length > 0)

  // Anyone whose role is not in the model still has access, so they are shown
  // rather than quietly dropped from the list of who can get in.
  const known = new Set(ACCESS_TIERS.flatMap(t => t.roles))
  const unplaced = users.filter(u => !known.has(u.role))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}><Icon name="👥" /> Admin</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Manage who has access to {org?.name || 'your organisation'} and what they can do.</div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: org?.primary_color || '#1B9AAA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Invite Person
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, fontWeight: 600 }}><Icon name="⚠️" /> {error}</div>
      )}

      {[...tiers, ...(unplaced.length > 0
        ? [{ key: 'unplaced', title: 'Other accounts', members: unplaced,
             description: 'These roles are not part of the access model — check them' }]
        : [])].map(tier => (
        <SettingCard key={tier.key} title={`${tier.title} (${tier.members.length})`} description={tier.description}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
          ) : tier.members.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nobody has this level of access yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tier.members.map(u => (
                <UserRow key={u.id} user={u} isAdmin={isAdmin} isSelf={u.id === currentUserId} busy={busyId === u.id}
                  onRoleChange={handleRoleChange} onRemove={handleRemove} />
              ))}
            </div>
          )}
        </SettingCard>
      ))}

      {showInvite && (
        <InviteUserModal org={org} session={session} onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); loadUsers() }} />
      )}
    </div>
  )
}

function UserRow({ user, isAdmin, isSelf, busy, onRoleChange, onRemove }) {
  const rc = ROLE_CONFIG[user.role] || ROLE_UNKNOWN
  const isOwner = user.role === 'owner'
  const initials = (user.full_name || user.email || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: rc.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, overflow: 'hidden' }}>
        {user.photo_url ? <SignedImg bucket="staff-photos" src={user.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {user.full_name || user.email}
          {isSelf && <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>(you)</span>}
          {user.status === 'pending_invite' && <span style={{ fontSize: 9, fontWeight: 800, color: '#D97706', background: '#FEF3C7', borderRadius: 99, padding: '1px 7px' }}>PENDING</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{user.email}</div>
      </div>
      {isAdmin && !isOwner ? (
        <select value={user.role} disabled={busy || isSelf} onChange={e => onRoleChange(user.id, e.target.value)}
          style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: isSelf ? 'default' : 'pointer' }}>
          {/* Owner is absent deliberately: handing over ownership is not a
              dropdown change. An unrecognised role keeps its own option so
              selecting it is a choice rather than a silent reassignment. */}
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="volunteer">Volunteer</option>
          {!ROLE_CONFIG[user.role] && <option value={user.role}>{user.role || 'Unknown'}</option>}
        </select>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 800, color: rc.color, background: rc.bg, borderRadius: 99, padding: '4px 10px' }}>{rc.label}</span>
      )}
      {isAdmin && (
        <button onClick={() => onRemove(user)} disabled={busy || isSelf || isOwner}
          title={isSelf ? "You can't remove yourself" : isOwner ? "The owner can't be removed here" : 'Remove'}
          style={{ border: 'none', background: 'none', cursor: (isSelf || isOwner) ? 'default' : 'pointer', fontSize: 14, opacity: (isSelf || isOwner) ? 0.3 : 0.7, padding: 4 }}>
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

        {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, fontWeight: 600 }}><Icon name="⚠️" /> {error}</div>}

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

  const filtered = NAV.filter(n => (!search || n.label.toLowerCase().includes(search.toLowerCase())) && (!n.requiresBranding || brandingEnabled || isAdmin) && (!n.requiresAdmin || isAdmin))
  const groups = GROUPS.map(g => ({ group: g, items: filtered.filter(n => n.group === g) })).filter(g => g.items.length > 0)

  const renderContent = () => {
    switch(active) {
      case 'organisation':   return isAdmin ? <OrgSection org={org} /> : (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface2)', borderRadius: 16, border: '1.5px dashed #CBD5E1' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><Icon name="🔒" /></div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Admins only</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>Organisation settings can only be changed by an admin. Ask your organisation's admin if you need something updated here.</div>
        </div>
      )
      case 'branding':       return brandingEnabled ? (isAdmin ? <BrandingCentre key={org.id} org={org} refreshOrg={refreshOrg} /> : (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface2)', borderRadius: 16, border: '1.5px dashed #CBD5E1' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><Icon name="🎨" /></div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Admin access required</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>Branding can only be changed by an admin. Ask your organisation's admin if you need something updated here.</div>
        </div>
      )) : (
        <div style={{ background: '#07120E', color: '#F7F5EC', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 26px 70px rgba(7,18,14,0.18)' }}>
          <div style={{ padding: isMobile ? 26 : 34, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.1fr) minmax(260px,.9fr)', gap: 26, alignItems: 'center', background: `radial-gradient(circle at 15% 0%, ${(org?.primary_color || '#1B9AAA')}66, transparent 45%), #07120E` }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.16)', color: '#D9E8DC', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 }}>
                <Icon name="🎨" /> Premium add-on
              </div>
              <h2 style={{ margin: 0, fontSize: isMobile ? 28 : 38, lineHeight: 1.05, letterSpacing: -1.1, color: '#fff' }}>Make LaunchSession feel like your organisation.</h2>
              <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.7, color: '#C9D7CE', maxWidth: 580 }}>The Branding Centre turns a generic workspace into a polished member, parent and staff experience, with control over the places people actually see.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
                <a href="mailto:hello@launchsession.co.uk?subject=Enable%20Branding%20Centre" style={{ padding: '12px 18px', borderRadius: 10, background: '#F7F5EC', color: '#07120E', fontWeight: 900, fontSize: 13, textDecoration: 'none' }}>Enable Branding Centre</a>
                <a href="mailto:hello@launchsession.co.uk?subject=Branding%20Centre%20demo" style={{ padding: '12px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#F7F5EC', border: '1px solid rgba(255,255,255,0.16)', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Ask for a walkthrough</a>
              </div>
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 13 }}>What unlocks</div>
              {BRANDING_PREMIUM_FEATURES.map(([title, text]) => (
                <div key={title} style={{ display: 'flex', gap: 11, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.12)', color: '#BFE8D1', fontSize: 11, flexShrink: 0 }}>✓</span>
                  <span><strong style={{ display: 'block', fontSize: 12.5, color: '#fff' }}>{title}</strong><span style={{ display: 'block', color: '#BDCCC3', fontSize: 11.5, lineHeight: 1.55, marginTop: 3 }}>{text}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
      case 'display':        return isAdmin ? <SidebarDisplayCard org={org} isAdmin={isAdmin} /> : (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface2)', borderRadius: 16, border: '1.5px dashed #CBD5E1' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><Icon name="🔒" /></div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Admins only</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>The sidebar is shared by everyone in the organisation, so only an admin can change what appears in it.</div>
        </div>
      )
      case 'users':           return <UsersSection org={org} session={session} isAdmin={isAdmin} currentUserId={session?.user?.id} />
      case 'access':         return <AccessSection org={org} isAdmin={isAdmin} />
      case 'security':       return <SecuritySection />
      case 'notifications':  return <NotificationsSection org={org} session={session} />
      case 'integrations':   return <IntegrationsSection />
      case 'billing':        return <BillingSection org={org} session={session} isAdmin={isAdmin} refreshOrg={refreshOrg} />
      case 'registers':      return <GroupsSection org={org} refreshOrg={refreshOrg} />
      case 'sessions':       return <VenuesSection org={org} isAdmin={isAdmin} />
      case 'safeguarding':   return <SafeguardingSection org={org} />
      case 'help':           return <HelpSection />
      default:               return <ComingSoon label={NAV.find(n => n.key === active)?.label || active} />
    }
  }

  const current = NAV.find(n => n.key === active)
  if (initialSection === 'branding') return renderContent()

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: 'var(--surface2)' }}>

      {/* MOBILE NAV TOGGLE */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => setShowSidebar(!showSidebar)} style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text2)' }}>
            {showSidebar ? '✕ Close' : '☰ Settings'}
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{NAV.find(n => n.key === active)?.icon} {NAV.find(n => n.key === active)?.label}</div>
        </div>
      )}

      {/* SETTINGS SIDEBAR */}
      <div style={{ width: isMobile ? '100%' : 190, background: 'var(--surface)', borderRight: isMobile ? 'none' : '1px solid #e5e7eb', borderBottom: isMobile ? '1px solid #e5e7eb' : 'none', display: isMobile ? (showSidebar ? 'flex' : 'none') : 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: isMobile ? 320 : 'none', overflowY: isMobile ? 'auto' : 'visible', position: isMobile ? 'static' : 'sticky', top: isMobile ? 'auto' : 0, alignSelf: isMobile ? 'auto' : 'flex-start' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}><Icon name="⚙️" /> Settings</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-faint)' }}><Icon name="🔍" /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search settings..."
              style={{ width: '100%', padding: '7px 9px 7px 28px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: 'var(--surface2)' }} />
          </div>
        </div>
        <div style={{ padding: '8px 8px', flex: 1 }}>
          {groups.map(({ group, items }) => (
            <div key={group} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px 4px' }}>{group}</div>
              {items.map(n => (
                <button key={n.key} onClick={() => { setActive(n.key); if (isMobile) setShowSidebar(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: active === n.key ? `${org?.primary_color || '#1B9AAA'}12` : 'transparent', color: active === n.key ? (org?.primary_color || '#1B9AAA') : '#374151', fontSize: 13, fontWeight: active === n.key ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 1, transition: 'all 0.1s' }}
                  onMouseEnter={e => { if (active !== n.key) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (active !== n.key) e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ fontSize: 15 }}><Icon name={n.icon} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>{n.label}</span>
                  {n.requiresBranding && !brandingEnabled && (
                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: .7, color: '#8A5C00', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 999, padding: '3px 6px', textTransform: 'uppercase' }}>Premium</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, minWidth: 0, padding: isMobile ? '16px' : '24px' }}>
        <div style={{ maxWidth: active === 'branding' ? 'none' : 700 }}>
          <div style={{ marginBottom: 20, display: active === 'branding' ? 'none' : 'block' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{current?.icon} {current?.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Manage your {current?.label?.toLowerCase()} settings</div>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
