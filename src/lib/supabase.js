import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzYWhjcWVxcnhhd213dGpwd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDYyNTEsImV4cCI6MjA5MzcyMjI1MX0.HYCzuHe5C1cWoxh7yYUZuLWG0bxvy_9xTE1bmlwJweQ'

// "Keep me logged in" support: the app writes 'ls_remember_me' to localStorage
// (persistent, so it's readable even before the auth token is stored) either
// 'true' or 'false' right before signing in. This storage adapter then routes
// the actual Supabase session tokens to localStorage (survives closing the
// browser) when remembered, or sessionStorage (cleared when the tab/app is
// closed) when not. Defaults to remembering if the flag was never set, which
// preserves the previous always-persistent behaviour for existing sessions.
const rememberMe = () => {
  try { return localStorage.getItem('ls_remember_me') !== 'false' } catch (e) { return true }
}
const authStorage = {
  getItem: (key) => {
    try {
      return rememberMe() ? localStorage.getItem(key) : sessionStorage.getItem(key)
    } catch (e) { return null }
  },
  setItem: (key, value) => {
    try {
      if (rememberMe()) { localStorage.setItem(key, value) } else { sessionStorage.setItem(key, value) }
    } catch (e) {}
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key) } catch (e) {}
    try { sessionStorage.removeItem(key) } catch (e) {}
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: authStorage,
  }
})

// supabaseAdmin is ONLY available server-side via Vercel edge functions.
// The service role key must NEVER ship in the client bundle.
// For admin operations (delete_user), call /api/admin/* endpoints instead.
// This export is intentionally removed to prevent accidental client-side use.
export const supabaseAdmin = null
