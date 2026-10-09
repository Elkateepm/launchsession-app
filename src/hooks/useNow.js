import { useEffect, useState } from 'react'

// The current time, refreshed while `active` so a running hours counter
// ticks. Off when nothing is counting, so an idle screen does no work.
export function useNow(active = true, everyMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return undefined
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(timer)
  }, [active, everyMs])
  return now
}

export default useNow
