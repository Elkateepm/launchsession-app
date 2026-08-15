import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'

// HR Centre — the single place staff are managed.
//
// Previously staff lived in two disconnected places: Team & Staff read
// user_profiles (real accounts), HR read hr_staff (hand-typed records), and the
// two were reconciled by matching email strings. A person could exist in one
// and not the other, and nobody could say which was authoritative.
//
// The directory now comes from one function that joins accounts to their HR
// record on user_id, and includes HR records with no login yet. Volunteers and
// young people stay in their own modules -- HR is employees.

const CARD = { background: '#fff', border: '1px solid #ECE9F5', borderRadius: 16 }

const DBS_STATES = {
  clear: { label: 'Clear', tone: '#04713C', bg: '#E7F8ED' },
  expiring: { label: 'Expiring soon', tone: '#93500A', bg: '#FEF6E7' },
  expired: { label: 'Expired', tone: '#B42318', bg: '#FEF2F2' },
  none: { label: 'Not recorded', tone: '#5A5772', bg: '#F3F2F7' },
}

const londonToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

const daysUntil = date => {
  if (!date) return null
  return Math.round((new Date(date) - new Date(londonToday())) / 86400000)
}

/**
 * Compliance is judged from the expiry date rather than a stored status, so a
 * record cannot say "Clear" while the date has passed. Text always accompanies
 * the colour — colour alone fails for anyone who can't distinguish it.
 */
function complianceState(expiry, recorded) {
  if (!expiry) return recorded ? 'clear' : 'none'
  const d = daysUntil(expiry)
  if (d === null) return 'none'
  if (d < 0) return 'expired'
  if (d <= 30) return 'expiring'
  return 'clear'
}

function Pill({ state }) {
  const meta = DBS_STATES[state] || DBS_STATES.none
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
      background: meta.bg, color: meta.tone, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: meta.tone }} />
      {meta.label}
    </span>
  )
}

