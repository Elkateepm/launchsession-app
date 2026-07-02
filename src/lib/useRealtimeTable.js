import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

/**
 * Subscribes to live changes on a Supabase table.
 * Uses Realtime on desktop/Android for instant updates.
 * Falls back to polling on iOS, since Realtime subscriptions can crash iOS WebKit.
 *
 * @param {string} table - the Postgres table to watch
 * @param {function} onChange - called whenever a relevant change occurs (or on each poll tick)
 * @param {object} [opts]
 * @param {string} [opts.filter] - optional Postgres filter string, e.g. `org_id=eq.${orgId}`
 * @param {number} [opts.pollInterval] - polling interval in ms for the iOS fallback (default 3000)
 * @param {boolean} [opts.enabled] - set false to disable the subscription/poll entirely
 */
export function useRealtimeTable(table, onChange, opts = {}) {
  const { filter, pollInterval = 3000, enabled = true } = opts
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled || !table) return

    if (isIOS) {
      const interval = setInterval(() => onChangeRef.current(), pollInterval)
      return () => clearInterval(interval)
    }

    const channelName = `${table}-${filter || 'all'}-${Math.random().toString(36).slice(2)}`
    const channelConfig = { event: '*', schema: 'public', table }
    if (filter) channelConfig.filter = filter

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, () => onChangeRef.current())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, enabled, pollInterval])
}
