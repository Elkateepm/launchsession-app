import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useOrgSettings } from '../../hooks/useOrgSettings'
import { PeopleHeader, PeopleTabs, PeopleSummary, PeopleRoster, PeopleProfileDrawer } from './PeopleWorkspace'
import QRShareSheet from '../shared/QRShareSheet'
import { Avatar, glass, inputStyle, btnGhost, btnPrimary } from '../volunteers/vh_shared'
import ChildPaymentsCard from '../payments/ChildPaymentsCard'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'
import { readableDbError } from '../../lib/dbErrors'

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

export default function ChildrenDirectory({ org, session, onNavigate, initialOpenRequestsTab }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#7C5CFC'
  const authUserId = session?.user?.id
  const { groups: orgGroups } = useOrgSettings(org?.id)

  const terms = useTerms()
  const [children, setChildren] = useState([])
  const [consents, setConsents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [sessionNotes, setSessionNotes] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState(null)
  const [sort, setSort] = useState('name')
  const [selectedId, setSelectedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [mainTab, setMainTab] = useState(initialOpenRequestsTab ? 'requests' : 'directory')

  // A bell/push tap for a new registration lands here with the flag set —
  // jump straight to the Requests tab instead of making the admin find it.
  useEffect(() => {
    if (initialOpenRequestsTab) setMainTab('requests')
  }, [initialOpenRequestsTab])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: kids }, { data: cons }, { data: att }, { data: notes }, { data: regs }] = await Promise.all([
      supabase.from('children').select('*').eq('org_id', org.id).eq('active', true).order('first_name'),
      supabase.from('child_consents').select('*').eq('org_id', org.id),
      supabase.from('attendance').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(3000),
      supabase.from('session_notes').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('child_registration_requests').select('*').eq('org_id', org.id).order('submitted_at', { ascending: false }),
    ])
    setChildren(kids || [])
    setConsents(cons || [])
    setAttendance(att || [])
    setSessionNotes(notes || [])
    setRegistrations(regs || [])
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
    pendingRegs: registrations.filter(r => r.status === 'pending').length,
    attention: children.filter(c => c.profile_incomplete || consentIssue(c.id)).length,
  }), [children, activeThisMonthIds, latestAttByChild, consentIssue, registrations])

  const groupLabel = (name) => (orgGroups || []).find(g => (g.label || '').toLowerCase() === (name || '').trim().toLowerCase())?.label || (name || '').trim()
  const groupOptions = useMemo(() => {
    const names = new Map()
    for (const name of [...(orgGroups || []).map(g => g.label), ...children.map(c => c.group_name)]) {
      const label = (name || '').trim()
      if (label && !names.has(label.toLowerCase())) names.set(label.toLowerCase(), label)
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'en-GB'))
  }, [orgGroups, children])

  const filtered = useMemo(() => {
    let list = children
    if (groupFilter === '__ungrouped') list = list.filter(c => !(c.group_name || '').trim())
    else if (groupFilter !== 'all') list = list.filter(c => (c.group_name || '').trim().toLowerCase() === groupFilter.toLowerCase())
    if (quickFilter === 'onsite') list = list.filter(c => latestAttByChild[c.id]?.status === 'signed_in')
    if (quickFilter === 'medical') list = list.filter(hasMedicalAlert)
    if (quickFilter === 'consent') list = list.filter(c => consentIssue(c.id))
    if (quickFilter === 'incomplete') list = list.filter(c => c.profile_incomplete)
    if (quickFilter === 'attention') list = list.filter(c => c.profile_incomplete || consentIssue(c.id))
    if (quickFilter === 'active') list = list.filter(c => activeThisMonthIds.has(c.id))
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.parent_name || '').toLowerCase().includes(q) ||
        (c.parent_phone || '').includes(q) ||
        (c.parent_email || '').toLowerCase().includes(q) ||
        (c.school || '').toLowerCase().includes(q) ||
        (c.group_name || '').toLowerCase().includes(q)
      )
    }
    const nameOf = c => `${c.first_name || ''} ${c.last_name || ''}`.trim()
    return [...list].sort((a, b) => {
      if (sort === 'recent') {
        const difference = (Date.parse(latestAttByChild[b.id]?.created_at) || 0) - (Date.parse(latestAttByChild[a.id]?.created_at) || 0)
        if (difference) return difference
      }
      if (sort === 'surname') return `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(`${b.last_name || ''} ${b.first_name || ''}`, 'en-GB')
      if (sort === 'group') {
        const difference = (a.group_name || '\uffff').localeCompare(b.group_name || '\uffff', 'en-GB')
        if (difference) return difference
      }
      return nameOf(a).localeCompare(nameOf(b), 'en-GB')
    })
  }, [children, groupFilter, quickFilter, search, latestAttByChild, consentIssue, activeThisMonthIds, sort])

  const selected = children.find(c => c.id === selectedId) || null

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg, #F6F8FC)', padding: isMobile ? 16 : 28, boxSizing: 'border-box' }}>
      <PeopleHeader
        terms={terms} primary={primary} stats={stats} loading={loading}
        onAdd={() => setShowAdd(true)} onInvite={() => setShowInvite(true)}
        onQR={() => setShowQR(true)} onOnSite={() => setMainTab('onsite')}
      />
      <PeopleTabs terms={terms} stats={stats} value={mainTab} onChange={setMainTab} />
      <div style={{ paddingTop: 22 }}>
        {mainTab === 'directory' && <>
          <PeopleSummary terms={terms} stats={stats} primary={primary} loading={loading} value={quickFilter} onChange={setQuickFilter} />
          <PeopleRoster
            records={filtered} total={children.length} terms={terms} primary={primary} loading={loading}
            search={search} onSearch={setSearch} groupFilter={groupFilter} groups={groupOptions} onGroup={setGroupFilter}
            quickFilter={quickFilter} onFilter={setQuickFilter} sort={sort} onSort={setSort}
            onClear={() => { setSearch(''); setGroupFilter('all'); setQuickFilter(null) }}
            onOpen={setSelectedId} onAdd={() => setShowAdd(true)} groupLabel={groupLabel}
            latestAttByChild={latestAttByChild} medicalAlerts={medicalAlerts} consentIssue={consentIssue} age={age}
          />
        </>}
        {mainTab === 'onsite' && (
          <OnSiteTab children={children} latestAttByChild={latestAttByChild} groupLabel={groupLabel} primary={primary} org={org} authUserId={authUserId} onReload={load} />
        )}
        {mainTab === 'groups' && (
          <GroupsTab children={children} orgGroups={orgGroups} latestAttByChild={latestAttByChild} primary={primary} onSelectGroup={g => { setGroupFilter(g); setMainTab('directory') }} />
        )}
        {mainTab === 'consents' && (
          <ConsentsTab children={children.filter(c => consentIssue(c.id))} consentsByChild={consentsByChild} groupLabel={groupLabel} primary={primary} onOpenChild={setSelectedId} />
        )}
        {mainTab === 'medical' && (
          <MedicalTab children={children.filter(hasMedicalAlert)} groupLabel={groupLabel} primary={primary} onOpenChild={setSelectedId} />
        )}
        {mainTab === 'requests' && (
          <RegistrationRequestsTab registrations={registrations} org={org} authUserId={authUserId} primary={primary} onReload={load} />
        )}
      </div>
      {selected && <PeopleProfileDrawer name={`${selected.first_name} ${selected.last_name}`} onClose={() => setSelectedId(null)}>
        <ChildProfile
          key={selected.id} child={selected} org={org} session={session} primary={primary} authUserId={authUserId}
          groupLabel={groupLabel(selected.group_name)} consentRec={consentsByChild[selected.id] || {}}
          latestAtt={latestAttByChild[selected.id]}
          notes={sessionNotes.filter(n => n.child_id === selected.id).slice(0, 5)}
          attendanceForChild={attendance.filter(a => a.child_id === selected.id)}
          onNavigate={onNavigate} onConsentChanged={load} isMobile={isMobile}
        />
      </PeopleProfileDrawer>}
      {showAdd && <AddChildQuickModal org={org} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
      {showInvite && <InviteParentModal org={org} onClose={() => setShowInvite(false)} />}
      {showQR && <QRShareSheet org={org} onClose={() => setShowQR(false)} />}
    </div>
  )
}

function ChildProfile({ child, org, session, primary, authUserId, groupLabel, consentRec, latestAtt, notes, attendanceForChild, onNavigate, onConsentChanged, isMobile }) {
  const [savingConsent, setSavingConsent] = useState(null)
  const [editingContact, setEditingContact] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [contact, setContact] = useState({ parent_name: child.parent_name || '', parent_phone: child.parent_phone || '', parent_email: child.parent_email || '' })

  const saveContact = async () => {
    setSavingContact(true)
    const { error } = await supabase.from('children').update({
      parent_name: contact.parent_name.trim() || null,
      parent_phone: contact.parent_phone.trim() || null,
      parent_email: contact.parent_email.trim() || null,
    }).eq('id', child.id)
    setSavingContact(false)
    if (!error) {
      child.parent_name = contact.parent_name.trim() || null
      child.parent_phone = contact.parent_phone.trim() || null
      child.parent_email = contact.parent_email.trim() || null
      setEditingContact(false)
    }
  }

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
      <span style={{ color: 'var(--text3)' }}>{label}</span><span style={{ fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  ) : null

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid #E3E8F0', padding: isMobile ? 16 : 22 }}>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
        <Avatar name={`${child.first_name} ${child.last_name}`} photoUrl={child.photo_url} size={56} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--text)' }}>{child.first_name} {child.last_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
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
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#B91C1C', marginBottom: 6 }}><Icon name="❤️" /> Medical alerts</div>
          {medicalAlerts(child).length === 0 ? <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>None recorded</div> : (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {medicalAlerts(child).map(ch => <span key={ch.label} style={{ fontSize: 10.5, fontWeight: 800, color: ch.color, background: ch.bg, borderRadius: 99, padding: '2px 8px' }}>{ch.label}</span>)}
            </div>
          )}
          {child.medication_details && <div style={{ fontSize: 11, color: '#7F1D1D' }}>{child.medication_details}</div>}
        </div>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#B45309', marginBottom: 6 }}><Icon name="🛡️" /> Safeguarding / Support</div>
          <div style={{ fontSize: 11.5, color: child.has_behaviour_plan ? '#92400E' : '#94A3B8' }}>{child.has_behaviour_plan ? 'Support plan in place' : 'None recorded'}</div>
          {child.behaviour_plan_notes && <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>{child.behaviour_plan_notes}</div>}
        </div>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#15803D', marginBottom: 6 }}><Icon name="🚗" /> Collection / Travel</div>
          <div style={{ fontSize: 11.5, color: '#166534' }}>{child.travel_consent ? 'Can travel home' : 'Must be collected'}</div>
          {child.collection_restricted && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4, fontWeight: 700 }}>⚠ Collection restricted{child.collection_restriction_note ? `: ${child.collection_restriction_note}` : ''}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        {/* About */}
        <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}><Icon name="👤" /> About</div>
          <Row label="School / Setting" value={child.school} />
          <Row label="SEN" value={child.sen} />
          <Row label="Membership" value={child.is_walk_in ? 'Walk-in' : 'Standard'} />
          {child.notes && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(15,23,42,0.06)' }}>{child.notes}</div>}
        </div>

        {/* Contacts */}
        <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}><Icon name="📞" /> Contacts</div>
            {!editingContact && (
              <button onClick={() => setEditingContact(true)} style={{ background: 'none', border: 'none', color: primary, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><Icon name="✏️" /> Edit</button>
            )}
          </div>
          {editingContact ? (
            <div>
              {[['parent_name', 'Parent / carer name', 'text'], ['parent_phone', 'Phone', 'text'], ['parent_email', 'Email', 'email']].map(([key, lbl, type]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: 3 }}>{lbl}</label>
                  <input type={type} value={contact[key]} onChange={e => setContact(c => ({ ...c, [key]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 12.5, outline: 'none' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => { setContact({ parent_name: child.parent_name || '', parent_phone: child.parent_phone || '', parent_email: child.parent_email || '' }); setEditingContact(false) }}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveContact} disabled={savingContact}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{savingContact ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <>
              <Row label="Parent / Carer" value={child.parent_name} />
              <Row label="Phone" value={child.parent_phone} />
              <Row label="Email" value={child.parent_email} />
              <Row label="Emergency contact" value={child.emergency_contact_name} />
              <Row label="Emergency phone" value={child.emergency_contact_phone} />
              {!child.parent_email && <div style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}><Icon name="⚠" /> No email on file — add one to enable emailing this parent.</div>}
              {child.parent_phone && (
                <a href={`tel:${child.parent_phone}`} style={{ display: 'inline-block', marginTop: 8, padding: '7px 14px', borderRadius: 9, border: `1px solid var(--org-a20)`, color: primary, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}><Icon name="📞" /> Call parent</a>
              )}
            </>
          )}
        </div>

        {/* Consents */}
        <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}><Icon name="✅" /> Permissions & Consents</div>
          {CONSENT_TYPES.map(t => {
            const rec = consentRec[t.key]
            const granted = rec?.status === 'granted'
            return (
              <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{t.label}</span>
                <button onClick={() => toggleConsent(t.key)} disabled={savingConsent === t.key}
                  style={{ fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '3px 10px', border: 'none', cursor: 'pointer', color: granted ? '#15803D' : '#94A3B8', background: granted ? '#DCFCE7' : '#F1F5F9' }}>
                  {savingConsent === t.key ? '…' : granted ? '✓ Granted' : 'Not granted'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Medical & Safety */}
        <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}><Icon name="🩹" /> Medical & Safety</div>
          <Row label="Allergies" value={child.allergies} />
          <Row label="Medical notes" value={child.medical_notes} />
          <Row label="Medication" value={child.medication_details} />
        </div>

        {/* Session Notes */}
        <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}><Icon name="📝" /> Session Notes</div>
          {notes.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No notes recorded yet.</div> : notes.map(n => (
            <div key={n.id} style={{ padding: '7px 0', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{n.content}</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{new Date(n.created_at).toLocaleDateString('en-GB')}</div>
            </div>
          ))}
        </div>

        {/* Session Summary */}
        <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}><Icon name="📊" /> Session Summary</div>
          <Row label="Total attended" value={signedInCount} />
          <Row label="Absences" value={absenceCount} />
          {latestAtt && <Row label="Last activity" value={new Date(latestAtt.created_at).toLocaleDateString('en-GB')} />}
        </div>

        {/* Payments */}
        <ChildPaymentsCard org={org} session={session} child={child} />
      </div>

      {child.parent_phone && (
        <a href={`sms:${child.parent_phone}`} style={{ display: 'inline-block', marginTop: 16, padding: '10px 18px', borderRadius: 10, textDecoration: 'none', ...btnPrimary(primary) }}><Icon name="✉️" /> Message parent</a>
      )}
    </div>
  )
}

function AddChildQuickModal({ org, onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', group_name: '', parent_name: '', parent_phone: '', parent_email: '', school: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.first_name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('children').insert({
      org_id: org.id, first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth || null, group_name: form.group_name || null,
      parent_name: form.parent_name || null, parent_phone: form.parent_phone || null,
      parent_email: form.parent_email.trim() || null, school: form.school || null,
      active: true, profile_incomplete: !form.date_of_birth || !form.parent_phone,
    })
    setSaving(false)
    if (!error) onAdded()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 14 }}>Add young person</div>
        {[
          ['first_name', 'First name *'], ['last_name', 'Last name'], ['date_of_birth', 'Date of birth', 'date'],
          ['group_name', 'Group'], ['school', 'School'], ['parent_name', 'Parent / carer name'], ['parent_phone', 'Parent / carer phone'],
          ['parent_email', 'Parent / carer email', 'email'],
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

function OnSiteTab({ children, latestAttByChild, groupLabel, primary, org, authUserId, onReload }) {
  const onSite = children.filter(c => latestAttByChild[c.id]?.status === 'signed_in')

  const signOut = async (childId) => {
    const att = latestAttByChild[childId]
    if (!att) return
    await supabase.from('attendance').update({ status: 'signed_out', signed_out_at: new Date().toISOString(), signed_out_by: authUserId }).eq('id', att.id)
    onReload()
  }

  return (
    <div style={glass({ padding: 0, overflow: 'hidden' })}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
        {onSite.length} young {onSite.length === 1 ? 'person' : 'people'} currently on site
      </div>
      {onSite.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Nobody is currently signed in anywhere.</div>
      ) : onSite.map(c => {
        const att = latestAttByChild[c.id]
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
            <Avatar name={`${c.first_name} ${c.last_name}`} photoUrl={c.photo_url} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{c.first_name} {c.last_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{groupLabel(c.group_name) || 'Ungrouped'} · Signed in {att?.signed_in_at ? new Date(att.signed_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
            {hasMedicalAlert(c) && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#B91C1C', background: '#FEE2E2', borderRadius: 99, padding: '2px 8px' }}><Icon name="❤️" /> Alert</span>}
            <button onClick={() => signOut(c.id)} style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid var(--org-a20)`, background: 'var(--surface)', color: primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Sign out</button>
          </div>
        )
      })}
    </div>
  )
}

