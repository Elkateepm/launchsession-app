import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { requestPasswordReset } from '../../lib/passwordReset'
import { useIsMobile } from '../../hooks/useIsMobile'
import MemberAccess from '../hr/MemberAccess'
import StaffHRProfile from '../hr/StaffHRProfile'
import { InviteStaffModal } from '../hr/HRCentre'
import JoinRequests from './JoinRequests'
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
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  padding: 16, marginBottom: 10,
}

const input = {
  width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '11px 13px', borderRadius: 11,
  border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit', outline: 'none',
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text3)',
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

function Pill({ children, tone = 'var(--text3)', bg = 'var(--border-soft)' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 99,
      background: bg, color: tone, fontSize: 11.5, fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

// hasHR: whether this organisation's plan includes HR. Without it, Team is
// where people are invited and approved; with it, approvals live in HR.
export default function TeamCentre({ org, session, userProfile, onNavigate, hasHR = true }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#3B82F6'
  const myRole = userProfile?.role
  const isAdmin = ['owner', 'admin'].includes(myRole)
  const canDecide = ['owner', 'admin', 'manager'].includes(myRole)

  const [tab, setTab] = useState('people')
  const [people, setPeople] = useState([])
  const [invites, setInvites] = useState([])
  // Asked to join through the join link (team_join_requests). Only the roles
  // that can decide them can read them, so nobody else loads them.
  const [joinRequests, setJoinRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(null)
  // The HR record opens over the top of the Team drawer rather than
  // replacing it, so closing HR returns you to where you were.
  const [hrPerson, setHrPerson] = useState(null)
  const [toast, setToast] = useState('')
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    if (!org?.id) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      const [p, inv, jr] = await Promise.all([
        supabase.from('user_profiles')
          .select('id, full_name, preferred_name, email, role, job_title, photo_url, approval_status, approved_at, approval_note, created_at')
          .eq('org_id', org.id)
          .order('full_name', { ascending: true }),
        supabase.from('admin_invites')
          .select('id, email, full_name, role, created_at')
          .eq('org_id', org.id).eq('status', 'pending')
          .order('created_at', { ascending: false }),
        canDecide
          ? supabase.from('team_join_requests')
            .select('id, full_name, email, phone, message, created_at')
            .eq('org_id', org.id).eq('status', 'pending')
            .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
      ])
      setPeople(p.data || [])
      setInvites(inv.data || [])
      setJoinRequests(jr.data || [])
      const queryError = p.error || inv.error || jr.error
      if (queryError) setLoadError(queryError.message || 'Some team information could not be loaded.')
    } catch (error) {
      setLoadError(error?.message || 'The team could not be loaded. Try again.')
    } finally {
      setLoading(false)
    }
  }, [org?.id, canDecide])

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
  const currentAccounts = useMemo(
    () => people.filter(p => !['pending', 'declined'].includes(p.approval_status)),
    [people],
  )
  const listablePeople = useMemo(
    () => people.filter(p => p.approval_status !== 'pending'),
    [people],
  )
  const roleFilterOptions = [
    { key: 'all', label: 'Everyone' },
    { key: 'admins', label: 'Admins' },
    { key: 'manager', label: 'Managers' },
    { key: 'staff', label: 'Staff' },
    { key: 'volunteer', label: 'Volunteers' },
    { key: 'parent', label: 'Parents' },
  ].map(option => ({
    ...option,
    count: option.key === 'all'
      ? listablePeople.length
      : option.key === 'admins'
        ? listablePeople.filter(p => ['owner', 'admin'].includes(p.role)).length
        : listablePeople.filter(p => p.role === option.key).length,
  })).filter((option, index) => index === 0 || option.count > 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return listablePeople.filter(p => {
      const matchesRole = roleFilter === 'all'
        || (roleFilter === 'admins' ? ['owner', 'admin'].includes(p.role) : p.role === roleFilter)
      const matchesSearch = !q || [
        p.preferred_name, p.full_name, p.email, p.job_title, ROLE_LABELS[p.role],
      ].filter(Boolean).join(' ').toLowerCase().includes(q)
      return matchesRole && matchesSearch
    })
  }, [listablePeople, search, roleFilter])

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
    // Everyone on the team, volunteers included, so not "Staff".
    ['people', `Team members (${people.length})`],
    ['mail', 'Internal mail'],
  ]

  const roleCountsForStats = currentAccounts.filter(p => p.role === 'volunteer').length

  return (
    <div className="team-page" style={{ background: 'var(--surface2)', minHeight: '100%', padding: isMobile ? 16 : 24 }}>
      <style>{[
        '@keyframes teamFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
        '@keyframes teamOverlay { from { opacity: 0; } to { opacity: 1; } }',
        '@keyframes teamDrawer { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }',
        '.team-page .team-enter { animation: teamFade .28s ease both; }',
        '.team-page .team-stat-card { transition: transform .18s ease, box-shadow .18s ease; }',
        '.team-page .team-stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(41, 27, 92, .08); }',
        '.team-page .team-filter { transition: background .16s ease, color .16s ease, border-color .16s ease, transform .16s ease; }',
        '.team-page .team-filter:hover { transform: translateY(-1px); }',
        '.team-page .team-row { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }',
        '.team-page .team-row:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(41, 27, 92, .07); border-color: var(--border); }',
        '@media (prefers-reduced-motion: reduce) { .team-page .team-enter, .team-page .team-stat-card, .team-page .team-filter, .team-page .team-row { animation: none !important; transition: none !important; transform: none !important; } }',
      ].join(' ')}</style>

      <div className="team-enter" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text3)', fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: primary, boxShadow: `0 0 0 4px ${primary}1c` }} />
            People &amp; access
          </div>
          <div style={{ fontSize: isMobile ? 25 : 30, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.8, lineHeight: 1.12 }}>Your team</div>
          <div style={{ fontSize: 13.5, color: 'var(--text3)', marginTop: 6, maxWidth: 620, lineHeight: 1.5 }}>
            Manage access, welcome new people and keep everyone in sync.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <button onClick={() => load()} disabled={loading} aria-label="Refresh team" style={{
            minHeight: 44, padding: '0 13px', borderRadius: 12, border: '1px solid var(--border)',
            cursor: loading ? 'default' : 'pointer', background: 'var(--surface)', color: 'var(--text3)',
            fontSize: 13, fontWeight: 750, fontFamily: 'inherit', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', gap: 7, opacity: loading ? .65 : 1,
          }}><Icon name="↻" /> Refresh</button>
          {canDecide && (
            <button onClick={() => setInviting(true)} style={{
              minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: primary, color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: `0 7px 16px ${primary}35`,
            }}><Icon name="✉️" /> Invite someone</button>
          )}
        </div>
      </div>

      <div className="team-enter" style={{
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
        gap: 10, marginBottom: 18, animationDelay: '45ms',
      }}>
        {[
          { label: 'Active accounts', value: currentAccounts.length, hint: 'Ready to use LaunchSession', icon: '✓', color: '#168A63', bg: 'rgba(22,138,99,.09)' },
          { label: 'Awaiting approval', value: pending.length, hint: 'People who need a decision', icon: '⌛', color: '#A75C00', bg: 'rgba(229,151,42,.13)' },
          { label: 'Volunteers', value: roleCountsForStats, hint: 'Part of your delivery team', icon: '♡', color: '#7147C8', bg: 'rgba(113,71,200,.10)' },
          { label: 'Invites out', value: invites.length, hint: 'Waiting for someone to join', icon: '✉', color: '#315CA8', bg: 'rgba(49,92,168,.10)' },
        ].map((item, index) => (
          <div key={item.label} className="team-stat-card" style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 15,
            padding: isMobile ? 13 : 16, display: 'flex', alignItems: 'center', gap: 12,
            minWidth: 0, animationDelay: (index * 35 + 70) + 'ms',
          }}>
            <div style={{
              width: isMobile ? 38 : 42, height: isMobile ? 38 : 42, borderRadius: 12, flexShrink: 0,
              display: 'grid', placeItems: 'center', background: item.bg, color: item.color,
              fontSize: 19, fontWeight: 900,
            }}>{item.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{item.value}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
              {!isMobile && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.hint}</div>}
            </div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <button className="team-enter" onClick={() => hasHR ? onNavigate && onNavigate('hr') : setSelected(pending[0])} style={{
          width: '100%', textAlign: 'left', marginBottom: 14, cursor: 'pointer',
          background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 14,
          padding: '13px 15px', fontFamily: 'inherit', display: 'flex',
          alignItems: 'center', gap: 11, minHeight: 54, animationDelay: '130ms',
        }}>
          <span style={{ color: 'var(--warn-text)', display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.5)', flexShrink: 0 }}><Icon name="⚠️" /></span>
          <span style={{ fontSize: 13.5, color: 'var(--warn-text)', fontWeight: 800, flex: 1, minWidth: 0 }}>
            {pending.length} {pending.length === 1 ? 'person is' : 'people are'} waiting for approval
            <span style={{ display: 'block', fontWeight: 500, fontSize: 12.5, marginTop: 2 }}>
              {hasHR ? 'Review their request in HR' : 'Open a profile to approve or decline'}
            </span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--warn-text)', fontSize: 21, flexShrink: 0 }}>›</span>
        </button>
      )}

      {canDecide && (
        <div className="team-enter" style={{ animationDelay: '150ms' }}>
          <JoinRequests org={org} requests={joinRequests} myRole={myRole} myId={session?.user?.id || userProfile?.id} primary={primary}
            memberEmails={new Set(people.map(p => (p.email || '').toLowerCase()))}
            onChanged={load} onFlash={flash} />
        </div>
      )}

      {toast && (
        <div role="status" className="team-enter" style={{
          background: 'var(--ok-bg)', border: '1px solid var(--ok-border)', borderRadius: 12,
          padding: '12px 14px', marginBottom: 12, color: 'var(--ok-text)', fontSize: 13.5, fontWeight: 700,
        }}>{toast}</div>
      )}

      {loadError && (
        <div role="alert" className="team-enter" style={{
          background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12,
          padding: '12px 14px', marginBottom: 12, color: 'var(--danger-text)', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <span>{loadError}</span>
          <button onClick={() => load()} style={{
            minHeight: 40, padding: '0 12px', borderRadius: 9, border: '1px solid var(--danger-border)',
            background: 'var(--surface)', color: 'var(--danger-text)', font: 'inherit', fontWeight: 750, cursor: 'pointer',
          }}>Try again</button>
        </div>
      )}

      <div role="tablist" aria-label="Team workspace" className="team-enter" style={{
        display: 'flex', gap: 7, margin: '18px 0 14px', borderBottom: '1px solid var(--border)', overflowX: 'auto',
        animationDelay: '180ms',
      }}>
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} style={{
            padding: '11px 15px', borderRadius: '10px 10px 0 0', cursor: 'pointer', minHeight: 46,
            border: '1px solid transparent', borderBottom: tab === key ? `3px solid ${primary}` : '3px solid transparent',
            background: tab === key ? 'var(--surface)' : 'transparent',
            color: tab === key ? primary : 'var(--text3)',
            fontSize: 13.5, fontWeight: tab === key ? 850 : 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>{label}</button>
        ))}
      </div>

      {loading && (
        <div aria-label="Loading team" style={{ display: 'grid', gap: 9 }}>
          {[0, 1, 2].map(i => <div key={i} style={{
            height: 72, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)',
            opacity: 1 - i * .18, animation: 'teamFade .3s ease both',
          }} />)}
        </div>
      )}

      {!loading && tab === 'people' && (
        <>
          <div className="team-enter" style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 15,
            padding: isMobile ? 12 : 15, marginBottom: 12, animationDelay: '210ms',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
                <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: 12, color: 'var(--text-faint)', display: 'flex' }}><Icon name="⌕" /></span>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email, role or job title"
                  aria-label="Search team members"
                  style={{ ...input, paddingLeft: 39, margin: 0, background: 'var(--surface)' }}
                />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700, whiteSpace: 'nowrap', padding: '0 4px' }}>
                {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
              </div>
            </div>
            <div aria-label="Filter by role" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
              {roleFilterOptions.map(option => (
                <button key={option.key} className="team-filter" aria-pressed={roleFilter === option.key}
                  onClick={() => setRoleFilter(option.key)} style={{
                    minHeight: 37, padding: '0 12px', borderRadius: 99, cursor: 'pointer',
                    border: `1px solid ${roleFilter === option.key ? primary : 'var(--border)'}`,
                    background: roleFilter === option.key ? `${primary}14` : 'var(--surface)',
                    color: roleFilter === option.key ? primary : 'var(--text3)',
                    fontSize: 12.5, fontWeight: roleFilter === option.key ? 800 : 650, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                  }}>
                  {option.label}
                  <span style={{
                    minWidth: 20, height: 20, padding: '0 5px', boxSizing: 'border-box',
                    display: 'inline-grid', placeItems: 'center', borderRadius: 99, fontSize: 11,
                    background: roleFilter === option.key ? 'rgba(255,255,255,.72)' : 'var(--surface2)',
                    color: roleFilter === option.key ? primary : 'var(--text-faint)',
                  }}>{option.count}</span>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="team-enter" style={{
              ...card, textAlign: 'center', padding: isMobile ? '26px 16px' : '34px 24px',
              animationDelay: '240ms',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 15, margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'rgba(113,71,200,.10)', color: '#7147C8', fontSize: 22 }}>👥</div>
              <div style={{ fontSize: 15, fontWeight: 850, color: 'var(--text)' }}>
                {search || roleFilter !== 'all' ? 'No people match these filters' : canDecide ? 'Your team is ready to grow' : 'No team members yet'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 5, lineHeight: 1.5 }}>
                {search || roleFilter !== 'all' ? 'Try another search or clear the current filters.' : 'Invite your staff and volunteers to give them access to the workspace.'}
              </div>
              {search || roleFilter !== 'all' ? (
                <button onClick={() => { setSearch(''); setRoleFilter('all') }} style={{
                  minHeight: 42, marginTop: 14, padding: '0 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                  fontSize: 13, fontWeight: 750, cursor: 'pointer', fontFamily: 'inherit',
                }}>Clear filters</button>
              ) : canDecide && (
                <button onClick={() => setInviting(true)} style={{
                  minHeight: 44, marginTop: 15, padding: '0 16px', borderRadius: 11,
                  border: 'none', background: primary, color: '#fff', fontSize: 13.5,
                  fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                }}>Invite someone</button>
              )}
            </div>
          )}

          {filtered.map((p, index) => (
            <button key={p.id} className="team-row team-enter" onClick={() => setSelected(p)} style={{
              ...card, width: '100%', textAlign: 'left', cursor: 'pointer', padding: isMobile ? 13 : '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', minHeight: 72,
              animationDelay: (Math.min(index, 8) * 25 + 250) + 'ms',
            }}>
              <Avatar person={p} primary={primary} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 850, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.preferred_name || p.full_name || p.email}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                  {p.email}{p.job_title ? ` · ${p.job_title}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                <Pill tone="#3730A3" bg="var(--info-bg)">{ROLE_LABELS[p.role] || p.role}</Pill>
                {p.approval_status === 'declined'
                  ? <Pill tone="var(--danger-text)" bg="var(--danger-bg)">Declined</Pill>
                  : p.approval_status === 'approved' && <Pill tone="var(--ok-text)" bg="var(--ok-bg)">Active</Pill>}
              </div>
              <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 21, marginLeft: 1 }}>›</span>
            </button>
          ))}

          {invites.length > 0 && (
            <div className="team-enter" style={{ ...card, marginTop: 8, animationDelay: '300ms' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>Invitations in progress</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3 }}>These people have been invited but have not joined yet.</div>
                </div>
                <Pill tone="#315CA8" bg="rgba(49,92,168,.10)">{invites.length} pending</Pill>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {invites.map(invite => (
                  <div key={invite.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px',
                    borderRadius: 11, background: 'var(--surface2)', minWidth: 0,
                  }}>
                    <span aria-hidden="true" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 10, color: '#315CA8', background: 'rgba(49,92,168,.10)' }}><Icon name="✉️" /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite.full_name || invite.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ROLE_LABELS[invite.role] || invite.role} · Sent {new Date(invite.created_at).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <Pill tone="#315CA8" bg="var(--surface)">Pending</Pill>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'mail' && (
        <div className="team-enter" style={{ animationDelay: '210ms' }}>
          <InternalMail org={org} people={people} primary={primary} isMobile={isMobile} onFlash={flash} />
        </div>
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
      {inviting && (
        <InviteStaffModal org={org} primary={primary} inviterRole={userProfile?.role} title="Invite someone" onClose={() => setInviting(false)}
          onSent={() => { setInviting(false); flash('Invite sent'); load() }} />
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
    const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

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
    if (savingField === 'reset') return
    setSavingField('reset'); setError('')
    try {
      await requestPasswordReset(person.email, org)
      setResetSent(true)
      onFlash(`Password reset link requested for ${person.email}`)
    } catch (e) {
      setError('Could not send the reset email. Please try again.')
    } finally {
      setSavingField(null)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 16, animation: 'teamOverlay .18s ease both',
    }}>
      <div role="dialog" aria-modal="true" aria-label={`Profile for ${person.preferred_name || person.full_name || person.email}`} tabIndex={-1} onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', width: isMobile ? '100%' : 520, maxWidth: '100%',
        maxHeight: isMobile ? '92vh' : '88vh', overflowY: 'auto',
        borderRadius: isMobile ? '20px 20px 0 0' : 18, padding: 20, animation: 'teamDrawer .22s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Avatar person={person} size={52} primary={primary} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>{person.preferred_name || person.full_name || person.email}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.email}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)',
            fontSize: 15, minHeight: 44, minWidth: 44, fontFamily: 'inherit',
          }} aria-label="Close profile"><Icon name="✕" /></button>
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 10, background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 13, marginBottom: 14,
          }}>{error}</div>
        )}

        {person.approval_status === 'pending' && canDecide && !isSelf && (
          <div style={{
            padding: 14, borderRadius: 12, background: 'var(--warn-bg)',
            border: '1px solid var(--warn-border)', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--warn-text)', marginBottom: 10 }}>
              This account is waiting for approval
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onDecide(person, 'approved')} style={{
                flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
                color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}>Approve</button>
              <button onClick={() => onDecide(person, 'declined')} style={{
                flex: 1, minHeight: 44, borderRadius: 11, border: '1px solid var(--danger-border)',
                background: 'var(--surface)', color: 'var(--danger-text)', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Decline</button>
            </div>
          </div>
        )}

        <button onClick={onOpenHR} style={{
          width: '100%', minHeight: 48, borderRadius: 12, marginBottom: 18,
          border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, padding: '0 14px', textAlign: 'left',
        }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>
              Open HR record
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 1 }}>
              Employment, contract and probation
            </span>
          </span>
          <span style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}>›</span>
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
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6, lineHeight: 1.45 }}>
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
            width: '100%', minHeight: 44, borderRadius: 11, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 700,
            cursor: savingField === 'reset' ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>
            {savingField === 'reset' ? 'Sending…' : resetSent ? 'Reset link sent ✓' : 'Send password reset link'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
            Emails {person.email} a link to set a new password. You never see it.
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
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
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>New internal mail</div>

        <label style={labelStyle}>TO</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['all_staff', 'Everyone on the team'], ['selected', 'Choose people']].map(([k, l]) => (
            <button key={k} onClick={() => setAudience(k)} style={{
              padding: '9px 14px', borderRadius: 10, cursor: 'pointer', minHeight: 44,
              border: `1px solid ${audience === k ? 'transparent' : 'var(--border)'}`,
              background: audience === k ? primary : 'var(--surface)',
              color: audience === k ? '#fff' : 'var(--text3)',
              fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
            }}>{l}</button>
          ))}
        </div>

        {audience === 'selected' && (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 11, padding: 8,
            maxHeight: 220, overflowY: 'auto', marginBottom: 14,
          }}>
            {addressable.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text3)', padding: 8 }}>No approved staff to write to yet.</div>
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
                <span style={{ fontSize: 13.5, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.full_name || p.email}
                  <span style={{ color: 'var(--text-faint)' }}> · {p.job_title || ROLE_LABELS[p.role] || p.role}</span>
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
            padding: '10px 12px', borderRadius: 10, background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 13, marginBottom: 12,
          }}>{error}</div>
        )}

        <button onClick={send} disabled={!canSend || sending} style={{
          width: '100%', minHeight: 46, borderRadius: 11, border: 'none',
          background: primary, color: '#fff', fontSize: 15, fontWeight: 800,
          cursor: !canSend || sending ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: !canSend || sending ? 0.55 : 1,
        }}>{sending ? 'Sending…' : 'Send internal mail'}</button>

        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.45 }}>
          Lands in each person&apos;s notifications inside LaunchSession. It is not sent to their email inbox.
        </div>
      </div>

      {sent.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Recently sent</div>
          {sent.map(m => (
            <div key={m.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border-soft)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{m.subject}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
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
