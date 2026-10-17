import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'
import { createPasswordResetHandler } from './handler.mjs'

Deno.serve(createPasswordResetHandler({ createClient, env: key => Deno.env.get(key) }))
