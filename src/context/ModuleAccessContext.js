import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// The signed-in user's effective level for every module.
//
// Read from the my_module_access() RPC, which calls the same module_access()
// function the RLS policies call. Resolving grant-over-template-over-fallback
// in JavaScript instead would be a second implementation of the precedence
// rules, and the moment the two disagree the UI starts offering buttons that
// fail when pressed.
//
// Failure is deliberately open, not closed: if the RPC errors (offline, cold
// start, a deploy mid-request) we fall back to an empty map, which
// makeModuleLevel reads as 'edit'. The database is still enforcing the real
// answer, so the cost of guessing wrong here is a menu item that leads to an
// empty screen. Guessing the other way would black out the whole nav for
// everyone the first time a request times out.
const ModuleAccessContext = createContext({ levels: null, loading: true, refresh: () => {} })

export function ModuleAccessProvider({ userId, children }) {
  const [levels, setLevels] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLevels(null); setLoading(false); return }
    const { data, error } = await supabase.rpc('my_module_access')
    if (error) {
      console.warn('module access fetch failed:', error.message)
      setLevels(null)
    } else {
      setLevels(data || {})
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  // Re-read on sign-in and on recovery, for the same reason the signed URL
  // cache is cleared there: a shared tablet can change hands without a reload,
  // and the incoming user must not inherit the previous one's menu.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED') load()
    })
    return () => subscription.unsubscribe()
  }, [load])

  return (
    <ModuleAccessContext.Provider value={{ levels, loading, refresh: load }}>
      {children}
    </ModuleAccessContext.Provider>
  )
}

export const useModuleAccess = () => useContext(ModuleAccessContext)