export default function HRCentre({ org, session, userProfile, onNavigate, hasHRModule = true }) {
  const isMobile = useIsMobile()
  const primary = org?.primary_color || '#6D5DF6'
  const isAdmin = ['owner', 'admin'].includes(userProfile?.role)

  const [tab, setTab] = useState(hasHRModule ? 'overview' : 'staff')
  const [directory, setDirectory] = useState([])
  const [invites, setInvites] = useState([])
  const [leave, setLeave] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const [dir, inv, lv] = await Promise.all([
      supabase.rpc('hr_staff_directory'),
      supabase.from('admin_invites')
        .select('id, email, full_name, role, created_at')
        .eq('org_id', org.id).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('staff_leave')
        .select('id, staff_id, type, start_date, end_date, days')
        .eq('org_id', org.id).gte('end_date', londonToday()).order('start_date'),
    ])
    setDirectory(dir.data || [])
    setInvites(inv.data || [])
    setLeave(lv.data || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const active = directory.filter(d => d.is_active)
    return {
      total: directory.length,
      active: active.length,
      onLeave: directory.filter(d => d.on_leave_today).length,
      pending: invites.length,
    }
  }, [directory, invites])

  // Ordered by urgency: expired before expiring, soonest first. A list sorted
  // by name makes the one overdue DBS as easy to miss as everything else.
  const attention = useMemo(() => {
    const items = []
    directory.forEach(p => {
      const checks = [
        ['DBS', p.dbs_expiry, p.dbs_status],
        ['Safeguarding training', p.safeguarding_training_expiry, null],
        ['First aid', p.first_aid_expiry, null],
      ]
      checks.forEach(([label, expiry, recorded]) => {
        const state = complianceState(expiry, recorded)
        if (state !== 'expired' && state !== 'expiring') return
        const d = daysUntil(expiry)
        items.push({
          id: `${p.hr_id || p.user_id}-${label}`,
          person: p,
          severity: state === 'expired' ? 'action' : 'review',
          title: p.full_name,
          detail: state === 'expired'
            ? `${label} expired ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`
            : `${label} expires in ${d} day${d === 1 ? '' : 's'}`,
          weight: d,
        })
      })
    })
    items.sort((a, b) => a.weight - b.weight)
    if (invites.length) {
      items.push({
        id: 'invites',
        severity: 'info',
        title: `${invites.length} pending staff invite${invites.length === 1 ? '' : 's'}`,
        detail: 'Waiting for the invitee to create their account',
        isInvites: true,
        weight: 9999,
      })
    }
    return items
  }, [directory, invites])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return directory.filter(p => {
      if (statusFilter === 'active' && !p.is_active) return false
      if (statusFilter === 'inactive' && p.is_active) return false
      if (statusFilter === 'leave' && !p.on_leave_today) return false
      if (!q) return true
      return [p.full_name || '', p.email || '', p.role || ''].join(' ').toLowerCase().includes(q)
    })
  }, [directory, search, statusFilter])

  const TABS = hasHRModule
    ? [['overview', 'Overview'], ['staff', 'Staff'], ['compliance', 'Compliance'], ['leave', 'Leave']]
    : [['staff', 'Staff']]

  if (selected) {
    return <StaffProfile person={selected} org={org} leave={leave} primary={primary}
      isAdmin={isAdmin} hasHRModule={hasHRModule}
      onBack={() => setSelected(null)} onChanged={() => { load(); setSelected(null) }} />
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100%', padding: isMobile ? 16 : 24 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 16, marginBottom: 18, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: isMobile ? 21 : 24, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>
            HR Centre
          </div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 4 }}>
            Manage your staff, compliance and leave in one place.
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
            <button onClick={() => setInviteOpen(true)} style={{
              flex: isMobile ? 1 : 'none', padding: '11px 18px', borderRadius: 11,
              border: '1px solid #E2E8F0', background: '#fff', color: '#0F172A',
              fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Invite Staff</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${tab === key ? 'transparent' : '#E2E8F0'}`,
            background: tab === key ? primary : '#fff',
            color: tab === key ? '#fff' : '#64748B',
          }}>{label}</button>
        ))}
      </div>

      {notice && (
        <div style={{
          padding: '11px 14px', borderRadius: 11, marginBottom: 14, fontSize: 13.5,
          background: '#E7F8ED', border: '1px solid #A7E9C1', color: '#04713C',
        }}>{notice}</div>
      )}

      {loading && <div style={{ ...CARD, padding: 30, textAlign: 'center', color: '#94A3B8' }}>Loading…</div>}

      {!loading && tab === 'overview' && (
        <>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
            {stats.total} staff &nbsp;·&nbsp; {stats.active} active &nbsp;·&nbsp; {stats.onLeave} on leave
            &nbsp;·&nbsp; {stats.pending} pending invite{stats.pending === 1 ? '' : 's'}
          </div>

          {attention.length > 0 ? (
            <div style={{ ...CARD, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1px solid #ECE9F5', fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                Needs attention
              </div>
              {attention.slice(0, 8).map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                  borderBottom: i < Math.min(attention.length, 8) - 1 ? '1px solid #F5F3FA' : 'none',
                  flexWrap: isMobile ? 'wrap' : 'nowrap',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 8, flexShrink: 0,
                    background: item.severity === 'action' ? '#E5484D' : item.severity === 'review' ? '#F79009' : '#7C5CFC',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{item.title}</div>
                    <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 2 }}>{item.detail}</div>
                  </div>
                  <button
                    onClick={() => item.isInvites ? setTab('staff') : setSelected(item.person)}
                    style={{
                      padding: '8px 14px', borderRadius: 10, border: 'none', background: primary,
                      color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'inherit', flexShrink: 0,
                      width: isMobile ? '100%' : 'auto', marginTop: isMobile ? 8 : 0,
                    }}
                  >{item.isInvites ? 'Manage invites' : 'Review'}</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...CARD, padding: '26px 20px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>✓</div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
                Everything is up to date
              </div>
              <div style={{ fontSize: 13.5, color: '#8B87A3' }}>There are no outstanding HR actions.</div>
            </div>
          )}

          <div style={{ ...CARD, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Working today</div>
            <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.7 }}>
              {stats.active - stats.onLeave} staff working<br />
              {stats.onLeave} on leave
            </div>
            <button onClick={() => setTab('staff')} style={{
              marginTop: 12, padding: 0, border: 'none', background: 'transparent',
              color: primary, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>View staff →</button>
          </div>

          {leave.length > 0 && (
            <div style={{ ...CARD, padding: 18 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Coming up</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {leave.slice(0, 5).map(l => {
                  const person = directory.find(d => d.hr_id === l.staff_id)
                  return (
                    <div key={l.id} style={{ display: 'flex', gap: 12, fontSize: 13.5 }}>
                      <span style={{ color: '#94A3B8', minWidth: 62 }}>
                        {new Date(l.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span style={{ color: '#0F172A' }}>
                        {person?.full_name || 'Staff member'} — {l.type || 'Leave'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'staff' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{
                flex: 1, minWidth: 200, padding: '11px 14px', borderRadius: 11, fontSize: 14,
                border: '1px solid #E2E8F0', background: '#fff', color: '#0F172A',
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
              padding: '11px 13px', borderRadius: 11, fontSize: 13.5, fontWeight: 700,
              border: '1px solid #E2E8F0', background: '#fff', color: '#0F172A',
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="leave">On leave</option>
            </select>
          </div>

          {directory.length === 0 && (
            <div style={{ ...CARD, padding: '44px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Build your team</div>
              <div style={{ fontSize: 14, color: '#8B87A3', maxWidth: 360, margin: '0 auto 18px', lineHeight: 1.55 }}>
                Invite staff to create their LaunchSession account, and their compliance
                and leave will live here alongside it.
              </div>
              {isAdmin && (
                <button onClick={() => setInviteOpen(true)} style={{
                  padding: '12px 22px', borderRadius: 12, border: 'none', background: primary,
                  color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                }}>Invite Staff</button>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            {filtered.map((p, i) => {
              const dbs = complianceState(p.dbs_expiry, p.dbs_status)
              return (
                <motion.button
                  key={p.user_id || p.hr_id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.2) }}
                  onClick={() => setSelected(p)}
                  style={{ ...CARD, padding: 15, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: `${primary}18`, color: primary,
                      display: 'grid', placeItems: 'center', fontSize: 14.5, fontWeight: 800,
                    }}>{(p.full_name || '?').slice(0, 1).toUpperCase()}</div>

                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                        {p.full_name || 'Unnamed'}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 2 }}>
                        {p.job_title || p.role || 'Staff'}{p.email ? ` · ${p.email}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Pill state={dbs} />
                      {p.on_leave_today && (
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                          background: '#FEF6E7', color: '#93500A',
                        }}>On leave</span>
                      )}
                      {p.source === 'record' && (
                        // Distinguishes an HR record from an account: this person
                        // has no login yet, which changes what you can do for them.
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                          background: '#F3F2F7', color: '#5A5772',
                        }}>No account</span>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {invites.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>
                Pending invites ({invites.length})
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {invites.map(inv => (
                  <div key={inv.id} style={{ ...CARD, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                          {inv.full_name || inv.email}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#8B87A3', marginTop: 2 }}>
                          {inv.email} · {inv.role} · sent {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            await supabase.from('admin_invites').delete().eq('id', inv.id)
                            setNotice('Invite cancelled.')
                            load()
                          }}
                          style={{
                            padding: '8px 14px', borderRadius: 10, border: '1px solid #FECACA',
                            background: '#fff', color: '#B42318', fontSize: 12.5, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >Cancel</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && tab === 'compliance' && (
        <ComplianceTab directory={directory} isMobile={isMobile} onOpen={setSelected} />
      )}

      {!loading && tab === 'leave' && (
        <LeaveTab leave={leave} directory={directory} isMobile={isMobile} />
      )}

      {inviteOpen && (
        <InviteStaffModal
          org={org} primary={primary}
          onClose={() => setInviteOpen(false)}
          onSent={name => { setNotice(`Invite sent to ${name}.`); setInviteOpen(false); load() }}
        />
      )}
    </div>
  )
}

// --------------------------------------------------------------- compliance

function ComplianceTab({ directory, isMobile, onOpen }) {
  const rows = directory.map(p => ({
    ...p,
    dbs: complianceState(p.dbs_expiry, p.dbs_status),
    training: complianceState(p.safeguarding_training_expiry, null),
    firstAid: complianceState(p.first_aid_expiry, null),
  }))

  const needs = rows.filter(r => [r.dbs, r.training, r.firstAid].some(s => s === 'expired' || s === 'expiring'))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {needs.length > 0 && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #ECE9F5', fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
            Needs attention
          </div>
          {needs.map((r, i) => (
            <button key={r.user_id || r.hr_id} onClick={() => onOpen(r)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer',
              fontFamily: 'inherit',
              borderBottom: i < needs.length - 1 ? '1px solid #F5F3FA' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{r.full_name}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {r.dbs !== 'clear' && <Pill state={r.dbs} />}
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #ECE9F5', fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
          All staff compliance
        </div>

        {isMobile ? (
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            {rows.map(r => (
              <div key={r.user_id || r.hr_id} style={{ border: '1px solid #F1F5F9', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>{r.full_name}</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <Row label="DBS" state={r.dbs} />
                  <Row label="Safeguarding" state={r.training} />
                  <Row label="First aid" state={r.firstAid} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Staff', 'DBS', 'Safeguarding', 'First aid'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 16px', fontSize: 11.5, fontWeight: 700,
                    color: '#8B87A3', letterSpacing: 0.3, borderBottom: '1px solid #ECE9F5',
                  }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user_id || r.hr_id} onClick={() => onOpen(r)}
                  style={{ borderBottom: '1px solid #F5F3FA', cursor: 'pointer' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 700, color: '#0F172A' }}>{r.full_name}</td>
                  <td style={{ padding: '11px 16px' }}><Pill state={r.dbs} /></td>
                  <td style={{ padding: '11px 16px' }}><Pill state={r.training} /></td>
                  <td style={{ padding: '11px 16px' }}><Pill state={r.firstAid} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const Row = ({ label, state }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{ fontSize: 12.5, color: '#64748B', minWidth: 92 }}>{label}</span>
    <Pill state={state} />
  </div>
)

// -------------------------------------------------------------------- leave

function LeaveTab({ leave, directory }) {
  const today = londonToday()
  const nameFor = id => directory.find(d => d.hr_id === id)?.full_name || 'Staff member'
  const onNow = leave.filter(l => today >= l.start_date && today <= l.end_date)
  const upcoming = leave.filter(l => l.start_date > today)

  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...CARD, padding: 18 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Today</div>
        {onNow.length === 0 ? (
          <div style={{ fontSize: 13.5, color: '#8B87A3' }}>Nobody is on leave today.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {onNow.map(l => (
              <div key={l.id} style={{ fontSize: 13.5, color: '#0F172A' }}>
                {nameFor(l.staff_id)} — {l.type || 'Leave'} ({fmt(l.start_date)}–{fmt(l.end_date)})
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: 18 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Upcoming</div>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: 13.5, color: '#8B87A3' }}>No leave booked.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {upcoming.map(l => (
              <div key={l.id} style={{ fontSize: 13.5, color: '#0F172A' }}>
                {nameFor(l.staff_id)} — {l.type || 'Leave'} ({fmt(l.start_date)}–{fmt(l.end_date)})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------ staff profile

function StaffProfile({ person, org, leave, primary, isAdmin, hasHRModule, onBack, onChanged }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [bookingLeave, setBookingLeave] = useState(false)
  const theirLeave = leave.filter(l => l.staff_id === person.hr_id)

  const field = (label, value) => (
    <div key={label}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8B87A3', letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 14, color: '#0F172A', marginTop: 3 }}>{value || '—'}</div>
    </div>
  )

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100%', padding: isMobile ? 16 : 24 }}>
      <button onClick={onBack} style={{
        padding: '7px 13px', borderRadius: 9, border: '1px solid #E2E8F0',
        background: '#fff', color: '#64748B', fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14,
      }}>← Staff</button>

      <div style={{ ...CARD, padding: isMobile ? 18 : 22, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: `${primary}18`, color: primary,
            display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 800,
          }}>{(person.full_name || '?').slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>{person.full_name}</div>
            <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 2 }}>
              {person.job_title || person.role || 'Staff'} · {person.is_active ? 'Active' : 'Inactive'}
              {person.source === 'record' ? ' · No account' : ''}
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => setEditing(true)} style={{
              padding: '10px 16px', borderRadius: 11, border: '1px solid #E2E8F0',
              background: '#fff', color: '#0F172A', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Edit details</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {(hasHRModule
          ? [['overview', 'Overview'], ['compliance', 'Compliance'], ['leave', 'Leave']]
          : [['overview', 'Overview']]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 15px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${tab === k ? 'transparent' : '#E2E8F0'}`,
            background: tab === k ? primary : '#fff',
            color: tab === k ? '#fff' : '#64748B',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ ...CARD, padding: 20, display: 'grid', gap: 16 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}>
            {field('Full name', person.full_name)}
            {field('Email', person.email)}
            {field('Job title', person.job_title)}
            {field('Access role', person.role)}
            {field('Start date', person.start_date && new Date(person.start_date).toLocaleDateString('en-GB'))}
            {field('Account', person.source === 'account' ? 'Has a LaunchSession login' : 'No login yet')}
          </div>
        </div>
      )}

      {tab === 'compliance' && !hasHRModule && (
        <div style={{ ...CARD, padding: 22, fontSize: 13.5, color: '#64748B', lineHeight: 1.55 }}>
          Compliance tracking is part of the HR module.
        </div>
      )}

      {tab === 'compliance' && hasHRModule && (
        <div style={{ ...CARD, padding: 20, display: 'grid', gap: 16 }}>
          {[
            ['DBS', person.dbs_expiry, person.dbs_status],
            ['Safeguarding training', person.safeguarding_training_expiry, null],
            ['First aid', person.first_aid_expiry, null],
          ].map(([label, expiry, recorded]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', minWidth: 150 }}>{label}</div>
              <Pill state={complianceState(expiry, recorded)} />
              <div style={{ fontSize: 12.5, color: '#8B87A3' }}>
                {expiry ? `Expires ${new Date(expiry).toLocaleDateString('en-GB')}` : 'No expiry recorded'}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'leave' && (
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, color: '#64748B', flex: 1 }}>
              Allowance {person.leave_allowance ?? '—'} days
            </div>
            {isAdmin && person.hr_id && (
              <button onClick={() => setBookingLeave(true)} style={{
                padding: '9px 15px', borderRadius: 10, border: 'none', background: primary,
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>+ Record leave</button>
            )}
          </div>
          {isAdmin && !person.hr_id && (
            <div style={{ fontSize: 12.5, color: '#8B87A3', marginBottom: 12, lineHeight: 1.5 }}>
              Add employment details first — leave is recorded against a staff record.
            </div>
          )}
          {theirLeave.length === 0 ? (
            <div style={{ fontSize: 13.5, color: '#8B87A3' }}>No upcoming leave.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {theirLeave.map(l => (
                <div key={l.id} style={{ fontSize: 13.5, color: '#0F172A' }}>
                  {new Date(l.start_date).toLocaleDateString('en-GB')} – {new Date(l.end_date).toLocaleDateString('en-GB')} · {l.type || 'Leave'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditStaffModal
          person={person} org={org} primary={primary}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged?.() }}
        />
      )}

      {bookingLeave && (
        <RecordLeaveModal
          person={person} org={org} primary={primary}
          onClose={() => setBookingLeave(false)}
          onSaved={() => { setBookingLeave(false); onChanged?.() }}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ invite

function InviteStaffModal({ org, primary, onClose, onSent }) {
  const isMobile = useIsMobile()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const input = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
    border: '1px solid #E2E8F0', fontSize: 14.5, fontFamily: 'inherit', outline: 'none',
  }
  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

  const [existingUser, setExistingUser] = useState(false)

  async function send() {
    const clean = email.trim().toLowerCase()
    if (!clean) return
    setBusy(true); setError(null)

    const { data: alreadyHere } = await supabase.from('user_profiles')
      .select('id').eq('email', clean).eq('org_id', org.id).maybeSingle()
    if (alreadyHere) {
      setBusy(false)
      setError('This person is already in your team.')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/invite-volunteer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: clean, name: fullName, org_id: org.id, org_slug: org.slug, role,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setExistingUser(!!json.existing_user)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send the invite.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: isMobile ? '100%' : 440, maxWidth: '100%',
        borderRadius: isMobile ? '20px 20px 0 0' : 18, padding: 22,
      }}>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Invite sent</div>
            <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.55, marginBottom: 18 }}>
              {existingUser
                ? `${email} already had an account — they've been added to ${org?.name} and notified by email.`
                : `${fullName || email} has been invited to join ${org?.name}. They'll get an email to set up their account.`}
            </div>
            <button onClick={() => onSent(fullName || email)} style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: primary, color: '#fff', fontSize: 14.5, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>Invite staff</div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={label}>FIRST NAME</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} style={input} />
                </div>
                <div>
                  <label style={label}>LAST NAME</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} style={input} />
                </div>
              </div>
              <div>
                <label style={label}>EMAIL</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={input} />
              </div>
              <div>
                <label style={label}>ROLE</label>
                <select value={role} onChange={e => setRole(e.target.value)} style={input}>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {error && (
                <div style={{
                  padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
                  border: '1px solid #FECACA', color: '#B42318', fontSize: 13,
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{
                  padding: '12px 18px', borderRadius: 12, border: '1px solid #E2E8F0',
                  background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
                <button onClick={send} disabled={busy || !email.trim()} style={{
                  flex: 1, padding: '12px 18px', borderRadius: 12, border: 'none',
                  background: busy || !email.trim() ? '#E2E8F0' : primary, color: '#fff',
                  fontSize: 14, fontWeight: 800,
                  cursor: busy || !email.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}>{busy ? 'Sending…' : 'Send invite'}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------- edit staff record

/**
 * Creates or updates the hr_staff record behind a person.
 *
 * An account with no HR record has hr_id null; saving creates the row and links
 * it by user_id. Without this the directory could show people but never record
 * anything about them, which was the state the first version shipped in.
 */
export function EditStaffModal({ person, org, primary, onClose, onSaved }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    job_title: person.job_title || '',
    dbs_status: person.dbs_status || '',
    dbs_expiry: person.dbs_expiry || '',
    safeguarding_training_expiry: person.safeguarding_training_expiry || '',
    first_aid_expiry: person.first_aid_expiry || '',
    start_date: person.start_date || '',
    leave_allowance: person.leave_allowance ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const input = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
    border: '1px solid #E2E8F0', fontSize: 14.5, fontFamily: 'inherit', outline: 'none',
  }
  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true); setError(null)
    const payload = {
      org_id: org.id,
      full_name: person.full_name,
      email: person.email,
      role: person.role,
      job_title: form.job_title || null,
      dbs_status: form.dbs_status || null,
      dbs_expiry: form.dbs_expiry || null,
      safeguarding_training_expiry: form.safeguarding_training_expiry || null,
      first_aid_expiry: form.first_aid_expiry || null,
      start_date: form.start_date || null,
      leave_allowance: form.leave_allowance === '' ? null : Number(form.leave_allowance),
      updated_at: new Date().toISOString(),
    }

    let e
    if (person.hr_id) {
      ({ error: e } = await supabase.from('hr_staff').update(payload).eq('id', person.hr_id).eq('org_id', org.id))
    } else {
      // First time: create the record and link it to the account.
      ({ error: e } = await supabase.from('hr_staff').insert({ ...payload, user_id: person.user_id || null }))
    }

    setBusy(false)
    if (e) { setError(e.message); return }
    onSaved?.()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: isMobile ? '100%' : 480, maxWidth: '100%',
        borderRadius: isMobile ? '20px 20px 0 0' : 18, padding: 22,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
          {person.full_name}
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>
          Employment and compliance details
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={label}>JOB TITLE</label>
            <input value={form.job_title} onChange={set('job_title')} style={input} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>DBS STATUS</label>
              <select value={form.dbs_status} onChange={set('dbs_status')} style={input}>
                <option value="">Not recorded</option>
                <option value="clear">Clear</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label style={label}>DBS EXPIRY</label>
              <input type="date" value={form.dbs_expiry} onChange={set('dbs_expiry')} style={input} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>SAFEGUARDING EXPIRY</label>
              <input type="date" value={form.safeguarding_training_expiry}
                onChange={set('safeguarding_training_expiry')} style={input} />
            </div>
            <div>
              <label style={label}>FIRST AID EXPIRY</label>
              <input type="date" value={form.first_aid_expiry} onChange={set('first_aid_expiry')} style={input} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>START DATE</label>
              <input type="date" value={form.start_date} onChange={set('start_date')} style={input} />
            </div>
            <div>
              <label style={label}>LEAVE ALLOWANCE (DAYS)</label>
              <input type="number" value={form.leave_allowance} onChange={set('leave_allowance')} style={input} />
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
              border: '1px solid #FECACA', color: '#B42318', fontSize: 13,
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              padding: '12px 18px', borderRadius: 12, border: '1px solid #E2E8F0',
              background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button onClick={save} disabled={busy} style={{
              flex: 1, padding: '12px 18px', borderRadius: 12, border: 'none',
              background: busy ? '#E2E8F0' : primary, color: '#fff',
              fontSize: 14, fontWeight: 800,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Books leave against a staff member's HR record. */
export function RecordLeaveModal({ person, org, primary, onClose, onSaved }) {
  const isMobile = useIsMobile()
  const [type, setType] = useState('Annual leave')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const input = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
    border: '1px solid #E2E8F0', fontSize: 14.5, fontFamily: 'inherit', outline: 'none',
  }
  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 6 }

  async function save() {
    if (!start || !end) return
    if (end < start) { setError('The end date is before the start date.'); return }
    setBusy(true); setError(null)

    const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1
    const { error: e } = await supabase.from('staff_leave').insert({
      staff_id: person.hr_id, org_id: org.id, type, start_date: start, end_date: end, days,
    })
    setBusy(false)
    if (e) { setError(e.message); return }
    onSaved?.()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: isMobile ? '100%' : 420, maxWidth: '100%',
        borderRadius: isMobile ? '20px 20px 0 0' : 18, padding: 22,
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 18 }}>
          Record leave — {person.full_name}
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={label}>TYPE</label>
            <select value={type} onChange={e => setType(e.target.value)} style={input}>
              {['Annual leave', 'Sick leave', 'Unpaid leave', 'Parental leave', 'Other'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>FROM</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>TO</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={input} />
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
              border: '1px solid #FECACA', color: '#B42318', fontSize: 13,
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              padding: '12px 18px', borderRadius: 12, border: '1px solid #E2E8F0',
              background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button onClick={save} disabled={busy || !start || !end} style={{
              flex: 1, padding: '12px 18px', borderRadius: 12, border: 'none',
              background: busy || !start || !end ? '#E2E8F0' : primary, color: '#fff',
              fontSize: 14, fontWeight: 800,
              cursor: busy || !start || !end ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>{busy ? 'Saving…' : 'Record leave'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
