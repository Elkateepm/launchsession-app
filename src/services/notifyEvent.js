// Fire-and-forget trigger for server-generated notifications. The frontend
// only ever sends an event type + minimal targeting info — the server looks
// up recipients, checks their preferences, and writes the actual notification
// title/body. This is deliberate: a compromised or buggy client can never
// dictate arbitrary notification text to arbitrary users.
import { supabase } from '../lib/supabase'

export async function notifyEvent(eventType, params = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    // Never block the calling UI flow on notification delivery. Sent to the
    // send-push Edge Function, which checks the signed-in user's token.
    supabase.functions.invoke('send-push', { body: { type: 'push', event_type: eventType, ...params } }).catch(() => {})
  } catch (e) {
    // Notifications are always best-effort — never surface this to the user.
  }
}
