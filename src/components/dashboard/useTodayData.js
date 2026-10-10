import { useEffect, useRef, useState } from 'react'
import { loadTodayData } from './todayData'
import { todayInLondon } from '../../lib/today'

export default function useTodayData(orgId, access) {
  const key = JSON.stringify([orgId, !!access.schedule, !!access.registers, !!access.planner, !!access.hr])
  const [snapshot, setSnapshot] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const refreshRef = useRef(() => {})

  useEffect(() => {
    const [id, schedule, registers, planner, hr] = JSON.parse(key)
    if (!id) return undefined
    let active = true
    let inFlight = false
    const load = async () => {
      if (inFlight) return
      inFlight = true
      setBusyKey(key)
      try {
        const data = await loadTodayData(id, { schedule, registers, planner, hr })
        if (active) setSnapshot({ key, data, checkedAt: new Date() })
      } catch {
        if (active) setSnapshot({ key, data: { day: todayInLondon(), sessions: null, attendance: null, staff: null, hr: null, errors: ['overview'] }, checkedAt: new Date() })
      } finally {
        inFlight = false
        if (active) setBusyKey(null)
      }
    }
    refreshRef.current = load
    load()
    const visible = () => { if (document.visibilityState === 'visible') load() }
    const timer = setInterval(visible, 60000)
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); refreshRef.current = () => {} }
  }, [key])

  // A late response from another organisation or yesterday is not today's
  // picture. Keep data unknown until the matching refresh completes.
  const current = snapshot?.key === key && snapshot.data.day === todayInLondon() ? snapshot : null
  return { data: current?.data, checkedAt: current?.checkedAt, loading: !current, refreshing: busyKey === key, refresh: () => refreshRef.current() }
}