function GroupsTab({ children, orgGroups, latestAttByChild, primary, onSelectGroup }) {
  const groups = (orgGroups || [])
  const ungroupedCount = children.filter(c => !groups.some(g => (g.label || '').toLowerCase() === (c.group_name || '').toLowerCase())).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
      {groups.map(g => {
        const members = children.filter(c => (c.group_name || '').toLowerCase() === (g.label || '').toLowerCase())
        const onSiteCount = members.filter(c => latestAttByChild[c.id]?.status === 'signed_in').length
        return (
          <div key={g.id || g.label} onClick={() => onSelectGroup(g.label)} style={{ ...glass({ padding: 18 }), cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color || primary }} />
              <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{g.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: primary }}>{members.length}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>young {members.length === 1 ? 'person' : 'people'}{onSiteCount > 0 ? ` · ${onSiteCount} on site` : ''}</div>
          </div>
        )
      })}
      {ungroupedCount > 0 && (
        <div onClick={() => onSelectGroup('')} style={{ ...glass({ padding: 18 }), cursor: 'pointer', opacity: 0.85 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text3)', marginBottom: 10 }}>Ungrouped</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-faint)' }}>{ungroupedCount}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>young {ungroupedCount === 1 ? 'person' : 'people'}</div>
        </div>
      )}
      {groups.length === 0 && ungroupedCount === 0 && (
        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--text-faint)', fontSize: 13 }}>No groups configured yet — set these up from Registers.</div>
      )}
    </div>
  )
}

