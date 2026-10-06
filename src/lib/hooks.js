import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { londonDate, londonNow } from './sessionPhase'

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
// Which of today's sessions should the register open on?
//
// This used to be sessions[0] after ordering by start_time -- the earliest
// session of the day, regardless of its state. An org running a morning and an
// afternoon session would therefore keep seeing the closed morning register
// while the afternoon one was live. Two sessions sharing a start_time also made
// the choice arbitrary, since Postgres has no defined order for a tie.
//
// Preference: whatever is live now, then what's coming up, then something that
// has ended but is still open (it needs closing), then closed. Ties inside a
// band fall back to start_time.
export function pickActiveSession(sessions) {
  if (!sessions || sessions.length === 0) return null
  // Compare wall-clock values in London, independent of the device timezone.
  const now = new Date(`${londonNow()}Z`)
  const rank = (s) => {
    if (s.closed_at || s.status === 'completed') return 3
    const start = s.start_time ? new Date(`${s.session_date}T${s.start_time}Z`) : null
    let end = s.end_time ? new Date(`${s.session_date}T${s.end_time}Z`) : null
    // An end earlier than the start means the session crosses midnight.
    if (start && end && !isNaN(start) && !isNaN(end) && end < start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
    }
    const hasStarted = !start || isNaN(start) || start <= now
    const hasEnded = !!end && !isNaN(end) && end < now
    if (hasStarted && !hasEnded) return 0   // live now
    if (!hasStarted) return 1               // still to come
    return 2                                // ended but never closed
  }
  return sessions.filter(s => !s.archived_at && !s.cancelled_at && !['draft', 'cancelled'].includes(s.status)).sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    if (ra !== rb) return ra - rb
    return (a.start_time || '').localeCompare(b.start_time || '')
  })[0] || null
}

export function useTodaySession(orgId) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    let inFlight = false
    let loadedDay = null
    setSessions([])
    setFromCache(false)
    setError(null)
    if (!orgId) { setLoading(false); return }
    setLoading(true)

    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      const today = londonDate()
      const cacheKey = `session:${orgId}:${today}`
      if (loadedDay !== today) {
        loadedDay = today
        const cached = cacheRead(cacheKey)
        setSessions(cached?.data || [])
        setFromCache(!!cached)
        setLoading(true)
      }
      try {
        const { data, error: requestError } = await supabase.from('sessions').select('*')
          .eq('org_id', orgId).eq('session_date', today).order('start_time')
        if (!active) return
        if (requestError || data == null) throw requestError || new Error('No response')
        setSessions(data)
        setFromCache(false)
        setError(null)
        cacheWrite(cacheKey, data)
      } catch {
        if (active) setError("Today's plans could not be refreshed. Check your connection and try again.")
      } finally {
        inFlight = false
        if (active) setLoading(false)
      }
    }
    refresh()
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') refresh() }, 30000)
    const onVisible = () => { if (document.visibilityState !== 'hidden') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [orgId, revision])

  return { sessions, session: pickActiveSession(sessions), loading, fromCache, error, refetch: () => setRevision(value => value + 1) }
}

// ─── ATTENDANCE ──────────────────────────────────────────────
export function useAttendance(sessionId, orgId) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    let inFlight = false
    setAttendance([])
    setFromCache(false)
    setError(null)
    if (!sessionId || !orgId) { setLoading(false); return }
    setLoading(true)
    const cacheKey = `attendance:${orgId}:${sessionId}`
    const cached = cacheRead(cacheKey)
    if (cached) { setAttendance(cached.data); setFromCache(true) }

    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const { data, error: requestError } = await supabase.from('attendance')
          .select('*, child:children(*)').eq('org_id', orgId).eq('session_id', sessionId)
        if (!active) return
        if (requestError || data == null) throw requestError || new Error('No response')
        setAttendance(data)
        setFromCache(false)
        setError(null)
        cacheWrite(cacheKey, data)
      } catch {
        if (active) setError('Attendance could not be refreshed. The overview may be out of date.')
      } finally {
        inFlight = false
        if (active) setLoading(false)
      }
    }
    refresh()
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') refresh() }, 30000)
    const onVisible = () => { if (document.visibilityState !== 'hidden') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onVisible) }
  }, [sessionId, orgId, revision])

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

  return { attendance, loading, updateStatus, addAttendanceRow, fromCache, error, refetch: () => setRevision(value => value + 1) }
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
