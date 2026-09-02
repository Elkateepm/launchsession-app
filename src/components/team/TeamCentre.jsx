import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import MemberAccess from '../hr/MemberAccess'
import StaffHRProfile from '../hr/StaffHRProfile'
import Icon from '../../lib/icons'

// The Team tab: who is in the organisation, what they are allowed to reach,
// and who is still waiting to be let in.
//
// Deliberately independent of the HR module. HR is a paid add-on and its
// tables are gated behind is_org_admin() AND module_can_view('hr'), so a
// manager -- who is exactly the person expected to approve a new starter --
// cannot read them. Everything here comes from user_profiles instead.

const ROLE_LABELS = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager',
  staff: 'Staff', volunteer: 'Volunteer', parent: 'Parent',
}

// Roles an owner or admin can assign from this screen. Owner is absent on
// purpose: transferring ownership is not a dropdown decision.
const ASSIGNABLE_ROLES = ['admin', 'manager', 'staff', 'volunteer']

const card = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
  padding: 16, marginBottom: 10,
}

const input = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
  border: '1px solid #E2E8F0', fontSize: 15, fontFamily: 'inherit', outline: 'none',
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B',
  marginBottom: 6, letterSpacing: 0.3,
}

function initials(name, email) {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function Avatar({ person, size = 42, primary }) {
  if (person.photo_url) {
    return <img src={person.photo_url} alt="" style={{
      width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
    }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: primary, color: '#fff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36,
    }}>{initials(person.full_name, person.email)}</div>
  )
}

