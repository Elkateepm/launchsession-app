import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzYWhjcWVxcnhhd213dGpwd3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDYyNTEsImV4cCI6MjA5MzcyMjI1MX0.HYCzuHe5C1cWoxh7yYUZuLWG0bxvy_9xTE1bmlwJweQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
