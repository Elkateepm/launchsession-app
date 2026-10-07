import { useEffect, useState } from 'react'
import { msUntilTrialChange } from '../lib/moduleAccess'

// The current time, re-read whenever the trial countdown would show something
// different: at each whole-day step, at the moment the trial ends, and when the
// app comes back to the foreground, because a sleeping laptop or a backgrounded
// phone can miss a timer altogether.
export function useTrialClock(org) {
  const [now, setNow] = useState(() => new Date())
  const plan = org?.plan
  const expires = org?.trial_expires_at

  useEffect(() => {
    const wait = msUntilTrialChange({ plan, trial_expires_at: expires }, now)
    if (wait === null) return undefined
    // A second past the step, so the recount lands on the far side of it.
    const timer = setTimeout(() => setNow(new Date()), Math.min(wait + 1000, 2147483647))
    return () => clearTimeout(timer)
  }, [now, plan, expires])

  useEffect(() => {
    const refresh = () => { if (!document.hidden) setNow(new Date()) }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return now
}
