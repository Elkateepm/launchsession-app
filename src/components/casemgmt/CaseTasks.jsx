import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { inputStyle, btnPrimary, btnGhost, Avatar } from '../volunteers/vh_shared'

const PRIORITY_COLOR = { low: '#64748B', medium: '#F59E0B', high: '#EF4444' }

export default function CaseTasks({ caseId, org, session: authSession, staff = [] }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', owner_id: '', due_date: '', priority: 'medium' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('case_tasks').select('*').eq('case_id', caseId).order('completed').order('due_date', { ascending: true, nullsFirst: false })
    setTasks(data || [])
    setLoading(false)
  }, [caseId])

  useEffect(() => { load() }, [load])

  const addTask = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      case_id: caseId, org_id: org.id, title: form.title.trim(),
      owner_id: form.owner_id || null, due_date: form.due_date || null, priority: form.priority,
      created_by: authSession?.user?.id,
    }
    const { data } = await supabase.from('case_tasks').insert(payload).select().single()
    if (data) setTasks(t => [data, ...t])
    setForm({ title: '', owner_id: '', due_date: '', priority: 'medium' })
    setShowForm(false)
    setSaving(false)
  }

  const toggleComplete = async (task) => {
    const completed = !task.completed
    setTasks(t => t.map(x => x.id === task.id ? { ...x, completed, completed_at: completed ? new Date().toISOString() : null } : x))
    await supabase.from('case_tasks').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', task.id)
    if (completed) {
      await supabase.from('case_events').insert({ case_id: caseId, org_id: org.id, event_type: 'task_completed', body: task.title, created_by: authSession?.user?.id })
    }
  }

  const deleteTask = async (id) => {
    setTasks(t => t.filter(x => x.id !== id))
    await supabase.from('case_tasks').delete().eq('id', id)
  }

  const done = tasks.filter(t => t.completed).length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const overdue = (t) => t.due_date && !t.completed && new Date(t.due_date) < new Date(new Date().toDateString())

  if (loading) return <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>Loading tasks…</div>

  return (
    <div>
      {tasks.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 700 }}>
            <span>{done} of {tasks.length} complete</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} style={{ height: '100%', background: `linear-gradient(90deg, ${primary}, #6366F1)`, borderRadius: 99 }} />
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {tasks.map(task => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${overdue(task) ? '#FCA5A5' : 'rgba(15,23,42,0.07)'}`, background: overdue(task) ? '#FEF2F2' : '#fff', marginBottom: 8 }}
          >
            <input type="checkbox" checked={task.completed} onChange={() => toggleComplete(task)} style={{ width: 17, height: 17, accentColor: primary, cursor: 'pointer', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: task.completed ? '#94A3B8' : '#0F172A', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {task.due_date && <span style={{ fontSize: 11, color: overdue(task) ? '#DC2626' : '#94A3B8', fontWeight: 700 }}>{overdue(task) ? '⚠ Overdue: ' : '📅 '}{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                <span style={{ fontSize: 10.5, fontWeight: 800, color: PRIORITY_COLOR[task.priority] || '#64748B', textTransform: 'uppercase' }}>{task.priority}</span>
                {task.owner_id && (() => { const o = staff.find(s => s.id === task.owner_id); return o ? <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><Avatar name={o.full_name} size={16} />{o.full_name}</span> : null })()}
              </div>
            </div>
            <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>✕</button>
          </motion.div>
        ))}
      </AnimatePresence>

      {tasks.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: '#94A3B8', fontSize: 13 }}>No tasks yet for this case.</div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: 12, borderRadius: 12, border: '1.5px solid rgba(15,23,42,0.08)', background: '#F8FAFC', marginBottom: 10 }}>
              <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Task title, e.g. Contact parent" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <select style={inputStyle} value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}>
                  <option value="">Assign to…</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <input type="date" style={inputStyle} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', gap: 8 }}>
        {showForm ? (
          <>
            <button onClick={addTask} disabled={saving || !form.title.trim()} style={btnPrimary(primary)}>{saving ? 'Adding…' : '+ Add Task'}</button>
            <button onClick={() => setShowForm(false)} style={btnGhost}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setShowForm(true)} style={btnGhost}>+ Add Task</button>
        )}
      </div>
    </div>
  )
}
