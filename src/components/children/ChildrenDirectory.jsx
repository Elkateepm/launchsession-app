import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import PageHeader from '../shared/PageHeader'
import { Avatar, glass, inputStyle, btnGhost, btnPrimary } from '../volunteers/vh_shared'

const CONSENT_TYPES = [
  { key: 'photo', label: 'Photo consent' },
  { key: 'trip', label: 'Trip consent' },
  { key: 'medical', label: 'Medical consent' },
  { key: 'data_sharing', label: 'Data sharing' },
]

function age(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob)) / 3.15576e10)
}

function medicalAlerts(child) {
  const chips = []
  if (child.allergies) chips.push({ label: 'Allergy', color: '#B45309', bg: '#FEF3C7' })
  if (child.has_asthma) chips.push({ label: 'Asthma', color: '#B91C1C', bg: '#FEE2E2' })
  if (child.has_diabetes) chips.push({ label: 'Diabetes', color: '#B91C1C', bg: '#FEE2E2' })
  if (child.takes_medication || child.has_medication) chips.push({ label: 'Medication', color: '#6D28D9', bg: '#EDE9FE' })
  if (child.has_epipen) chips.push({ label: 'EpiPen', color: '#B91C1C', bg: '#FEE2E2' })
  return chips
}

function hasMedicalAlert(child) {
  return medicalAlerts(child).length > 0
}

