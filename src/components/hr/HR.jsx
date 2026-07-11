import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format, differenceInDays, isWithinInterval, parseISO } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { useIsMobile } from '../../hooks/useIsMobile'

const ROLES = ['Programme Lead', 'Coach', 'Coordinator', 'Administrator', 'Volunteer Lead', 'Safeguarding Lead', 'Finance Manager', 'Outreach Worker', 'Youth Worker', 'Other']
const CONTRACT_TYPES = ['Permanent', 'Fixed Term', 'Part Time', 'Zero Hours', 'Freelance', 'Volunteer']
const ACCOUNT_ROLES = ['staff', 'admin']
const LEAVE_TYPES = [
  { key: 'annual',    label: 'Annual Leave',    icon: '🏖️', color: '#3B82F6' },
  { key: 'sick',      label: 'Sick Leave',      icon: '🤒', color: '#EF4444' },
  { key: 'training',  label: 'Training',        icon: '📚', color: '#8B5CF6' },
  { key: 'toil',      label: 'TOIL',            icon: '⏰', color: '#F59E0B' },
  { key: 'unpaid',    label: 'Unpaid',          icon: '💸', color: '#6B7280' },
  { key: 'other',     label: 'Other',           icon: '📋', color: '#6B7280' },
]
const DBS_STATUS = {
  clear:    { label: 'Clear',    color: '#16A34A', bg: '#F0FDF4' },
  pending:  { label: 'Pending',  color: '#F59E0B', bg: '#FFFBEB' },
  expired:  { label: 'Expired',  color: '#DC2626', bg: '#FEF2F2' },
  none:     { label: 'None',     color: '#6B7280', bg: '#F9FAFB' },
}
const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }
const label = { fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }
const today = new Date()

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase()
}

function AccountBadge({ status }) {
  const cfg = {
    active:   { label: 'Active login',   color: '#16A34A', bg: '#F0FDF4' },
    pending:  { label: 'Invite pending', color: '#D97706', bg: '#FFFBEB' },
    none:     { label: 'Not invited',    color: '#6B7280', bg: '#F9FAFB' },
  }[status] || { label: 'Not invited', color: '#6B7280', bg: '#F9FAFB' }
  return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}