function Pill({ children, tone = '#64748B', bg = '#F1F5F9' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 99,
      background: bg, color: tone, fontSize: 11.5, fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export default function TeamCentre({ org, session, userProfile, onNavigate }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#3B82F6'
  const myRole = userProfile?.role
  const isAdmin = ['owner', 'admin'].includes(myRole)
  const canDecide = ['owner', 'admin', 'manager'].includes(myRole)

  const [tab, setTab] = useState('people')
  const [people, setPeople] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  // The HR record opens over the top of the Team drawer rather than
  // replacing it, so closing HR returns you to where you were.
  const [hrPerson, setHrPerson] = useState(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const [p, inv] = await Promise.all([
      supabase.from('user_profiles')
        .select('id, full_name, preferred_name, email, role, job_title, photo_url, approval_status, approved_at, approval_note, created_at')
        .eq('org_id', org.id)
        .order('full_name', { ascending: true }),
      supabase.from('admin_invites')
        .select('id, email, full_name, role, created_at')
        .eq('org_id', org.id).eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])
    setPeople(p.data || [])
    setInvites(inv.data || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  // Keep the open drawer pointing at the freshly loaded row rather than the
  // copy it was opened with, so an approval or role change is reflected
  // straight away instead of needing the drawer closed and reopened.
  useEffect(() => {
    if (!selected) return
    const fresh = people.find(p => p.id === selected.id)
    if (fresh && fresh !== selected) setSelected(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people])

  const pending = useMemo(
    () => people.filter(p => p.approval_status === 'pending'),
    [people],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const active = people.filter(p => p.approval_status !== 'pending')
    if (!q) return active
    return active.filter(p => [p.full_name, p.email, p.job_title, ROLE_LABELS[p.role]]
      .filter(Boolean).join(' ').toLowerCase().includes(q))
  }, [people, search])

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200) }

  const decide = async (person, decision, note) => {
    const { error } = await supabase.from('user_profiles')
      .update({ approval_status: decision, approval_note: note || null })
      .eq('id', person.id)
    if (error) { flash(error.message); return }
    flash(decision === 'approved'
      ? `${person.full_name || person.email} approved`
      : `${person.full_name || person.email} declined`)
    load()
  }

  const TABS = [
    ['people', `Staff (${filtered.length})`],
    ['mail', 'Internal mail'],
  ]

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100%', padding: isMobile ? 16 : 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>Team</div>
        <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 3 }}>
          Approve new accounts, set what each person can reach, and message the team.
        </div>
      </div>

      {pending.length > 0 && (
        <button onClick={() => onNavigate && onNavigate('hr')} style={{
          width: '100%', textAlign: 'left', marginBottom: 12, cursor: 'pointer',
          background: '#FEF6E7', border: '1px solid #FCD9A5', borderRadius: 12,
          padding: '12px 14px', fontFamily: 'inherit', display: 'flex',
          alignItems: 'center', gap: 10, minHeight: 44,
        }}>
          <span style={{ color: '#93500A', display: 'flex' }}><Icon name="⚠️" /></span>
          <span style={{ fontSize: 13.5, color: '#93500A', fontWeight: 700, flex: 1, minWidth: 0 }}>
            {pending.length} {pending.length === 1 ? 'person is' : 'people are'} waiting for approval
            <span style={{ display: 'block', fontWeight: 500, fontSize: 12.5, marginTop: 1 }}>
              Approvals moved to HR &amp; Staff, where approving someone starts their record
            </span>
          </span>
          <span style={{ color: '#93500A', fontSize: 18, flexShrink: 0 }}>›</span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '9px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
            border: `1px solid ${tab === key ? 'transparent' : '#E2E8F0'}`,
            background: tab === key ? primary : '#fff',
            color: tab === key ? '#fff' : '#64748B',
            fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          }}>{label}</button>
        ))}
      </div>

      {toast && (
        <div style={{
          ...card, background: '#E7F8ED', border: '1px solid #A7E7C1',
          color: '#04713C', fontSize: 13.5, fontWeight: 700,
        }}>{toast}</div>
      )}

      {loading && <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading the team…</div>}

      {!loading && tab === 'people' && (
        <>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or job title"
            style={{ ...input, marginBottom: 12, background: '#fff' }}
          />
          {filtered.length === 0 && (
            <div style={{ ...card, color: '#64748B', fontSize: 14 }}>
              {search ? 'Nobody matches that search.' : 'No one here yet. Invite staff from HR.'}
            </div>
          )}
          {filtered.map(p => (
            <button key={p.id} onClick={() => setSelected(p)} style={{
              ...card, width: '100%', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
              minHeight: 44,
            }}>
              <Avatar person={p} primary={primary} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.full_name || p.email}
                </div>
                <div style={{ fontSize: 12.5, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.job_title || ROLE_LABELS[p.role] || 'Staff'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                <Pill tone="#3730A3" bg="#EEF2FF">{ROLE_LABELS[p.role] || p.role}</Pill>
                {p.approval_status === 'declined' && <Pill tone="#B42318" bg="#FEF2F2">Declined</Pill>}
              </div>
            </button>
          ))}
          {invites.length > 0 && (
            <div style={{ ...card, background: '#F8FAFC' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                {invites.length} pending invite{invites.length === 1 ? '' : 's'}
              </div>
              {invites.map(i => (
                <div key={i.id} style={{ fontSize: 13, color: '#64748B', padding: '4px 0' }}>
                  {i.full_name || i.email} · {ROLE_LABELS[i.role] || i.role} · not yet set up
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && tab === 'mail' && (
        <InternalMail org={org} people={people} primary={primary} isMobile={isMobile} onFlash={flash} />
      )}

      {hrPerson && (
        <StaffHRProfile
          org={org} userProfile={userProfile} person={hrPerson}
          onClose={() => setHrPerson(null)}
        />
      )}

      {selected && (
        <PersonDrawer
          person={selected} org={org} primary={primary} isMobile={isMobile}
          isAdmin={isAdmin} canDecide={canDecide} myRole={myRole}
          isSelf={selected.id === session?.user?.id}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
          onFlash={flash}
          onDecide={decide}
          onOpenHR={() => setHrPerson(selected)}
        />
      )}
    </div>
  )
}

function PersonDrawer({ person, org, primary, isMobile, isAdmin, canDecide, myRole, isSelf, onClose, onChanged, onFlash, onDecide, onOpenHR }) {
  const [jobTitle, setJobTitle] = useState(person.job_title || '')
  const [role, setRole] = useState(person.role || 'staff')
  const [savingField, setSavingField] = useState(null)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    setJobTitle(person.job_title || '')
    setRole(person.role || 'staff')
    setError('')
    setResetSent(false)
  }, [person.id, person.job_title, person.role])

  // An owner's role is not editable from here, and nobody edits their own --
  // both are refused by the database trigger, so the control is disabled
  // rather than left to fail on save.
  const canEditRole = isAdmin && !isSelf && person.role !== 'owner'

  const saveJobTitle = async () => {
    setSavingField('job'); setError('')
    const { error: e } = await supabase.from('user_profiles')
      .update({ job_title: jobTitle.trim() || null }).eq('id', person.id)
    setSavingField(null)
    if (e) { setError(e.message); return }
    onFlash('Job title saved')
    onChanged()
  }

  const saveRole = async (next) => {
    setSavingField('role'); setError('')
    const { error: e } = await supabase.from('user_profiles')
      .update({ role: next }).eq('id', person.id)
    setSavingField(null)
    if (e) { setError(e.message); setRole(person.role || 'staff'); return }
    onFlash(`${person.full_name || person.email} is now ${ROLE_LABELS[next] || next}`)
    onChanged()
  }

  const sendReset = async () => {
    setSavingField('reset'); setError('')
    // Same Edge Function the sign-in screen uses, so the email is the branded
    // one people already recognise rather than a second, different-looking link.
    const { error: e } = await supabase.functions.invoke('send-password-reset-email', {
      body: {
        email: person.email,
        org_name: org?.name,
        org_slug: org?.slug,
        org_logo: org?.logo_url,
        org_color: org?.primary_color,
        redirect_to: window.location.origin + '/reset-password' + (org?.slug ? '?org=' + org.slug : ''),
      },
    })
    setSavingField(null)
    if (e) { setError('Could not send the reset email. Please try again.'); return }
    setResetSent(true)
    onFlash(`Password reset link sent to ${person.email}`)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: isMobile ? '100%' : 520, maxWidth: '100%',
        maxHeight: isMobile ? '92vh' : '88vh', overflowY: 'auto',
        borderRadius: isMobile ? '20px 20px 0 0' : 18, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Avatar person={person} size={52} primary={primary} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>{person.full_name || person.email}</div>
            <div style={{ fontSize: 13, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.email}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8',
            fontSize: 15, minHeight: 44, minWidth: 44, fontFamily: 'inherit',
          }}><Icon name="✕" /></button>
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
            border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 14,
          }}>{error}</div>
        )}

        {person.approval_status === 'pending' && canDecide && !isSelf && (
          <div style={{
            padding: 14, borderRadius: 12, background: '#FEF6E7',
            border: '1px solid #FCD9A5', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#93500A', marginBottom: 10 }}>
              This account is waiting for approval
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onDecide(person, 'approved')} style={{
                flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
                color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}>Approve</button>
              <button onClick={() => onDecide(person, 'declined')} style={{
                flex: 1, minHeight: 44, borderRadius: 11, border: '1px solid #FECACA',
                background: '#fff', color: '#B42318', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Decline</button>
            </div>
          </div>
        )}

        <button onClick={onOpenHR} style={{
          width: '100%', minHeight: 48, borderRadius: 12, marginBottom: 18,
          border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, padding: '0 14px', textAlign: 'left',
        }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
              Open HR record
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: '#64748B', marginTop: 1 }}>
              Employment, contract and probation
            </span>
          </span>
          <span style={{ color: '#94A3B8', fontSize: 18, flexShrink: 0 }}>›</span>
        </button>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>JOB TITLE</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={jobTitle} onChange={e => setJobTitle(e.target.value)}
              disabled={!isAdmin} placeholder="e.g. Youth Worker" style={input}
            />
            {isAdmin && (
              <button onClick={saveJobTitle} disabled={savingField === 'job'} style={{
                minHeight: 44, padding: '0 16px', borderRadius: 11, border: 'none',
                background: primary, color: '#fff', fontSize: 14, fontWeight: 800,
                cursor: savingField === 'job' ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: savingField === 'job' ? 0.6 : 1,
              }}>{savingField === 'job' ? 'Saving…' : 'Save'}</button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>ACCOUNT ROLE</label>
          <select
            value={role} disabled={!canEditRole || savingField === 'role'}
            onChange={e => { setRole(e.target.value); saveRole(e.target.value) }}
            style={{ ...input, minHeight: 44 }}
          >
            {person.role === 'owner' && <option value="owner">Owner</option>}
            {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 1.45 }}>
            {person.role === 'owner'
              ? 'Owners cannot be changed from here.'
              : isSelf ? 'You cannot change your own role.'
              : !isAdmin ? 'Only an owner or admin can change a role.'
              : 'Admins reach every module. Managers can approve people but cannot change roles.'}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>PASSWORD</label>
          <button onClick={sendReset} disabled={savingField === 'reset' || !person.email} style={{
            width: '100%', minHeight: 44, borderRadius: 11, border: '1px solid #E2E8F0',
            background: '#fff', color: '#0F172A', fontSize: 14, fontWeight: 700,
            cursor: savingField === 'reset' ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>
            {savingField === 'reset' ? 'Sending…' : resetSent ? 'Reset link sent ✓' : 'Send password reset link'}
          </button>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>
            Emails {person.email} a link to set a new password. You never see it.
          </div>
        </div>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
          <label style={labelStyle}>MODULE ACCESS</label>
          <MemberAccess member={{ ...person, role }} org={org} viewerRole={myRole} />
        </div>
      </div>
    </div>
  )
}

function InternalMail({ org, people, primary, isMobile, onFlash }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all_staff')
  const [picked, setPicked] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState([])

  // Volunteers and parents live in their own portals and never see the bell
  // this is delivered to, so offering them as recipients would be a lie.
  const addressable = useMemo(
    () => people.filter(p => p.approval_status === 'approved'
      && !['volunteer', 'parent'].includes(p.role)),
    [people],
  )

  const loadSent = useCallback(async () => {
    if (!org?.id) return
    const { data } = await supabase.from('internal_mail')
      .select('id, subject, body, audience, recipient_count, created_at')
      .eq('org_id', org.id).order('created_at', { ascending: false }).limit(20)
    setSent(data || [])
  }, [org?.id])

  useEffect(() => { loadSent() }, [loadSent])

  const send = async () => {
    setSending(true); setError('')
    const { error: e } = await supabase.rpc('send_internal_mail', {
      p_subject: subject,
      p_body: body,
      p_audience: audience,
      p_recipient_ids: audience === 'selected' ? picked : [],
    })
    setSending(false)
    if (e) { setError(e.message); return }
    onFlash('Internal mail sent')
    setSubject(''); setBody(''); setPicked([])
    loadSent()
  }

  const canSend = subject.trim() && body.trim()
    && (audience === 'all_staff' || picked.length > 0)

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>New internal mail</div>

        <label style={labelStyle}>TO</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['all_staff', 'Everyone on the team'], ['selected', 'Choose people']].map(([k, l]) => (
            <button key={k} onClick={() => setAudience(k)} style={{
              padding: '9px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
              border: `1px solid ${audience === k ? 'transparent' : '#E2E8F0'}`,
              background: audience === k ? primary : '#fff',
              color: audience === k ? '#fff' : '#64748B',
              fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            }}>{l}</button>
          ))}
        </div>

        {audience === 'selected' && (
          <div style={{
            border: '1px solid #E2E8F0', borderRadius: 11, padding: 8,
            maxHeight: 220, overflowY: 'auto', marginBottom: 14,
          }}>
            {addressable.length === 0 && (
              <div style={{ fontSize: 13, color: '#64748B', padding: 8 }}>No approved staff to write to yet.</div>
            )}
            {addressable.map(p => (
              <label key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px',
                cursor: 'pointer', minHeight: 44,
              }}>
                <input
                  type="checkbox" checked={picked.includes(p.id)}
                  onChange={e => setPicked(s => e.target.checked
                    ? [...s, p.id] : s.filter(x => x !== p.id))}
                  style={{ width: 18, height: 18, accentColor: primary, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13.5, color: '#0F172A', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.full_name || p.email}
                  <span style={{ color: '#94A3B8' }}> · {p.job_title || ROLE_LABELS[p.role] || p.role}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <label style={labelStyle}>SUBJECT</label>
        <input value={subject} onChange={e => setSubject(e.target.value)}
          placeholder="What is this about?" style={{ ...input, marginBottom: 14 }} />

        <label style={labelStyle}>MESSAGE</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
          placeholder="Write your message…"
          style={{ ...input, marginBottom: 14, resize: 'vertical', lineHeight: 1.5 }} />

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
            border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 12,
          }}>{error}</div>
        )}

        <button onClick={send} disabled={!canSend || sending} style={{
          width: '100%', minHeight: 46, borderRadius: 11, border: 'none',
          background: primary, color: '#fff', fontSize: 15, fontWeight: 800,
          cursor: !canSend || sending ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: !canSend || sending ? 0.55 : 1,
        }}>{sending ? 'Sending…' : 'Send internal mail'}</button>

        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8, lineHeight: 1.45 }}>
          Lands in each person&apos;s notifications inside LaunchSession. It is not sent to their email inbox.
        </div>
      </div>

      {sent.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Recently sent</div>
          {sent.map(m => (
            <div key={m.id} style={{ padding: '10px 0', borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{m.subject}</div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                {m.recipient_count} recipient{m.recipient_count === 1 ? '' : 's'}
                {' · '}{new Date(m.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
