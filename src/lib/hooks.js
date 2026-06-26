import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfToday } from 'date-fns'

// ─── TODAY SESSION ───────────────────────────────────────────
export function useTodaySession(orgId) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    const today = format(startOfToday(), 'yyyy-MM-dd')
    supabase
      .from('sessions')
      .select('*')
      .eq('org_id', orgId)
      .eq('session_date', today)
      .order('start_time')
      .then(({ data }) => { setSessions(data || []); setLoading(false) })
  }, [orgId])

  return { sessions, session: sessions[0] || null, loading }
}

// ─── ATTENDANCE ──────────────────────────────────────────────
export function useAttendance(sessionId) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }
    supabase
      .from('attendance')
      .select('*, child:children(*)')
      .eq('session_id', sessionId)
      .then(({ data }) => { setAttendance(data || []); setLoading(false) })
  }, [sessionId])

  const updateStatus = async (attendanceId, status, extra = {}) => {
    const now = new Date().toISOString()
    const updates = { status, ...extra }
    if (status === 'signed_in' && !extra.signed_in_at) updates.signed_in_at = now
    if (status === 'signed_out') updates.signed_out_at = now
    await supabase.from('attendance').update(updates).eq('id', attendanceId)
    setAttendance(prev => prev.map(a => a.id === attendanceId ? { ...a, ...updates } : a))
  }

  return { attendance, loading, updateStatus }
}

// ─── CHILDREN ────────────────────────────────────────────────
export function useChildren(orgId) {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = () => {
    if (!orgId) return
    setLoading(true)
    supabase
      .from('children')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('last_name')
      .then(({ data }) => { setChildren(data || []); setLoading(false) })
  }

  useEffect(() => {
    fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  return { children, setChildren, loading, refetch: fetch }
}