// ─────────────────────────────────────────────────────────────────────────
// Donut chart — pure SVG, no chart library needed
// ─────────────────────────────────────────────────────────────────────────
function Donut({ segments, size = 150, thickness = 20 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const frac = seg.value / total
        const dash = frac * circumference
        const el = (
          <motion.circle
            key={seg.label}
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            initial={{ opacity: 0 }} animate={{ opacity: seg.value ? 1 : 0 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────
function KpiCard({ icon, label: lbl, value, color, sub, onClick, active }) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -3, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
      style={{
        background: '#fff', borderRadius: 16, padding: '16px 18px',
        border: `1.5px solid ${active ? (color || '#8B5CF6') : '#e5e7eb'}`,
        cursor: onClick ? 'pointer' : 'default', minWidth: 0,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.3 }}>{lbl}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: color || '#111827', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Staff profile slide-over
// ─────────────────────────────────────────────────────────────────────────
function StaffPanel({ staff, org, session, accountStatus, onClose, onUpdate, onInviteSent, showToast }) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('profile')
  const [leaveLog, setLeaveLog] = useState([])
  const [showLeave, setShowLeave] = useState(false)
  const [newLeave, setNewLeave] = useState({ type: 'annual', start_date: '', end_date: '', notes: '' })
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...staff })
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [accountRole, setAccountRole] = useState('staff')
  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    supabase.from('staff_leave').select('*').eq('staff_id', staff.id).order('start_date', { ascending: false }).then(({ data }) => setLeaveLog(data || []))
  }, [staff.id])

  const addLeave = async () => {
    if (!newLeave.start_date || !newLeave.end_date) return
    const days = differenceInDays(new Date(newLeave.end_date), new Date(newLeave.start_date)) + 1
    const { data } = await supabase.from('staff_leave').insert({ ...newLeave, staff_id: staff.id, org_id: org.id, days }).select().single()
    if (data) setLeaveLog(l => [data, ...l])
    setShowLeave(false)
    setNewLeave({ type: 'annual', start_date: '', end_date: '', notes: '' })
  }

  const saveEdit = async () => {
    setSaving(true)
    const { data, error } = await supabase.from('hr_staff').update(editForm).eq('id', staff.id).select().single()
    setSaving(false)
    if (data) { onUpdate(data); setEditing(false); showToast('Changes saved', 'success') }
    else if (error) showToast(error.message, 'error')
  }

  const toggleActive = async () => {
    const { data, error } = await supabase.from('hr_staff').update({ is_active: !staff.is_active }).eq('id', staff.id).select().single()
    if (data) { onUpdate(data); showToast(data.is_active ? 'Marked as active' : 'Marked as inactive', 'success') }
    else if (error) showToast(error.message, 'error')
  }

  const sendInvite = async () => {
    if (!staff.email) { showToast('Add an email address first', 'error'); return }
    setInviting(true)
    try {
      const { data: { session: liveSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/invite-volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${liveSession?.access_token}` },
        body: JSON.stringify({ email: staff.email, name: staff.full_name, org_id: org.id, org_slug: org.slug, role: accountRole }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      showToast(json.existing_user ? `${staff.email} already had an account — added to ${org?.name}.` : `Invite sent to ${staff.email}.`, 'success')
      onInviteSent()
    } catch (err) {
      showToast(err.message || 'Failed to send invite', 'error')
    }
    setInviting(false)
  }

  const dbs = DBS_STATUS[staff.dbs_status || 'none']
  const annualLeave = leaveLog.filter(l => l.type === 'annual').reduce((s, l) => s + (l.days || 0), 0)

  return (
    <>
      <motion.div
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.35)', zIndex: 60 }}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: isMobile ? '100%' : 480,
          background: '#fff', zIndex: 61, overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
          padding: isMobile ? '18px 16px 40px' : '26px 28px 40px',
        }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>✕ Close</button>

        <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}06)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 900, flexShrink: 0 }}>
                {initials(staff.full_name)}
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 900 }}>{staff.full_name}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{staff.role} · {staff.contract_type}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ background: dbs.bg, color: dbs.color, borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>🔍 DBS: {dbs.label}</span>
                  {staff.is_active === false && <span style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>Inactive</span>}
                  <AccountBadge status={accountStatus} />
                </div>
              </div>
            </div>
            <button onClick={() => setEditing(!editing)} style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {editing ? '✕ Cancel' : '✏️ Edit'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={toggleActive} style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 11, fontWeight: 700, color: '#374151', cursor: 'pointer' }}>
              {staff.is_active === false ? '✓ Mark Active' : '⏸ Mark Inactive'}
            </button>
          </div>
        </div>

        {editing && (
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div><label style={label}>Full Name</label><input value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Role</label><select value={editForm.role || ''} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={inp}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
              <div><label style={label}>Email</label><input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Phone</label><input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Contract Type</label><select value={editForm.contract_type || ''} onChange={e => setEditForm(f => ({ ...f, contract_type: e.target.value }))} style={inp}>{CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={label}>DBS Status</label><select value={editForm.dbs_status || 'none'} onChange={e => setEditForm(f => ({ ...f, dbs_status: e.target.value }))} style={inp}>{Object.entries(DBS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label style={label}>DBS Expiry</label><input type="date" value={editForm.dbs_expiry || ''} onChange={e => setEditForm(f => ({ ...f, dbs_expiry: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Start Date</label><input type="date" value={editForm.start_date || ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Annual Leave Allowance (days)</label><input type="number" value={editForm.leave_allowance || 28} onChange={e => setEditForm(f => ({ ...f, leave_allowance: e.target.value }))} style={inp} /></div>
              <div><label style={label}>Notes</label><textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditing(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
          {[['profile', '📋 Profile'], ['leave', '🏖️ Leave'], ['account', '🔐 Account']].map(([key, lbl]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{ padding: '10px 16px', border: 'none', borderBottom: `2.5px solid ${activeTab === key ? primary : 'transparent'}`, background: 'transparent', color: activeTab === key ? primary : '#6B7280', fontWeight: activeTab === key ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Contact Info</div>
              {[['Email', staff.email], ['Phone', staff.phone], ['Role', staff.role], ['Contract', staff.contract_type]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E5E7EB', fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>{k}</span><span style={{ fontWeight: 600 }}>{v || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Compliance</div>
              {[
                ['DBS Status', <span style={{ color: dbs.color, fontWeight: 800 }}>{dbs.label}</span>],
                ['DBS Expiry', staff.dbs_expiry ? format(new Date(staff.dbs_expiry), 'd MMM yyyy') : '—'],
                ['Start Date', staff.start_date ? format(new Date(staff.start_date), 'd MMM yyyy') : '—'],
                ['Leave Allowance', `${staff.leave_allowance || 28} days`],
                ['Annual Used', `${annualLeave} days`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E5E7EB', fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            {staff.notes && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E', marginBottom: 6 }}>📝 Notes</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{staff.notes}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leave' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Leave Records</div>
              <button onClick={() => setShowLeave(!showLeave)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>+ Log Leave</button>
            </div>
            {showLeave && (
              <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={label}>TYPE</label>
                    <select value={newLeave.type} onChange={e => setNewLeave(n => ({ ...n, type: e.target.value }))} style={inp}>
                      {LEAVE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}><label style={label}>FROM</label><input type="date" value={newLeave.start_date} onChange={e => setNewLeave(n => ({ ...n, start_date: e.target.value }))} style={inp} /></div>
                    <div style={{ flex: 1 }}><label style={label}>TO</label><input type="date" value={newLeave.end_date} onChange={e => setNewLeave(n => ({ ...n, end_date: e.target.value }))} style={inp} /></div>
                  </div>
                  <div><label style={label}>NOTES</label><input value={newLeave.notes} onChange={e => setNewLeave(n => ({ ...n, notes: e.target.value }))} placeholder="Optional notes..." style={inp} /></div>
                </div>
                <button onClick={addLeave} disabled={!newLeave.start_date || !newLeave.end_date} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Log Leave</button>
              </div>
            )}
            {leaveLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, background: '#F9FAFB', borderRadius: 12, color: '#9CA3AF' }}>No leave records yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leaveLog.map(leave => {
                  const typeCfg = LEAVE_TYPES.find(t => t.key === leave.type) || LEAVE_TYPES[5]
                  return (
                    <div key={leave.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18 }}>{typeCfg.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{typeCfg.label}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{format(new Date(leave.start_date), 'd MMM')} – {format(new Date(leave.end_date), 'd MMM yyyy')} · {leave.days} day{leave.days !== 1 ? 's' : ''}</div>
                        {leave.notes && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{leave.notes}</div>}
                      </div>
                      <span style={{ background: typeCfg.color + '15', color: typeCfg.color, borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>{leave.days}d</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div>
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>LaunchSession Login</div>
                <AccountBadge status={accountStatus} />
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 14 }}>
                {accountStatus === 'active' && 'This person already has an active LaunchSession account and can sign in.'}
                {accountStatus === 'pending' && 'An invite has been sent — they haven\'t set their password yet.'}
                {accountStatus === 'none' && 'This person has no LaunchSession login yet. Send them an invite so they can sign in, view their sessions and record their own DBS/training documents.'}
              </div>
              {accountStatus !== 'active' && (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <label style={label}>ACCOUNT ROLE</label>
                    <select value={accountRole} onChange={e => setAccountRole(e.target.value)} style={inp}>
                      {ACCOUNT_ROLES.map(r => <option key={r} value={r}>{r === 'admin' ? 'Admin (full access)' : 'Staff'}</option>)}
                    </select>
                  </div>
                  <button onClick={sendInvite} disabled={inviting || !staff.email} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: !staff.email ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, fontSize: 13, cursor: staff.email ? 'pointer' : 'not-allowed' }}>
                    {inviting ? 'Sending…' : accountStatus === 'pending' ? '↻ Resend Invite' : '✉️ Send Invite'}
                  </button>
                  {!staff.email && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>Add an email address above to invite this person.</div>}
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Add / Invite staff modal
// ─────────────────────────────────────────────────────────────────────────
function AddStaffModal({ org, onClose, onAdded, showToast }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState({ full_name: '', role: 'Coach', email: '', phone: '', contract_type: 'Permanent', dbs_status: 'none', start_date: '', leave_allowance: 28 })
  const [sendInvite, setSendInvite] = useState(true)
  const [accountRole, setAccountRole] = useState('staff')
  const [saving, setSaving] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  const submit = async () => {
    if (!form.full_name) return
    setSaving(true)
    const { data, error } = await supabase.from('hr_staff').insert({ ...form, org_id: org.id, is_active: true }).select().single()
    if (error) { showToast(error.message, 'error'); setSaving(false); return }

    let inviteMsg = null
    if (sendInvite && form.email) {
      try {
        const { data: { session: liveSession } } = await supabase.auth.getSession()
        const res = await fetch('/api/invite-volunteer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${liveSession?.access_token}` },
          body: JSON.stringify({ email: form.email, name: form.full_name, org_id: org.id, org_slug: org.slug, role: accountRole }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        inviteMsg = json.existing_user ? `Added — ${form.email} already had an account.` : `Added and invited — ${form.email} will get a branded email.`
      } catch (err) {
        inviteMsg = `Staff record added, but the invite failed to send: ${err.message}`
      }
    }

    setSaving(false)
    onAdded(data)
    showToast(inviteMsg || `${form.full_name} added.`, inviteMsg && inviteMsg.includes('failed') ? 'error' : 'success')
    onClose()
  }

  return (
    <>
      <motion.div onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', zIndex: 70 }} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 71,
          background: '#fff', borderRadius: 20, padding: isMobile ? 20 : 26, width: isMobile ? '92%' : 560,
          maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>🧑‍💼 Add Staff Member</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div><label style={label}>FULL NAME *</label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} style={inp} /></div>
          <div><label style={label}>ROLE (JOB TITLE)</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inp}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
          <div><label style={label}>EMAIL</label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} /></div>
          <div><label style={label}>PHONE</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} /></div>
          <div><label style={label}>CONTRACT TYPE</label><select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} style={inp}>{CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label style={label}>DBS STATUS</label><select value={form.dbs_status} onChange={e => setForm(f => ({ ...f, dbs_status: e.target.value }))} style={inp}>{Object.entries(DBS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label style={label}>START DATE</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} /></div>
          <div><label style={label}>LEAVE ALLOWANCE (days)</label><input type="number" value={form.leave_allowance} onChange={e => setForm(f => ({ ...f, leave_allowance: e.target.value }))} style={inp} /></div>
        </div>

        <div style={{ background: '#F5F3FF', border: '1.5px solid #DDD6FE', borderRadius: 14, padding: 16, marginBottom: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: sendInvite ? 12 : 0 }}>
            <input type="checkbox" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 13, fontWeight: 800 }}>✉️ Send them a LaunchSession login invite</span>
          </label>
          {sendInvite && (
            <div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 1.5 }}>They'll get a branded email to set a password and sign in. Requires an email address above.</div>
              <label style={label}>ACCOUNT ROLE</label>
              <select value={accountRole} onChange={e => setAccountRole(e.target.value)} style={inp}>
                {ACCOUNT_ROLES.map(r => <option key={r} value={r}>{r === 'admin' ? 'Admin (full access)' : 'Staff'}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submit} disabled={saving || !form.full_name} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: saving || !form.full_name ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Adding…' : '+ Add Staff'}</button>
          <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        </div>
      </motion.div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Main HR Centre
// ─────────────────────────────────────────────────────────────────────────
export default function HR({ org, session }) {
  const isMobile = useIsMobile()
  const [staff, setStaff] = useState([])
  const [profiles, setProfiles] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [allLeave, setAllLeave] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    clearTimeout(showToast._t)
    showToast._t = setTimeout(() => setToast(null), 4500)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [staffRes, profilesRes, invitesRes, leaveRes] = await Promise.all([
      supabase.from('hr_staff').select('*, staff_leave(count)').eq('org_id', org.id).order('full_name'),
      supabase.from('user_profiles').select('id,email,role,status').eq('org_id', org.id),
      supabase.from('admin_invites').select('id,email,role,status,created_at').eq('org_id', org.id).eq('status', 'pending'),
      supabase.from('staff_leave').select('id,staff_id,type,start_date,end_date').eq('org_id', org.id).gte('end_date', format(today, 'yyyy-MM-dd')),
    ])
    setStaff(staffRes.data || [])
    setProfiles(profilesRes.data || [])
    setPendingInvites(invitesRes.data || [])
    setAllLeave(leaveRes.data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  // Map email -> account status (active / pending / none)
  const accountStatusByEmail = useMemo(() => {
    const map = {}
    profiles.forEach(p => { if (p.email) map[p.email.toLowerCase()] = p.status === 'pending_invite' ? 'pending' : 'active' })
    pendingInvites.forEach(inv => { const e = inv.email?.toLowerCase(); if (e && !map[e]) map[e] = 'pending' })
    return map
  }, [profiles, pendingInvites])

  const getAccountStatus = (member) => member.email ? (accountStatusByEmail[member.email.toLowerCase()] || 'none') : 'none'

  const onLeaveTodayIds = useMemo(() => {
    const set = new Set()
    allLeave.forEach(l => {
      try {
        if (isWithinInterval(today, { start: parseISO(l.start_date), end: parseISO(l.end_date) })) set.add(l.staff_id)
      } catch { /* ignore malformed dates */ }
    })
    return set
  }, [allLeave])

  const upcoming = useMemo(() => {
    const items = []
    staff.forEach(s => {
      if (s.dbs_expiry && s.is_active !== false) {
        const days = differenceInDays(new Date(s.dbs_expiry), today)
        if (days >= 0 && days <= 90) items.push({ key: `dbs-${s.id}`, date: s.dbs_expiry, days, label: `${s.full_name} — DBS renewal`, chip: 'DBS', color: '#DC2626' })
      }
    })
    allLeave.forEach(l => {
      const days = differenceInDays(parseISO(l.start_date), today)
      if (days >= 0 && days <= 30) {
        const member = staff.find(s => s.id === l.staff_id)
        const typeCfg = LEAVE_TYPES.find(t => t.key === l.type) || LEAVE_TYPES[5]
        items.push({ key: `leave-${l.id}`, date: l.start_date, days, label: `${member?.full_name || 'Staff'} — ${typeCfg.label}`, chip: typeCfg.label, color: typeCfg.color })
      }
    })
    return items.sort((a, b) => a.days - b.days).slice(0, 6)
  }, [staff, allLeave])

  let filtered = staff
  if (filter === 'active') filtered = filtered.filter(s => s.is_active !== false)
  if (filter === 'inactive') filtered = filtered.filter(s => s.is_active === false)
  if (filter === 'dbs_expiring') filtered = filtered.filter(s => s.dbs_expiry && differenceInDays(new Date(s.dbs_expiry), today) < 90 && differenceInDays(new Date(s.dbs_expiry), today) >= 0)
  if (filter === 'on_leave') filtered = filtered.filter(s => onLeaveTodayIds.has(s.id))
  if (filter === 'pending_invite') filtered = filtered.filter(s => getAccountStatus(s) === 'pending')
  if (filter === 'not_invited') filtered = filtered.filter(s => getAccountStatus(s) === 'none')
  if (search) filtered = filtered.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || (s.role || '').toLowerCase().includes(search.toLowerCase()))

  const dbsExpiringCount = staff.filter(s => s.dbs_expiry && differenceInDays(new Date(s.dbs_expiry), today) < 90 && differenceInDays(new Date(s.dbs_expiry), today) >= 0 && s.is_active !== false).length
  const activeCount = staff.filter(s => s.is_active !== false).length
  const dbsClearCount = staff.filter(s => s.dbs_status === 'clear').length

  const exportCsv = () => {
    const rows = filtered.map(s => ({
      'Full Name': s.full_name, Role: s.role, Email: s.email, Phone: s.phone,
      'Contract Type': s.contract_type, Status: s.is_active === false ? 'Inactive' : 'Active',
      'DBS Status': DBS_STATUS[s.dbs_status || 'none'].label, 'DBS Expiry': s.dbs_expiry || '',
      'Start Date': s.start_date || '', 'Login Status': getAccountStatus(s),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Staff')
    XLSX.writeFile(wb, `${org?.slug || 'staff'}-hr-export-${format(today, 'yyyy-MM-dd')}.xlsx`)
    showToast(`Exported ${rows.length} staff record${rows.length !== 1 ? 's' : ''}.`, 'success')
  }

  const resendAllPending = async () => {
    if (pendingInvites.length === 0) { showToast('No pending invites to resend', 'error'); return }
    if (!window.confirm(`Resend ${pendingInvites.length} pending invite(s)?`)) return
    const { data: { session: liveSession } } = await supabase.auth.getSession()
    let sent = 0
    for (const invite of pendingInvites) {
      try {
        const res = await fetch('/api/invite-volunteer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${liveSession?.access_token}` },
          body: JSON.stringify({ email: invite.email, name: invite.email.split('@')[0], org_id: org.id, org_slug: org.slug, role: invite.role }),
        })
        const json = await res.json()
        if (!json.error) sent += 1
      } catch { /* continue */ }
    }
    showToast(`Resent ${sent} of ${pendingInvites.length} invites.`, 'success')
  }

  const donutSegments = [
    { label: 'Active', value: activeCount - onLeaveTodayIds.size, color: primary },
    { label: 'On Leave', value: [...onLeaveTodayIds].filter(id => staff.find(s => s.id === id)?.is_active !== false).length, color: '#F59E0B' },
    { label: 'DBS Expiring', value: dbsExpiringCount, color: '#DC2626' },
    { label: 'Inactive', value: staff.length - activeCount, color: '#D1D5DB' },
  ].filter(s => s.value > 0)

  const filterChips = [
    ['active', 'Active'], ['inactive', 'Inactive'], ['dbs_expiring', 'DBS Expiring'],
    ['on_leave', 'On Leave'], ['pending_invite', 'Pending Invite'], ['not_invited', 'Not Invited'], ['all', 'All'],
  ]

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            style={{
              position: 'fixed', top: 18, right: 18, zIndex: 90, maxWidth: 360,
              background: toast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
              border: `1.5px solid ${toast.type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
              color: toast.type === 'error' ? '#991B1B' : '#166534',
              borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}06)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>🧑‍💼 HR Centre</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Manage your staff, compliance and leave — all in one place.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <motion.button whileHover={{ y: -2 }} onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Add Staff Member</motion.button>
            <motion.button whileHover={{ y: -2 }} onClick={exportCsv} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>⬇️ Export</motion.button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
        <KpiCard icon="👥" label="Total Staff" value={staff.length} onClick={() => setFilter('all')} active={filter === 'all'} />
        <KpiCard icon="✅" label="Active" value={activeCount} color="#16A34A" onClick={() => setFilter('active')} active={filter === 'active'} />
        <KpiCard icon="🔍" label="DBS Clear" value={dbsClearCount} color="#3B82F6" />
        <KpiCard icon="⚠️" label="DBS Expiring" value={dbsExpiringCount} color={dbsExpiringCount > 0 ? '#DC2626' : '#9CA3AF'} onClick={() => setFilter('dbs_expiring')} active={filter === 'dbs_expiring'} />
        <KpiCard icon="🏖️" label="On Leave Today" value={onLeaveTodayIds.size} color="#F59E0B" onClick={() => setFilter('on_leave')} active={filter === 'on_leave'} />
        <KpiCard icon="✉️" label="Pending Invites" value={pendingInvites.length} color={pendingInvites.length > 0 ? '#D97706' : '#9CA3AF'} onClick={() => setFilter('pending_invite')} active={filter === 'pending_invite'} />
      </div>

      {/* Overview + Quick actions + Upcoming */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>Team Overview</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>A snapshot of your team</div>
          {staff.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No staff yet</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Donut segments={donutSegments} size={120} thickness={16} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{staff.length}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>Total</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {donutSegments.map(seg => (
                  <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: seg.color, flexShrink: 0 }} />
                    <span style={{ color: '#6B7280', flex: 1 }}>{seg.label}</span>
                    <span style={{ fontWeight: 800 }}>{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>⚡ Quick Actions</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>Common HR tasks</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { icon: '➕', label: 'Add Staff', sub: 'Invite or add', onClick: () => setShowAdd(true) },
              { icon: '⬇️', label: 'Export', sub: 'Download list', onClick: exportCsv },
              { icon: '↻', label: 'Resend All', sub: `${pendingInvites.length} pending`, onClick: resendAllPending },
              { icon: '🔄', label: 'Refresh', sub: 'Reload data', onClick: load },
            ].map(a => (
              <motion.button key={a.label} whileHover={{ y: -2, backgroundColor: '#F9FAFB' }} onClick={a.onClick}
                style={{ textAlign: 'left', padding: '12px 12px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{a.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{a.label}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{a.sub}</div>
              </motion.button>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>📅 Upcoming</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>DBS renewals &amp; leave, next 90 days</div>
          {upcoming.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nothing coming up</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {upcoming.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ background: item.color + '18', color: item.color, borderRadius: 7, padding: '2px 8px', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{item.chip}</span>
                  <span style={{ flex: 1, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  <span style={{ color: '#9CA3AF', flexShrink: 0 }}>{item.days === 0 ? 'Today' : `${item.days}d`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search staff..." style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        {filterChips.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${filter === k ? primary : '#e5e7eb'}`, background: filter === k ? primary + '12' : '#fff', color: filter === k ? primary : '#6B7280', fontSize: 12, fontWeight: filter === k ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{l}</button>
        ))}
      </div>

      {/* Staff table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading staff...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{staff.length === 0 ? 'Build your dream team' : 'No matching staff'}</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>{staff.length === 0 ? 'Invite your first staff member to begin managing your workforce.' : 'Try a different filter or search term.'}</div>
          {staff.length === 0 && <button onClick={() => setShowAdd(true)} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Add First Staff Member</button>}
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(member => {
            const dbs = DBS_STATUS[member.dbs_status || 'none']
            const dbsExpiring = member.dbs_expiry && differenceInDays(new Date(member.dbs_expiry), today) < 90 && differenceInDays(new Date(member.dbs_expiry), today) >= 0
            return (
              <div key={member.id} onClick={() => setSelected(member)} style={{ background: '#fff', border: `1px solid ${dbsExpiring ? '#FDE68A' : '#e5e7eb'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: primary, flexShrink: 0 }}>{initials(member.full_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{member.full_name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{member.role}</div>
                </div>
                <AccountBadge status={getAccountStatus(member)} />
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.9fr 0.9fr 1.2fr', gap: 8, padding: '12px 18px', background: '#F9FAFB', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.3, position: 'sticky', top: 0, zIndex: 1 }}>
            <div>Staff Member</div><div>Role</div><div>Contract</div><div>DBS</div><div>Status</div><div>Login</div>
          </div>
          {filtered.map(member => {
            const dbs = DBS_STATUS[member.dbs_status || 'none']
            const dbsExpiring = member.dbs_expiry && differenceInDays(new Date(member.dbs_expiry), today) < 90 && differenceInDays(new Date(member.dbs_expiry), today) >= 0
            const onLeave = onLeaveTodayIds.has(member.id)
            return (
              <motion.div key={member.id} onClick={() => setSelected(member)} whileHover={{ backgroundColor: '#FAFAFA' }}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.9fr 0.9fr 1.2fr', gap: 8, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: primary, flexShrink: 0 }}>{initials(member.full_name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email || 'No email'}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: '#374151' }}>{member.role}</div>
                <div style={{ fontSize: 12.5, color: '#374151' }}>{member.contract_type}</div>
                <div>
                  <span style={{ background: dbs.bg, color: dbs.color, borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{dbs.label}</span>
                  {dbsExpiring && <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700, marginTop: 2 }}>⚠️ Expiring</div>}
                </div>
                <div>
                  {member.is_active === false
                    ? <span style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>Inactive</span>
                    : onLeave
                      ? <span style={{ background: '#FFFBEB', color: '#D97706', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>On Leave</span>
                      : <span style={{ background: '#F0FDF4', color: '#16A34A', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>Active</span>}
                </div>
                <div><AccountBadge status={getAccountStatus(member)} /></div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Slide-over */}
      <AnimatePresence>
        {selected && (
          <StaffPanel
            staff={selected}
            org={org}
            session={session}
            accountStatus={getAccountStatus(selected)}
            onClose={() => setSelected(null)}
            onUpdate={u => { setStaff(s => s.map(x => x.id === u.id ? { ...x, ...u } : x)); setSelected(u) }}
            onInviteSent={load}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Add staff modal */}
      <AnimatePresence>
        {showAdd && (
          <AddStaffModal
            org={org}
            onClose={() => setShowAdd(false)}
            onAdded={data => setStaff(s => [...s, { ...data, staff_leave: [{ count: 0 }] }].sort((a, b) => a.full_name.localeCompare(b.full_name)))}
            showToast={showToast}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
