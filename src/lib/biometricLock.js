// Biometric app lock (Face ID / Touch ID / Android biometrics) via WebAuthn.
//
// SCOPE — read this before extending it.
//
// This is an app lock, not authentication. The Supabase session is already
// signed in and its token already sits in storage; this puts a lock screen in
// front of the UI and uses the platform authenticator to lift it. It raises
// the bar against casual access to an unlocked, unattended phone. It is NOT a
// security boundary: anyone able to run script in this origin can read the
// token regardless of this lock.
//
// Making it a real boundary means verifying the assertion server-side and only
// then releasing a session (passkey sign-in). That is a separate piece of work
// and should not be bolted on here by loosening these functions.
//
// The biometric itself never reaches us. The browser asks the device to verify
// the user and hands back a signature; no face or fingerprint data enters the
// app, so none of it is in scope for the DPA.

import { isNativeShell, nativeHasBiometry, nativeVerify } from './nativeBiometric'

// Inside the Capacitor shell the WebAuthn path is replaced wholesale by the
// OS biometric API -- see nativeBiometric.js for why. Everything else in this
// file (enrolment record, lock state, timeout) is shared by both paths, so the
// branch is kept as narrow as possible: three functions, nothing else.
const NATIVE_CRED = 'native'

const CRED_KEY = 'ls_biometric_cred'   // { credentialId, userId, enrolledAt }
const LOCKED_KEY = 'ls_biometric_locked'
const LOCK_AFTER_KEY = 'ls_biometric_lock_after'

// Lock once the app has been in the background / unused for this long.
// Short enough to matter if a phone is put down mid-session, long enough that
// glancing at another app doesn't force a re-scan.
export const DEFAULT_LOCK_AFTER_MS = 3 * 60 * 1000

function b64urlToBuf(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf
}

function bufToB64url(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomChallenge() {
  const c = new Uint8Array(32)
  ;(window.crypto || window.msCrypto).getRandomValues(c)
  return c
}

// WebAuthn needs a secure context. localhost counts, so dev still works.
export function isBiometricCapable() {
  // The native shell has no WebAuthn requirement to satisfy. Whether biometry
  // is actually enrolled is an async question, answered by
  // hasPlatformAuthenticator() below -- this is only the synchronous gate.
  if (isNativeShell()) return true
  return typeof window !== 'undefined'
    && window.isSecureContext
    && !!window.PublicKeyCredential
    && !!navigator.credentials?.create
}

// Whether this device actually has a usable built-in authenticator. Capability
// alone isn't enough: a desktop Chrome with no Touch ID reports PublicKeyCredential
// but has nothing to verify with, and we shouldn't offer the toggle there.
export async function hasPlatformAuthenticator() {
  if (isNativeShell()) return nativeHasBiometry()
  if (!isBiometricCapable()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch (e) {
    return false
  }
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
  return !!(e && e.credentialId && userId && e.userId === userId)
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
export async function enrolBiometric({ userId, userName, displayName }) {
  if (!isBiometricCapable()) return { ok: false, reason: 'unsupported', message: 'This device or browser cannot use biometric unlock.' }
  if (!userId) return { ok: false, reason: 'no_user', message: 'You need to be signed in to set this up.' }

  if (isNativeShell()) {
    // No credential is created natively -- there is nothing to enrol with the
    // OS, we just ask it to verify. Prompting once here is still worth doing:
    // it proves biometry works on this device before the user is told the lock
    // is on, rather than discovering it fails the first time they are locked
    // out of their own app.
    const check = await nativeVerify({ reason: 'Turn on app lock for LaunchSession' })
    if (!check.ok) return check
    try {
      localStorage.setItem(CRED_KEY, JSON.stringify({
        credentialId: NATIVE_CRED,
        userId,
        enrolledAt: Date.now(),
      }))
    } catch (e) {
      return { ok: false, reason: 'error', message: 'Could not save the setting on this device.' }
    }
    setLocked(false)
    return { ok: true }
  }

  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'LaunchSession', id: window.location.hostname },
        user: {
          // Not the raw uuid string: the spec wants bytes, and this id is only
          // ever compared locally.
          id: new TextEncoder().encode(userId),
          name: userName || 'LaunchSession user',
          displayName: displayName || userName || 'LaunchSession user',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          // Built-in authenticator only -- the point is Face ID / fingerprint,
          // not a roaming security key.
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })
    if (!cred) return { ok: false, reason: 'cancelled', message: 'Setup was cancelled.' }

    localStorage.setItem(CRED_KEY, JSON.stringify({
      credentialId: bufToB64url(cred.rawId),
      userId,
      enrolledAt: Date.now(),
    }))
    setLocked(false)
    return { ok: true }
  } catch (err) {
    return { ok: false, ...describeError(err) }
  }
}

/**
 * Ask the device to verify the user in order to lift the lock.
 * Returns { ok } or { ok: false, reason, message }.
 */
export async function verifyBiometric() {
  const enrolment = getEnrolment()
  if (!enrolment?.credentialId) return { ok: false, reason: 'not_enrolled', message: 'Biometric unlock is not set up on this device.' }
  if (!isBiometricCapable()) return { ok: false, reason: 'unsupported', message: 'This device or browser cannot use biometric unlock.' }

  if (isNativeShell()) return nativeVerify({ reason: 'Unlock LaunchSession' })

  // A credential enrolled in the native shell is meaningless to WebAuthn. This
  // only happens if the same origin is opened in a browser after enrolling in
  // the app, and silently failing the assertion would look like a broken lock.
  if (enrolment.credentialId === NATIVE_CRED) {
    return { ok: false, reason: 'not_enrolled', message: 'App lock was set up in the LaunchSession app. Set it up again to use it here.' }
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        // `transports: ['internal']` matters more than it looks. Without it the
        // browser has to assume the credential might live on another device and
        // offers the passkey chooser -- "Use a phone or tablet", QR code and
        // all -- before anything happens. Declaring it as on-device sends iOS
        // straight to the Face ID scan.
        allowCredentials: [{
          type: 'public-key',
          id: b64urlToBuf(enrolment.credentialId),
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
        rpId: window.location.hostname,
      },
    })
    if (!assertion) return { ok: false, reason: 'cancelled', message: 'Unlock was cancelled.' }
    // No signature verification here by design -- see the scope note at the top.
    // The device performed the user-verification check; that is what this lock
    // relies on, and pretending otherwise would overstate the guarantee.
    return { ok: true }
  } catch (err) {
    return { ok: false, ...describeError(err) }
  }
}

function describeError(err) {
  const name = err?.name || ''
  if (name === 'NotAllowedError') return { reason: 'cancelled', message: 'Cancelled, or it timed out. Try again.' }
  if (name === 'InvalidStateError') return { reason: 'already_enrolled', message: 'This device is already set up.' }
  if (name === 'NotSupportedError') return { reason: 'unsupported', message: 'This device does not support biometric unlock.' }
  if (name === 'SecurityError') return { reason: 'insecure', message: 'Biometric unlock needs a secure (https) connection.' }
  if (name === 'AbortError') return { reason: 'cancelled', message: 'Unlock was cancelled.' }
  return { reason: 'error', message: 'Something went wrong. Please try again or use your password.' }
}