function ConsentsTab({ children, consentsByChild, groupLabel, primary, onOpenChild }) {
  return (
    <div style={glass({ padding: 0, overflow: 'hidden' })}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
        {children.length} {children.length === 1 ? 'record needs' : 'records need'} consent follow-up
      </div>
      {children.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}><Icon name="✅" /> All consents are up to date.</div>
      ) : children.map(c => {
        const rec = consentsByChild[c.id] || {}
        const missing = CONSENT_TYPES.filter(t => rec[t.key]?.status !== 'granted')
        return (
          <div key={c.id} onClick={() => onOpenChild(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer' }}>
            <Avatar name={`${c.first_name} ${c.last_name}`} photoUrl={c.photo_url} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{c.first_name} {c.last_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{groupLabel(c.group_name) || 'Ungrouped'}{c.parent_name ? ` · ${c.parent_name}` : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
              {missing.map(t => <span key={t.key} style={{ fontSize: 9.5, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', borderRadius: 99, padding: '2px 8px' }}>{t.label}</span>)}
            </div>
            <span style={{ color: primary, fontSize: 12, fontWeight: 700 }}>View <Icon name="→" /></span>
          </div>
        )
      })}
    </div>
  )
}

function MedicalTab({ children, groupLabel, primary, onOpenChild }) {
  return (
    <div style={glass({ padding: 0, overflow: 'hidden' })}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
        {children.length} {children.length === 1 ? 'record has' : 'records have'} a medical alert
      </div>
      {children.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>No medical alerts recorded.</div>
      ) : children.map(c => (
        <div key={c.id} onClick={() => onOpenChild(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer' }}>
          <Avatar name={`${c.first_name} ${c.last_name}`} photoUrl={c.photo_url} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{c.first_name} {c.last_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{groupLabel(c.group_name) || 'Ungrouped'}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
            {medicalAlerts(c).map(ch => <span key={ch.label} style={{ fontSize: 9.5, fontWeight: 800, color: ch.color, background: ch.bg, borderRadius: 99, padding: '2px 8px' }}>{ch.label}</span>)}
          </div>
          <span style={{ color: primary, fontSize: 12, fontWeight: 700 }}>View <Icon name="→" /></span>
        </div>
      ))}
    </div>
  )
}

function RegistrationRequestsTab({ registrations, org, authUserId, primary, onReload }) {
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rejectReasonFor, setRejectReasonFor] = useState(null)
  const [reason, setReason] = useState('')

  const pending = registrations.filter(r => r.status === 'pending')
  const reviewed = registrations.filter(r => r.status !== 'pending')
  const open = registrations.find(r => r.id === openId)

  const approve = async (req) => {
    setBusy(true)
    const { data: child, error } = await supabase.from('children').insert({
      org_id: org.id, first_name: req.first_name, last_name: req.last_name,
      date_of_birth: req.date_of_birth, group_name: req.group_name, school: req.school,
      parent_name: req.parent_name, parent_phone: req.parent_phone, parent_email: req.parent_email,
      emergency_contact_name: req.emergency_contact_name, emergency_contact_phone: req.emergency_contact_phone,
      allergies: req.allergies, medical_notes: req.medical_notes, has_asthma: req.has_asthma,
      has_diabetes: req.has_diabetes, takes_medication: req.takes_medication, medication_details: req.medication_details,
      has_epipen: req.has_epipen, has_behaviour_plan: req.has_behaviour_plan, behaviour_plan_notes: req.behaviour_plan_notes,
      travel_consent: req.travel_consent, notes: req.notes, active: true, profile_incomplete: false,
    }).select().single()
    if (error) { setBusy(false); window.alert(readableDbError(error, 'Could not create the child record.')); return }

    const consentRows = [
      { consent_type: 'photo', status: req.consent_photo ? 'granted' : 'not_granted' },
      { consent_type: 'trip', status: req.consent_trip ? 'granted' : 'not_granted' },
      { consent_type: 'medical', status: req.consent_medical ? 'granted' : 'not_granted' },
      { consent_type: 'data_sharing', status: req.consent_data_sharing ? 'granted' : 'not_granted' },
    ].map(c => ({ ...c, org_id: org.id, child_id: child.id, granted_by: c.status === 'granted' ? authUserId : null, granted_at: c.status === 'granted' ? new Date().toISOString() : null }))
    await supabase.from('child_consents').insert(consentRows)

    await supabase.from('child_registration_requests').update({
      status: 'approved', reviewed_by: authUserId, reviewed_at: new Date().toISOString(), resulting_child_id: child.id,
    }).eq('id', req.id)

    setBusy(false)
    setOpenId(null)
    onReload()
  }

  const reject = async (req) => {
    setBusy(true)
    await supabase.from('child_registration_requests').update({
      status: 'rejected', reviewed_by: authUserId, reviewed_at: new Date().toISOString(), rejection_reason: reason.trim() || null,
    }).eq('id', req.id)
    setBusy(false)
    setRejectReasonFor(null)
    setReason('')
    setOpenId(null)
    onReload()
  }

  const Row = ({ label, value }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 12.5, borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ color: 'var(--text3)' }}>{label}</span><span style={{ fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{String(value)}</span>
    </div>
  ) : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: open ? '1fr 1.3fr' : '1fr', gap: 16, alignItems: 'start' }}>
      <div style={glass({ padding: 0, overflow: 'hidden' })}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontWeight: 800, fontSize: 15, color: pending.length ? '#B91C1C' : '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          {pending.length > 0 && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626', animation: 'pulse-live 1.5s infinite', flexShrink: 0 }} />}
          {pending.length} pending registration{pending.length === 1 ? '' : 's'}
        </div>
        {pending.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>No pending registrations.</div>
        ) : pending.map(r => (
          <div key={r.id} onClick={() => setOpenId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.05)', cursor: 'pointer', background: openId === r.id ? 'var(--org-a05)' : '#FFFBFA', borderLeft: '3px solid #FCA5A5' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{r.first_name} {r.last_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Submitted {new Date(r.submitted_at).toLocaleDateString('en-GB')} · {r.parent_name}</div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#B45309', background: '#FEF3C7', borderRadius: 99, padding: '2px 9px' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#D97706', animation: 'pulse-live 1.5s infinite', flexShrink: 0 }} />
              Pending
            </span>
          </div>
        ))}
        {reviewed.length > 0 && (
          <>
            <div style={{ padding: '10px 18px', fontSize: 11, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, borderTop: '1px solid rgba(15,23,42,0.06)' }}>Reviewed</div>
            {reviewed.slice(0, 20).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#475569' }}>{r.first_name} {r.last_name}</div>
                <span style={{ fontSize: 10, fontWeight: 800, color: r.status === 'approved' ? '#15803D' : '#B91C1C', background: r.status === 'approved' ? '#DCFCE7' : '#FEE2E2', borderRadius: 99, padding: '2px 9px' }}>{r.status}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {open && (
        <div style={glass({ padding: 20 })}>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>{open.first_name} {open.last_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>Submitted {new Date(open.submitted_at).toLocaleDateString('en-GB')}</div>

          <Row label="Date of birth" value={open.date_of_birth} />
          <Row label="School" value={open.school} />
          <Row label="Parent / carer" value={open.parent_name} />
          <Row label="Phone" value={open.parent_phone} />
          <Row label="Email" value={open.parent_email} />
          <Row label="Emergency contact" value={[open.emergency_contact_name, open.emergency_contact_phone].filter(Boolean).join(' · ')} />
          <Row label="Allergies" value={open.allergies} />
          <Row label="Medical notes" value={open.medical_notes} />
          <Row label="Medical flags" value={[open.has_asthma && 'Asthma', open.has_diabetes && 'Diabetes', open.takes_medication && 'Medication', open.has_epipen && 'EpiPen'].filter(Boolean).join(', ') || null} />
          <Row label="Support plan" value={open.has_behaviour_plan ? (open.behaviour_plan_notes || 'Yes') : null} />
          <Row label="Consents given" value={[open.consent_photo && 'Photo', open.consent_trip && 'Trip', open.consent_medical && 'Medical', open.consent_data_sharing && 'Data sharing', open.travel_consent && 'Independent travel'].filter(Boolean).join(', ') || 'None selected'} />
          <Row label="Additional notes" value={open.notes} />

          {open.status === 'pending' ? (
            rejectReasonFor === open.id ? (
              <div style={{ marginTop: 16 }}>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for declining (optional, shown internally only)" style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 9, border: '1px solid var(--border)', fontSize: 12.5, minHeight: 60, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setRejectReasonFor(null)} style={{ flex: 1, ...btnGhost }}>Cancel</button>
                  <button onClick={() => reject(open)} disabled={busy} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busy ? 'Declining…' : 'Confirm decline'}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setRejectReasonFor(open.id)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Decline</button>
                <button onClick={() => approve(open)} disabled={busy} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Approving…' : '✓ Approve & create profile'}</button>
              </div>
            )
          ) : (
            <div style={{ marginTop: 16, fontSize: 12.5, fontWeight: 700, color: open.status === 'approved' ? '#15803D' : '#B91C1C' }}>
              {open.status === 'approved' ? '✓ Approved — profile created.' : `✕ Declined${open.rejection_reason ? `: ${open.rejection_reason}` : '.'}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function InviteParentModal({ org, onClose }) {
  const link = `${window.location.origin}/register-child/${org.slug}`
  const [copied, setCopied] = useState(false)
  const [parentEmail, setParentEmail] = useState('')
  const [parentName, setParentName] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null) // { ok: true } | { error: '...' }

  const copy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendEmail = async () => {
    setSending(true)
    setSendResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/send-form-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'registration', emails: [parentEmail], parent_name: parentName.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok || data.error || (data.failed || []).length > 0) {
        setSendResult({ error: data.error || 'Could not send that email — please try again.' })
      } else {
        setSendResult({ ok: true })
        setParentEmail('')
        setParentName('')
      }
    } catch {
      setSendResult({ error: 'Could not reach the server — please try again.' })
    }
    setSending(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 460 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>Invite a parent to register their child</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 18 }}>Every submission lands in Registration Requests for you to approve first; nothing is added automatically.</div>

        <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Send a branded email</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Parent's name (optional)" style={{ ...inputStyle, flex: 1, fontSize: 12.5 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={parentEmail} onChange={e => setParentEmail(e.target.value)} type="email" placeholder="parent@example.com" style={{ ...inputStyle, flex: 1, fontSize: 12.5 }} />
          <button onClick={sendEmail} disabled={sending || !parentEmail.trim()}
            style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: org.primary_color || '#7C5CFC', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: sending ? 'default' : 'pointer', opacity: sending || !parentEmail.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {sendResult?.ok && <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700, marginBottom: 14 }}><Icon name="✓" /> Invite sent.</div>}
        {sendResult?.error && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 700, marginBottom: 14 }}>{sendResult.error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 700 }}>OR</span><div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input readOnly value={link} style={{ ...inputStyle, flex: 1, fontSize: 12.5 }} onFocus={e => e.target.select()} />
          <button onClick={copy} style={{ padding: '0 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>{copied ? '✓ Copied' : 'Copy link'}</button>
        </div>
        <button onClick={onClose} style={{ width: '100%', ...btnGhost }}>Close</button>
      </div>
    </div>
  )
}
