import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { glassCard, DAYS, SLOTS } from './vp_shared'
import SignedImg from '../shared/SignedImg'
import Icon from '../../lib/icons'
import { orgBrand } from '../shared/OrgPageHero'
import { formatHours, summariseHours } from '../../lib/volunteerHours'
import { useScrollFade } from '../../hooks/useScrollFade'

// The volunteer's own details. Hours here are the register's count, the same
// figure as the Hours tab.
//
// Two segments went. Badges credited "100 young people supported" by
// multiplying sessions by eight; the Hours tab's milestones now do the
// encouraging with numbers that are true. Settings had a notifications switch
// that saved nothing and three rows that opened nothing; Sign out lives on
// Overview.
const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'availability', label: 'Availability' },
  { key: 'training', label: 'Training' },
  { key: 'documents', label: 'Documents' },
]

export default function VPProfile({ org, user, profile, teamRows = [], sessionsById = {}, primary, initialSub, onSignOut, onProfileUpdated, onNavigate }) {
  const [seg, setSeg] = useState(initialSub || 'overview')
  const tabFade = useScrollFade(seg)
  useEffect(() => { if (initialSub) setSeg(initialSub) }, [initialSub])

  const brand = orgBrand(org)
  const hours = useMemo(() => summariseHours(teamRows, sessionsById), [teamRows, sessionsById])
  const initials = (profile?.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ background: brand.hero, padding: '22px 18px 24px', color: '#fff', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: profile?.photo_url ? 'transparent' : 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.35)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          {profile?.photo_url ? <SignedImg bucket="staff-photos" src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24, fontWeight: 900 }}>{initials}</span>}
        </div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900 }}>{profile?.full_name}</h1>
        <div style={{ fontSize: 13.5, color: '#ffffffd9', marginTop: 2 }}>Volunteer at {org?.name}</div>
        <button onClick={() => onNavigate?.('hours')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, background: '#ffffff1f', border: '1px solid #ffffff40', color: '#fff', borderRadius: 99, padding: '0 16px', marginTop: 12, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          {formatHours(hours.totalMinutes)} hours · {hours.sessionCount} session{hours.sessionCount === 1 ? '' : 's'} <span aria-hidden="true">›</span>
        </button>
      </div>

      <div ref={tabFade.ref} role="tablist" aria-label="Your details" style={{ display: 'flex', gap: 6, padding: '14px 16px 0', ...tabFade.style }}>
        {SEGMENTS.map(s => (
          <button key={s.key} role="tab" aria-selected={seg === s.key} onClick={() => setSeg(s.key)}
            style={{ minHeight: 44, padding: '0 16px', borderRadius: 99, border: seg === s.key ? 'none' : '1px solid var(--border)', background: seg === s.key ? 'var(--org-primary, #1B9AAA)' : 'var(--surface)', color: seg === s.key ? 'var(--org-on-primary, #fff)' : 'var(--text2)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px' }}>
        {seg === 'overview' && <Overview profile={profile} hours={hours} onSignOut={onSignOut} onNavigate={onNavigate} />}
        {seg === 'availability' && <Availability profile={profile} org={org} user={user} primary={primary} onProfileUpdated={onProfileUpdated} />}
        {seg === 'training' && <Training org={org} user={user} primary={primary} />}
        {seg === 'documents' && <Documents org={org} profile={profile} primary={primary} />}
      </div>
    </div>
  )
}

function Overview({ profile, hours, onSignOut, onNavigate }) {
  return (
    <div>
      <div style={{ ...glassCard({ padding: 16, marginBottom: 12 }) }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Your volunteering</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['Hours volunteered', formatHours(hours.totalMinutes)], ['Sessions', hours.sessionCount], ['Emergency contact', profile?.emergency_contact_name || 'Not added'], ['DBS', profile?.dbs_number ? 'On file' : 'Not added yet']].map(([l, v]) => (
            <div key={l}><div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{l}</div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{v}</div></div>
          ))}
        </div>
        <button onClick={() => onNavigate?.('hours')} style={{ marginTop: 14, width: '100%', minHeight: 44, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>See your hours</button>
      </div>
      <div style={{ ...glassCard({ padding: 16, marginBottom: 12 }) }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 900, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Contact</h2>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4, overflowWrap: 'anywhere' }}>{profile?.email}</div>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>{profile?.phone || 'No phone number on file'}</div>
      </div>
      <button onClick={onSignOut} style={{ width: '100%', minHeight: 48, borderRadius: 14, border: '1.5px solid var(--danger-border)', background: 'var(--surface)', color: 'var(--danger-text)', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
    </div>
  )
}

function Availability({ profile, org, user, primary, onProfileUpdated }) {
  const initGrid = profile?.availability?.grid || {}
  const [grid, setGrid] = useState(initGrid)
  const [saving, setSaving] = useState(false)

  const toggle = (day, slot) => {
    setGrid(g => {
      const cur = g[day] || []
      const next = cur.includes(slot) ? cur.filter(s => s !== slot) : [...cur, slot]
      return { ...g, [day]: next }
    })
  }

  const [savedNote, setSavedNote] = useState('')
  const save = async () => {
    setSaving(true)
    const availability = { ...(profile?.availability || {}), grid }
    const { error } = await supabase.from('user_profiles').update({ availability }).eq('id', user.id)
    setSaving(false)
    setSavedNote(error ? 'Not saved. Try again' : 'Saved')
    setTimeout(() => setSavedNote(''), 2200)
    if (!error) onProfileUpdated && onProfileUpdated({ ...profile, availability })
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>Tap the slots you're generally available. This repeats weekly.</div>
      <div style={{ ...glassCard({ padding: 14 }) }}>
        <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
          <div />
          {SLOTS.map(([key, label]) => <div key={key} style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-faint)', textAlign: 'center' }}>{label.split(' ')[1]}</div>)}
        </div>
        {DAYS.map(day => (
          <div key={day} style={{ display: 'grid', gridTemplateColumns: '50px repeat(3, 1fr)', gap: 6, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', display: 'flex', alignItems: 'center' }}>{day}</div>
            {SLOTS.map(([slotKey]) => {
              const on = (grid[day] || []).includes(slotKey)
              return (
                <button key={slotKey} onClick={() => toggle(day, slotKey)} aria-pressed={on} aria-label={`${day} ${slotKey}`}
                  style={{ height: 44, borderRadius: 10, border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--org-primary, #1B9AAA)' : 'var(--surface)', color: on ? 'var(--org-on-primary, #fff)' : 'var(--text-faint)', cursor: 'pointer', fontSize: 15, fontWeight: 900 }}>{on ? '✓' : ''}</button>
              )
            })}
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: 14, minHeight: 48, borderRadius: 14, border: 'none', background: 'var(--org-primary, #1B9AAA)', color: 'var(--org-on-primary, #fff)', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : savedNote || 'Save availability'}</button>
    </div>
  )
}

function Training({ org, user, primary }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('volunteer_training').select('*').eq('org_id', org.id).eq('volunteer_id', user.id).order('created_at', { ascending: false }).then(({ data }) => { setRecords(data || []); setLoading(false) })
  }, [org.id, user.id])

  const mandatory = ['Safeguarding', 'First Aid', 'DBS Check']
  const completedTypes = new Set(records.filter(r => r.status === 'completed').map(r => r.training_type))

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-faint)' }}>Loading…</div>

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>Mandatory Training</div>
      {mandatory.map(m => {
        const done = completedTypes.has(m)
        return (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, background: done ? 'var(--ok-bg)' : 'var(--warn-bg)', marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{done ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{m}</div><div style={{ fontSize: 11, color: done ? '#16A34A' : 'var(--warn-text)' }}>{done ? 'Completed' : 'Outstanding'}</div></div>
          </div>
        )
      })}
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', margin: '16px 0 10px' }}>Certificates</div>
      {records.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', textAlign: 'center', padding: 20 }}>No certificates uploaded yet. Use the + menu to upload one.</div>
      ) : records.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.06)', marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}><Icon name="📜" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.training_type}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{r.expiry_date ? `Expires ${new Date(r.expiry_date).toLocaleDateString('en-GB')}` : r.completed_at ? `Completed ${new Date(r.completed_at).toLocaleDateString('en-GB')}` : ''}</div>
          </div>
          {r.certificate_url && <a href={r.certificate_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: 'var(--org-ink)' }}>View</a>}
        </div>
      ))}
    </div>
  )
}

function Documents({ org, profile, primary }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('org_documents').select('*').eq('org_id', org.id).in('visible_to', ['volunteers', 'all']).order('created_at', { ascending: false }).then(({ data }) => { setDocs(data || []); setLoading(false) })
  }, [org.id])

  const CAT_ICON = { policy: '📋', risk_assessment: '🛡️', handbook: '📘', certificate: '📜', insurance: '🧾' }

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-faint)' }}>Loading…</div>

  return docs.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}><Icon name="📄" /></div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>No documents yet</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>Policies, the handbook, and risk assessments will appear here once your organisation adds them.</div>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {docs.map(d => (
        <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, border: '1.5px solid rgba(15,23,42,0.06)', textDecoration: 'none' }}>
          <span style={{ fontSize: 20 }}>{CAT_ICON[d.category] || '📄'}</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.title}</div>
        </a>
      ))}
    </div>
  )
}
