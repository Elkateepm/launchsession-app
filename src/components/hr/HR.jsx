import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, differenceInDays } from 'date-fns'

const ROLES = ['Programme Lead', 'Coach', 'Coordinator', 'Administrator', 'Volunteer Lead', 'Safeguarding Lead', 'Finance Manager', 'Outreach Worker', 'Youth Worker', 'Other']
const CONTRACT_TYPES = ['Permanent', 'Fixed Term', 'Part Time', 'Zero Hours', 'Freelance', 'Volunteer']
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

function StaffDetail({ staff, org, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [leaveLog, setLeaveLog] = useState([])
  const [showLeave, setShowLeave] = useState(false)
  const [newLeave, setNewLeave] = useState({ type: 'annual', start_date: '', end_date: '', notes: '' })
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...staff })
  const [saving, setSaving] = useState(false)
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
    const { data } = await supabase.from('hr_staff').update(editForm).eq('id', staff.id).select().single()
    setSaving(false)
    if (data) { onUpdate(data); setEditing(false) }
  }

  const dbs = DBS_STATUS[staff.dbs_status || 'none']
  const annualLeave = leaveLog.filter(l => l.type === 'annual').reduce((s, l) => s + (l.days || 0), 0)
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: primary, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>← Back to Team</button>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}06)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 900 }}>
              {(staff.full_name || '?')[0]}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{staff.full_name}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{staff.role} · {staff.contract_type}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span style={{ background: dbs.bg, color: dbs.color, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>🔍 DBS: {dbs.label}</span>
                {staff.is_active === false && <span style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>Inactive</span>}
              </div>
            </div>
          </div>
          <button onClick={() => setEditing(!editing)} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {editing ? '✕ Cancel' : '✏️ Edit'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
          {[
            { label: 'Start Date', value: staff.start_date ? format(new Date(staff.start_date), 'd MMM yy') : '—' },
            { label: 'Annual Leave Used', value: `${annualLeave} days`, color: '#3B82F6' },
            { label: 'Leave Records', value: leaveLog.length },
            { label: 'Phone', value: staff.phone || '—' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: s.color || '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Full Name</label><input value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Role</label>
              <select value={editForm.role || ''} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={inp}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Email</label><input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Phone</label><input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Contract Type</label>
              <select value={editForm.contract_type || ''} onChange={e => setEditForm(f => ({ ...f, contract_type: e.target.value }))} style={inp}>{CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}</select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DBS Status</label>
              <select value={editForm.dbs_status || 'none'} onChange={e => setEditForm(f => ({ ...f, dbs_status: e.target.value }))} style={inp}>
                {Object.entries(DBS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DBS Expiry</label><input type="date" value={editForm.dbs_expiry || ''} onChange={e => setEditForm(f => ({ ...f, dbs_expiry: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Start Date</label><input type="date" value={editForm.start_date || ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>Annual Leave Allowance (days)</label><input type="number" value={editForm.leave_allowance || 28} onChange={e => setEditForm(f => ({ ...f, leave_allowance: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} disabled={saving} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            <button onClick={() => setEditing(false)} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {[['profile','📋 Profile'],['leave','🏖️ Leave Log']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{ padding: '10px 18px', border: 'none', borderBottom: `2.5px solid ${activeTab === key ? primary : 'transparent'}`, background: 'transparent', color: activeTab === key ? primary : '#6B7280', fontWeight: activeTab === key ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Contact Info</div>
            {[['Email', staff.email], ['Phone', staff.phone], ['Role', staff.role], ['Contract', staff.contract_type]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E5E7EB', fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>{k}</span><span style={{ fontWeight: 600 }}>{v || '—'}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Compliance</div>
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
            <div style={{ gridColumn: '1/-1', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: 16 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>TYPE</label>
                  <select value={newLeave.type} onChange={e => setNewLeave(n => ({ ...n, type: e.target.value }))} style={inp}>
                    {LEAVE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>FROM</label><input type="date" value={newLeave.start_date} onChange={e => setNewLeave(n => ({ ...n, start_date: e.target.value }))} style={inp} /></div>
                <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>TO</label><input type="date" value={newLeave.end_date} onChange={e => setNewLeave(n => ({ ...n, end_date: e.target.value }))} style={inp} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>NOTES</label><input value={newLeave.notes} onChange={e => setNewLeave(n => ({ ...n, notes: e.target.value }))} placeholder="Optional notes..." style={inp} /></div>
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
    </div>
  )
}

export default function HR({ org }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newStaff, setNewStaff] = useState({ full_name: '', role: 'Coach', email: '', phone: '', contract_type: 'Permanent', dbs_status: 'none', start_date: '', leave_allowance: 28 })
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('hr_staff').select('*, staff_leave(count)').eq('org_id', org.id).order('full_name')
    setStaff(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const addStaff = async () => {
    if (!newStaff.full_name) return
    setAdding(true)
    const { data } = await supabase.from('hr_staff').insert({ ...newStaff, org_id: org.id, is_active: true }).select().single()
    setAdding(false)
    if (data) { setStaff(s => [...s, { ...data, staff_leave: [{ count: 0 }] }].sort((a, b) => a.full_name.localeCompare(b.full_name))); setShowAdd(false); setNewStaff({ full_name: '', role: 'Coach', email: '', phone: '', contract_type: 'Permanent', dbs_status: 'none', start_date: '', leave_allowance: 28 }) }
  }

  let filtered = staff
  if (filter === 'active') filtered = filtered.filter(s => s.is_active !== false)
  if (filter === 'inactive') filtered = filtered.filter(s => s.is_active === false)
  if (filter === 'dbs_expiring') filtered = filtered.filter(s => s.dbs_expiry && differenceInDays(new Date(s.dbs_expiry), new Date()) < 90)
  if (search) filtered = filtered.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || (s.role || '').toLowerCase().includes(search.toLowerCase()))

  const dbsExpiring = staff.filter(s => s.dbs_expiry && differenceInDays(new Date(s.dbs_expiry), new Date()) < 90 && s.is_active !== false).length
  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  if (selected) return <StaffDetail staff={selected} org={org} onBack={() => { setSelected(null); load() }} onUpdate={u => { setStaff(s => s.map(x => x.id === u.id ? { ...x, ...u } : x)); setSelected(u) }} />

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>🧑‍💼 HR & People</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{staff.filter(s => s.is_active !== false).length} active staff {dbsExpiring > 0 && <span style={{ color: '#DC2626', fontWeight: 700 }}>· ⚠️ {dbsExpiring} DBS expiring soon</span>}</div>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Add Staff Member</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Total Staff', value: staff.length, icon: '👥' },
            { label: 'Active', value: staff.filter(s => s.is_active !== false).length, icon: '✅', color: '#16A34A' },
            { label: 'DBS Clear', value: staff.filter(s => s.dbs_status === 'clear').length, icon: '🔍', color: '#3B82F6' },
            { label: 'DBS Expiring', value: dbsExpiring, icon: '⚠️', color: dbsExpiring > 0 ? '#DC2626' : '#9CA3AF' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color || '#111' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add staff form */}
      {showAdd && (
        <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>🧑‍💼 Add Staff Member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>FULL NAME *</label><input value={newStaff.full_name} onChange={e => setNewStaff(n => ({ ...n, full_name: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>ROLE</label>
              <select value={newStaff.role} onChange={e => setNewStaff(n => ({ ...n, role: e.target.value }))} style={inp}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>EMAIL</label><input value={newStaff.email} onChange={e => setNewStaff(n => ({ ...n, email: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>PHONE</label><input value={newStaff.phone} onChange={e => setNewStaff(n => ({ ...n, phone: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>CONTRACT TYPE</label>
              <select value={newStaff.contract_type} onChange={e => setNewStaff(n => ({ ...n, contract_type: e.target.value }))} style={inp}>{CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}</select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>DBS STATUS</label>
              <select value={newStaff.dbs_status} onChange={e => setNewStaff(n => ({ ...n, dbs_status: e.target.value }))} style={inp}>
                {Object.entries(DBS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>START DATE</label><input type="date" value={newStaff.start_date} onChange={e => setNewStaff(n => ({ ...n, start_date: e.target.value }))} style={inp} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>LEAVE ALLOWANCE (days)</label><input type="number" value={newStaff.leave_allowance} onChange={e => setNewStaff(n => ({ ...n, leave_allowance: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addStaff} disabled={adding || !newStaff.full_name} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: adding || !newStaff.full_name ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{adding ? 'Adding...' : '+ Add Staff'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search staff..." style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        {[['active','Active'],['inactive','Inactive'],['dbs_expiring','DBS Expiring'],['all','All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${filter === k ? primary : '#e5e7eb'}`, background: filter === k ? primary + '12' : '#fff', color: filter === k ? primary : '#6B7280', fontSize: 12, fontWeight: filter === k ? 800 : 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {/* Staff list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading staff...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧑‍💼</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{staff.length === 0 ? 'No staff added yet' : 'No matching staff'}</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Add your team members to track roles, DBS and leave</div>
          {staff.length === 0 && <button onClick={() => setShowAdd(true)} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>+ Add First Staff Member</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(member => {
            const dbs = DBS_STATUS[member.dbs_status || 'none']
            const leaveCount = member.staff_leave?.[0]?.count || 0
            const dbsExpiring = member.dbs_expiry && differenceInDays(new Date(member.dbs_expiry), new Date()) < 90 && differenceInDays(new Date(member.dbs_expiry), new Date()) >= 0
            return (
              <div key={member.id} onClick={() => setSelected(member)} style={{ background: '#fff', border: `1px solid ${dbsExpiring ? '#FDE68A' : '#e5e7eb'}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = primary; e.currentTarget.style.boxShadow = `0 4px 12px ${primary}15` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = dbsExpiring ? '#FDE68A' : '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: primary, flexShrink: 0 }}>
                  {(member.full_name || '?')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>{member.full_name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{member.role} · {member.contract_type} · {leaveCount} leave record{leaveCount !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ background: dbs.bg, color: dbs.color, borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>🔍 {dbs.label}</span>
                  {dbsExpiring && <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>⚠️ Expiring</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
