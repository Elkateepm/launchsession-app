import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfToday } from 'date-fns'

// ─── OFFLINE CACHE HELPERS ───────────────────────────────────
// Simple localStorage read/write with a timestamp, used to let the Registers
// page keep working (read-only) when the network is unavailable.
const CACHE_PREFIX = 'ls_cache:'

function cacheRead(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed
  } catch {
    return null
  }
}

function cacheWrite(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, cachedAt: Date.now() }))
  } catch {
    // Storage full/unavailable — offline cache is best-effort, fail silently.
  }
}

// ─── ONLINE STATUS ────────────────────────────────────────────
// Tracks browser connectivity so the UI can show an offline indicator and
// fall back to cached data. navigator.onLine is a reasonable proxy — it
// won't catch every "technically connected but Supabase unreachable" case,
// but combined with failed-fetch fallback below it covers real offline use.
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}

// ─── TODAY SESSION ───────────────────────────────────────────
export function useTodaySession(orgId) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!orgId) return
    const today = format(startOfToday(), 'yyyy-MM-dd')
    const cacheKey = `session:${orgId}:${today}`

    // Show cached data immediately so the register isn't blank while the
    // network request is in flight or if it never completes.
    const cached = cacheRead(cacheKey)
    if (cached) { setSessions(cached.data); setFromCache(true) }

    supabase
      .from('sessions')
      .select('*')
      .eq('org_id', orgId)
      .eq('session_date', today)
      .order('start_time')
      .then(({ data, error }) => {
        if (error || data == null) {
          // Network/request failed — keep showing cached data if we have it.
          if (!cached) setSessions([])
          setLoading(false)
          return
        }
        setSessions(data)
        setFromCache(false)
        setLoading(false)
        cacheWrite(cacheKey, data)
      })
      .catch(() => { setLoading(false) })
  }, [orgId])

  return { sessions, session: sessions[0] || null, loading, fromCache }
}

// ─── ATTENDANCE ──────────────────────────────────────────────
export function useAttendance(sessionId) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }
    const cacheKey = `attendance:${sessionId}`

    const cached = cacheRead(cacheKey)
    if (cached) { setAttendance(cached.data); setFromCache(true) }

    supabase
      .from('attendance')
      .select('*, child:children(*)')
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (error || data == null) {
          if (!cached) setAttendance([])
          setLoading(false)
          return
        }
        setAttendance(data)
        setFromCache(false)
        setLoading(false)
        cacheWrite(cacheKey, data)
      })
      .catch(() => { setLoading(false) })
  }, [sessionId])

  const updateStatus = async (attendanceId, status, extra = {}) => {
    const now = new Date().toISOString()
    const updates = { status, ...extra }
    if (status === 'signed_in' && !extra.signed_in_at) updates.signed_in_at = now
    if (status === 'signed_out') updates.signed_out_at = now
    await supabase.from('attendance').update(updates).eq('id', attendanceId)
    setAttendance(prev => prev.map(a => a.id === attendanceId ? { ...a, ...updates } : a))
  }

  const addAttendanceRow = (row) => {
    setAttendance(prev => [...prev, row])
  }

  return { attendance, loading, updateStatus, addAttendanceRow, fromCache }
}

// ─── CHILDREN ────────────────────────────────────────────────
export function useChildren(orgId) {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  const fetch = () => {
    if (!orgId) return
    const cacheKey = `children:${orgId}`
    setLoading(true)

    const cached = cacheRead(cacheKey)
    if (cached) {
      setChildren(cached.data)
      setFromCache(true)
    }

    supabase
      .from('children')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('last_name')
      .then(({ data, error }) => {
        if (error || data == null) {
          // Offline or request failed — keep whatever cached data is showing.
          setLoading(false)
          return
        }
        setChildren(data)
        setFromCache(false)
        setLoading(false)
        cacheWrite(cacheKey, data)
      })
      .catch(() => { setLoading(false) })
  }

  useEffect(() => {
    fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  return { children, setChildren, loading, refetch: fetch, fromCache }
}
