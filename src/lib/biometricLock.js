// Native-device app lock for an existing authenticated session.
// Browser credential-based locks have been retired. Native OS biometrics
// never create or use passkeys and are only an optional local UI lock.
import { isNativeShell, nativeHasBiometry, nativeVerify } from './nativeBiometric'

const NATIVE_CRED = 'native'

const CRED_KEY = 'ls_biometric_cred'   // { credentialId, userId, enrolledAt }
const LOCKED_KEY = 'ls_biometric_locked'
const LOCK_AFTER_KEY = 'ls_biometric_lock_after'

export function isAppLockPlatform() {
  return isNativeShell()
}

// Lock once the app has been in the background / unused for this long.
// Short enough to matter if a phone is put down mid-session, long enough that
// glancing at another app doesn't force a re-scan.
export const DEFAULT_LOCK_AFTER_MS = 3 * 60 * 1000

export function isBiometricCapable() {
  return isNativeShell()
}

export async function hasPlatformAuthenticator() {
  return isNativeShell() ? nativeHasBiometry() : false
}

export function getEnrolment() {
  try {
    const raw = localStorage.getItem(CRED_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) { return null }
}

// Enrolment is per user AND per device. A shared tablet that a second person
// signs into must not silently unlock with the first person's face.
export function isEnrolledFor(userId) {
  const e = getEnrolment()
  return !!(isNativeShell() && e?.credentialId === NATIVE_CRED && userId && e.userId === userId)
}

export function clearEnrolment() {
  try {
    localStorage.removeItem(CRED_KEY)
    localStorage.removeItem(LOCKED_KEY)
  } catch (e) { /* storage unavailable */ }
}

export function getLockAfterMs() {
  try {
    const v = parseInt(localStorage.getItem(LOCK_AFTER_KEY), 10)
    return Number.isFinite(v) && v >= 0 ? v : DEFAULT_LOCK_AFTER_MS
  } catch (e) { return DEFAULT_LOCK_AFTER_MS }
}

export function setLockAfterMs(ms) {
  try { localStorage.setItem(LOCK_AFTER_KEY, String(ms)) } catch (e) { /* ignore */ }
}

export function isLocked() {
  try { return localStorage.getItem(LOCKED_KEY) === '1' } catch (e) { return false }
}

// Persisted rather than held in memory: on mobile the app process is killed
// freely, and a lock that evaporates when iOS reclaims the tab would be no
// lock at all.
export function setLocked(locked) {
  try {
    if (locked) localStorage.setItem(LOCKED_KEY, '1')
    else localStorage.removeItem(LOCKED_KEY)
  } catch (e) { /* ignore */ }
}

/**
 * Register this device's authenticator for the signed-in user.
 * Returns { ok } or { ok: false, reason, message }.
 */
export async function enrolBiometric({ userId }) {
  if (!isNativeShell()) return { ok: false, reason: 'unsupported', message: 'App lock is only available in the native app.' }
  if (!userId) return { ok: false, reason: 'no_user', message: 'Sign in first.' }
  const check = await nativeVerify({ reason: 'Turn on app lock for LaunchSession' })
  if (!check.ok) return check
  try {
    localStorage.setItem(CRED_KEY, JSON.stringify({ credentialId: NATIVE_CRED, userId, enrolledAt: Date.now() }))
  } catch (e) {
    return { ok: false, reason: 'error', message: 'Could not save the setting on this device.' }
  }
  setLocked(false)
  return { ok: true }
}

export async function verifyBiometric() {
  if (!isNativeShell()) return { ok: false, reason: 'unsupported', message: 'App lock is only available in the native app.' }
  if (getEnrolment()?.credentialId !== NATIVE_CRED) return { ok: false, reason: 'not_enrolled', message: 'App lock is not set up on this device.' }
  return nativeVerify({ reason: 'Unlock LaunchSession' })
}
