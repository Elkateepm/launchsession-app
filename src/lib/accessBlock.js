import { supabase } from './supabase'

// Command Centre can suspend a person or a whole organisation. The database
// does the blocking (supabase/migrations/20261118_suspend_blocks_access.sql):
// it bans the login, ends its sessions and stops answering the org-scope RLS
// helpers. This file only lets the app say so plainly instead of showing a
// generic sign-in failure or an empty workspace.

export const SUSPENDED_MESSAGE = "Your access to LaunchSession has been suspended. Please contact your organisation's administrator or support@launchsession.co.uk."

const NOTICE_KEY = 'ls_access_suspended'

// Supabase Auth refuses a banned login with error code user_banned.
export function isSuspendedSignInError(error) {
  if (!error) return false
  return error.code === 'user_banned' || /\bbanned\b/i.test(error.message || '')
}

// { reason: 'user_suspended' | 'org_suspended', organisation } or null.
// Fails open: a network error here must not lock anyone out, and the
// database enforces the block whatever this returns.
export async function fetchAccessBlock() {
  try {
    const { data, error } = await supabase.rpc('my_access_block')
    if (error || !data) return null
    return data
  } catch (e) {
    return null
  }
}

// Carries the reason across the sign-out redirect to the sign-in page.
export function rememberSuspension() {
  try { sessionStorage.setItem(NOTICE_KEY, '1') } catch (e) { /* storage unavailable */ }
}

export function hasSuspensionNotice() {
  try { return sessionStorage.getItem(NOTICE_KEY) === '1' } catch (e) { return false }
}

export function clearSuspensionNotice() {
  try { sessionStorage.removeItem(NOTICE_KEY) } catch (e) { /* storage unavailable */ }
}
