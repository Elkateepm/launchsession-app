import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzYWhjcWVxcnhhd213dGpwd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDYyNTEsImV4cCI6MjA5MzcyMjI1MX0.HYCzuHe5C1cWoxh7yYUZuLWG0bxvy_9xTE1bmlwJweQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})

// supabaseAdmin is ONLY available server-side via Vercel edge functions.
// The service role key must NEVER ship in the client bundle.
// For admin operations (delete_user), call /api/admin/* endpoints instead.
// This export is intentionally removed to prevent accidental client-side use.
export const supabaseAdmin = null