export default function ChildrenDirectory({ org, session, onNavigate }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'
  const authUserId = session?.user?.id
  const { groups: orgGroups } = useOrgSettings(org?.id)

  const [children, setChildren] = useState([])
  const [consents, setConsents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [sessionNotes, setSessionNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: kids }, { data: cons }, { data: att }, { data: notes }] = await Promise.all([
      supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('first_name'),
      supabase.from('child_consents').select('*').eq('org_id', org.id),
      supabase.from('attendance').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(3000),
      supabase.from('session_notes').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(500),
    ])
    setChildren(kids || [])
    setConsents(cons || [])
    setAttendance(att || [])
    setSessionNotes(notes || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  // Latest attendance row per child — used for on-site status + last-active
  const latestAttByChild = useMemo(() => {
    const map = {}
    for (const a of attendance) {
      if (!map[a.child_id] || new Date(a.created_at) > new Date(map[a.child_id].created_at)) map[a.child_id] = a
    }
    return map
  }, [attendance])

  const consentsByChild = useMemo(() => {
    const map = {}
    for (const c of consents) { (map[c.child_id] = map[c.child_id] || {})[c.consent_type] = c }
    return map
  }, [consents])

  const consentIssue = useCallback((childId) => {
    const rec = consentsByChild[childId] || {}
    return CONSENT_TYPES.some(t => rec[t.key]?.status !== 'granted')
  }, [consentsByChild])

  const thirtyDaysAgo = Date.now() - 30 * 86400000
  const activeThisMonthIds = useMemo(() => new Set(attendance.filter(a => new Date(a.created_at).getTime() >= thirtyDaysAgo).map(a => a.child_id)), [attendance, thirtyDaysAgo])

  const stats = useMemo(() => ({
    total: children.length,
    activeThisMonth: children.filter(c => activeThisMonthIds.has(c.id)).length,
    onSite: children.filter(c => latestAttByChild[c.id]?.status === 'signed_in').length,
    incomplete: children.filter(c => c.profile_incomplete).length,
    medical: children.filter(hasMedicalAlert).length,
    consentIssues: children.filter(c => consentIssue(c.id)).length,
  }), [children, activeThisMonthIds, latestAttByChild, consentIssue])

  const groupLabel = (name) => (orgGroups || []).find(g => (g.label || '').toLowerCase() === (name || '').trim().toLowerCase())?.label

  const filtered = useMemo(() => {
    let list = children
    if (groupFilter !== 'all') list = list.filter(c => (c.group_name || '').toLowerCase() === groupFilter.toLowerCase())
    if (quickFilter === 'onsite') list = list.filter(c => latestAttByChild[c.id]?.status === 'signed_in')
    if (quickFilter === 'medical') list = list.filter(hasMedicalAlert)
    if (quickFilter === 'consent') list = list.filter(c => consentIssue(c.id))
    if (quickFilter === 'incomplete') list = list.filter(c => c.profile_incomplete)
    if (quickFilter === 'active') list = list.filter(c => activeThisMonthIds.has(c.id))
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.parent_name || '').toLowerCase().includes(q) ||
        (c.parent_phone || '').includes(q) ||
        (c.school || '').toLowerCase().includes(q) ||
        (c.group_name || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [children, groupFilter, quickFilter, search, latestAttByChild, consentIssue, activeThisMonthIds])

  const selected = children.find(c => c.id === selectedId) || null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F6F8FC' }}>
      <PageHeader
        icon="🧒"
        title="Children & Young People"
        subtitle="Manage participant records, safety information, attendance and family contacts."
        primary={primary}
        orgName={org?.name}
        stats={[
          { label: 'Total', value: stats.total, icon: '👥' },
          { label: 'Active this month', value: stats.activeThisMonth, icon: '📈', color: '#059669' },
          { label: 'On site now', value: stats.onSite, icon: '📍', color: '#2563EB' },
          { label: 'Profiles incomplete', value: stats.incomplete, icon: '⚠️', color: '#D97706' },
          { label: 'Medical alerts', value: stats.medical, icon: '❤️', color: '#DC2626' },
          { label: 'Consent issues', value: stats.consentIssues, icon: '🔏', color: '#7C3AED' },
        ]}
        actions={[{ label: 'Add young person', icon: '+', variant: 'primary', onClick: () => setShowAdd(true) }]}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 24 }}>
        {/* Quick-filter chips mirroring the stat cards */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            [null, 'All'],
            ['active', 'Active this month'],
            ['onsite', 'On site now'],
            ['medical', 'Medical alerts'],
            ['consent', 'Consent issues'],
            ['incomplete', 'Profiles incomplete'],
          ].map(([key, label]) => (
            <button key={label} onClick={() => setQuickFilter(key)}
              style={{ padding: '7px 14px', borderRadius: 99, border: quickFilter === key ? `2px solid ${primary}` : '1px solid rgba(15,23,42,0.1)', background: quickFilter === key ? `${primary}14` : '#fff', color: quickFilter === key ? primary : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Search + group filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
            <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search by name, parent, school, group…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select style={{ ...inputStyle, width: 170 }} value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
            <option value="all">All groups</option>
            {(orgGroups || []).map(g => <option key={g.id || g.label} value={g.label}>{g.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : selected ? '1fr 1.6fr' : '1fr', gap: 16, alignItems: 'start' }}>
          {/* LIST */}
          {(!isMobile || !selected) && (
            <div style={glass({ padding: 0, overflow: 'hidden' })}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>
                {loading ? 'Loading…' : `${filtered.length} young ${filtered.length === 1 ? 'person' : 'people'}`}
              </div>
              {filtered.length === 0 && !loading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🧒</div>
                  <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>No young people found</div>
                  <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Try adjusting your search or filters.</div>
                </div>
              ) : (
                <div style={{ maxHeight: 640, overflowY: 'auto' }}>
                  {filtered.map(c => {
                    const isSelected = selectedId === c.id
                    const onSite = latestAttByChild[c.id]?.status === 'signed_in'
                    const chips = medicalAlerts(c)
                    return (
                      <div key={c.id} onClick={() => setSelectedId(c.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer', background: isSelected ? `${primary}0c` : 'transparent', borderLeft: `3px solid ${isSelected ? primary : 'transparent'}` }}>
                        <Avatar name={`${c.first_name} ${c.last_name}`} photoUrl={c.photo_url} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.first_name} {c.last_name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>
                            {age(c.date_of_birth) != null ? `Age ${age(c.date_of_birth)} · ` : ''}{groupLabel(c.group_name) || 'Ungrouped'}
                          </div>
                          {chips.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              {chips.map(ch => <span key={ch.label} style={{ fontSize: 9.5, fontWeight: 800, color: ch.color, background: ch.bg, borderRadius: 99, padding: '1px 7px' }}>{ch.label}</span>)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: onSite ? '#15803D' : '#94A3B8', background: onSite ? '#DCFCE7' : '#F1F5F9', borderRadius: 99, padding: '2px 8px' }}>{onSite ? '● On site' : 'Not on site'}</span>
                          {consentIssue(c.id) && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', borderRadius: 99, padding: '1px 7px' }}>Consent due</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* PROFILE */}
          {selected && (
            <ChildProfile
              child={selected}
              org={org}
              primary={primary}
              authUserId={authUserId}
              groupLabel={groupLabel(selected.group_name)}
              consentRec={consentsByChild[selected.id] || {}}
              latestAtt={latestAttByChild[selected.id]}
              notes={sessionNotes.filter(n => n.child_id === selected.id).slice(0, 5)}
              attendanceForChild={attendance.filter(a => a.child_id === selected.id)}
              onBack={() => setSelectedId(null)}
              onNavigate={onNavigate}
              onConsentChanged={load}
              onChildUpdated={load}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>

      {showAdd && <AddChildQuickModal org={org} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function ChildProfile({ child, org, primary, authUserId, groupLabel, consentRec, latestAtt, notes, attendanceForChild, onBack, onNavigate, onConsentChanged, isMobile }) {
  const [savingConsent, setSavingConsent] = useState(null)

  const toggleConsent = async (type) => {
    setSavingConsent(type)
    const existing = consentRec[type]
    const nextStatus = existing?.status === 'granted' ? 'not_granted' : 'granted'
    await supabase.from('child_consents').upsert({
      org_id: org.id, child_id: child.id, consent_type: type, status: nextStatus,
      granted_by: nextStatus === 'granted' ? authUserId : null,
      granted_at: nextStatus === 'granted' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'child_id,consent_type' })
    setSavingConsent(null)
    onConsentChanged()
  }

  const signedInCount = attendanceForChild.filter(a => a.status === 'signed_in' || a.status === 'signed_out').length
  const absenceCount = attendanceForChild.filter(a => a.status === 'absent').length

  const Row = ({ label, value }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 12.5 }}>
      <span style={{ color: '#64748B' }}>{label}</span><span style={{ fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{value}</span>
    </div>
  ) : null

  return (
    <div style={glass({ padding: 20 })}>
      {isMobile && <button onClick={onBack} style={{ ...btnGhost, marginBottom: 12, fontSize: 12, padding: '6px 12px' }}>← Back to directory</button>}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
        <Avatar name={`${child.first_name} ${child.last_name}`} photoUrl={child.photo_url} size={56} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A' }}>{child.first_name} {child.last_name}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            {age(child.date_of_birth) != null && `Age ${age(child.date_of_birth)} · `}
            {child.date_of_birth && `DOB ${new Date(child.date_of_birth).toLocaleDateString('en-GB')} · `}
            {groupLabel || 'Ungrouped'}
          </div>
          {child.has_behaviour_plan && <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10.5, fontWeight: 800, background: '#FEF3C7', color: '#B45309', borderRadius: 99, padding: '2px 9px' }}>Support Plan</span>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: latestAtt?.status === 'signed_in' ? '#15803D' : '#64748B', background: latestAtt?.status === 'signed_in' ? '#DCFCE7' : '#F1F5F9', borderRadius: 99, padding: '4px 10px' }}>
          {latestAtt?.status === 'signed_in' ? '● Signed in' : latestAtt?.status === 'signed_out' ? 'Signed out' : latestAtt?.status === 'absent' ? 'Absent' : 'No recent activity'}
        </span>
      </div>

      {/* Alert banners */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#B91C1C', marginBottom: 6 }}>❤️ Medical alerts</div>
          {medicalAlerts(child).length === 0 ? <div style={{ fontSize: 11.5, color: '#94A3B8' }}>None recorded</div> : (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {medicalAlerts(child).map(ch => <span key={ch.label} style={{ fontSize: 10.5, fontWeight: 800, color: ch.color, background: ch.bg, borderRadius: 99, padding: '2px 8px' }}>{ch.label}</span>)}
            </div>
          )}
          {child.medication_details && <div style={{ fontSize: 11, color: '#7F1D1D' }}>{child.medication_details}</div>}
        </div>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#B45309', marginBottom: 6 }}>🛡️ Safeguarding / Support</div>
          <div style={{ fontSize: 11.5, color: child.has_behaviour_plan ? '#92400E' : '#94A3B8' }}>{child.has_behaviour_plan ? 'Support plan in place' : 'None recorded'}</div>
          {child.behaviour_plan_notes && <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>{child.behaviour_plan_notes}</div>}
        </div>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#15803D', marginBottom: 6 }}>🚗 Collection / Travel</div>
          <div style={{ fontSize: 11.5, color: '#166534' }}>{child.travel_consent ? 'Can travel home' : 'Must be collected'}</div>
          {child.collection_restricted && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4, fontWeight: 700 }}>⚠ Collection restricted{child.collection_restriction_note ? `: ${child.collection_restriction_note}` : ''}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        {/* About */}
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>👤 About</div>
          <Row label="School / Setting" value={child.school} />
          <Row label="SEN" value={child.sen} />
          <Row label="Membership" value={child.is_walk_in ? 'Walk-in' : 'Standard'} />
          {child.notes && <div style={{ fontSize: 12, color: '#334155', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(15,23,42,0.06)' }}>{child.notes}</div>}
        </div>

        {/* Contacts */}
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>📞 Contacts</div>
          <Row label="Parent / Carer" value={child.parent_name} />
          <Row label="Phone" value={child.parent_phone} />
          <Row label="Emergency contact" value={child.emergency_contact_name} />
          <Row label="Emergency phone" value={child.emergency_contact_phone} />
          {child.parent_phone && (
            <a href={`tel:${child.parent_phone}`} style={{ display: 'inline-block', marginTop: 8, padding: '7px 14px', borderRadius: 9, border: `1px solid ${primary}40`, color: primary, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>📞 Call parent</a>
          )}
        </div>

        {/* Consents */}
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>✅ Permissions & Consents</div>
          {CONSENT_TYPES.map(t => {
            const rec = consentRec[t.key]
            const granted = rec?.status === 'granted'
            return (
              <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontSize: 12.5, color: '#334155' }}>{t.label}</span>
                <button onClick={() => toggleConsent(t.key)} disabled={savingConsent === t.key}
                  style={{ fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '3px 10px', border: 'none', cursor: 'pointer', color: granted ? '#15803D' : '#94A3B8', background: granted ? '#DCFCE7' : '#F1F5F9' }}>
                  {savingConsent === t.key ? '…' : granted ? '✓ Granted' : 'Not granted'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Medical & Safety */}
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>🩹 Medical & Safety</div>
          <Row label="Allergies" value={child.allergies} />
          <Row label="Medical notes" value={child.medical_notes} />
          <Row label="Medication" value={child.medication_details} />
        </div>

        {/* Session Notes */}
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>📝 Session Notes</div>
          {notes.length === 0 ? <div style={{ fontSize: 12, color: '#94A3B8' }}>No notes recorded yet.</div> : notes.map(n => (
            <div key={n.id} style={{ padding: '7px 0', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
              <div style={{ fontSize: 11.5, color: '#334155' }}>{n.content}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{new Date(n.created_at).toLocaleDateString('en-GB')}</div>
            </div>
          ))}
        </div>

        {/* Session Summary */}
        <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>📊 Session Summary</div>
          <Row label="Total attended" value={signedInCount} />
          <Row label="Absences" value={absenceCount} />
          {latestAtt && <Row label="Last activity" value={new Date(latestAtt.created_at).toLocaleDateString('en-GB')} />}
        </div>
      </div>

      {child.parent_phone && (
        <a href={`sms:${child.parent_phone}`} style={{ display: 'inline-block', marginTop: 16, padding: '10px 18px', borderRadius: 10, textDecoration: 'none', ...btnPrimary(primary) }}>✉️ Message parent</a>
      )}
    </div>
  )
}

function AddChildQuickModal({ org, onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', group_name: '', parent_name: '', parent_phone: '', school: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.first_name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('children').insert({
      org_id: org.id, first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null, group_name: form.group_name || null,
      parent_name: form.parent_name || null, parent_phone: form.parent_phone || null, school: form.school || null,
      active: true, profile_incomplete: !form.date_of_birth || !form.parent_phone,
    })
    setSaving(false)
    if (!error) onAdded()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', marginBottom: 14 }}>Add young person</div>
        {[
          ['first_name', 'First name *'], ['last_name', 'Last name'], ['date_of_birth', 'Date of birth', 'date'],
          ['group_name', 'Group'], ['school', 'School'], ['parent_name', 'Parent / carer name'], ['parent_phone', 'Parent / carer phone'],
        ].map(([key, label, type]) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
            <input type={type || 'text'} value={form[key]} onChange={e => set(key, e.target.value)} style={inputStyle} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, ...btnGhost }}>Cancel</button>
          <button onClick={save} disabled={saving || !form.first_name.trim()} style={{ flex: 1, ...btnPrimary('#7C5CFC'), border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Add'}</button>
        </div>
      </div>
    </div>
  )
}
