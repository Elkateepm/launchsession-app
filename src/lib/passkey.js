// Passkey sign-in (WebAuthn).
//
// SCOPE — how this differs from src/lib/biometricLock.js.
//
// biometricLock.js is an app *lock*: the Supabase session already exists and
// the platform authenticator only lifts a screen in front of it. Nothing is
// verified server-side, so it is not a security boundary.
//
// This file is *authentication*. The assertion is verified on the server
// against a stored public key and a single-use challenge, and only then is a
// session minted. The two must not be merged: loosening this to trust a
// client-side `verified: true` would turn a real boundary back into a
// cosmetic one.
//
// Passkeys here are discoverable (resident) credentials, so signing in needs
// no email first — the authenticator returns which account it holds.

import { supabase } from './supabase'

const API = '/api/send-form-email' // shared endpoint: Hobby plan function cap
const LAST_USED_KEY = 'ls_passkey_last_used'

/* ------------------------------------------------------------ encoding */
function b64urlToBuf(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
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

/* ---------------------------------------------------------- capability */

// WebAuthn needs a secure context; localhost counts, so dev still works.
export function isPasskeyCapable() {
  if (typeof window === 'undefined') return false

  // Off inside the native shell. The bundled WebView's origin is
  // capacitor://localhost, which is not on the server's RP allowlist, and iOS
  // additionally requires an Associated Domains entitlement
  // (webcredentials:launchsession.co.uk) plus a matching AASA entry before
  // WebKit will honour a passkey request at all. Neither exists yet, so the
  // browser reports PublicKeyCredential as present and the call then fails
  // with an opaque domain error. Offering a button that cannot work is worse
  // than not offering it: the native shell has its own biometric unlock.
  if (window.Capacitor) return false

  return window.isSecureContext
    && !!window.PublicKeyCredential
    && !!navigator.credentials?.get
}

// Whether this device has a built-in authenticator worth offering. Desktop
// Chrome without Touch ID reports PublicKeyCredential but has nothing to
// verify with.
export async function hasPlatformAuthenticator() {
  if (!isPasskeyCapable()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// Conditional UI ("passkey autofill") lets the browser offer a saved passkey
// straight from the email field. Supported in Safari 16.4+ and Chrome 108+.
export async function supportsAutofill() {
  try {
    return !!window.PublicKeyCredential?.isConditionalMediationAvailable
      && await window.PublicKeyCredential.isConditionalMediationAvailable()
  } catch {
    return false
  }
}

// Whether *someone* has signed in with a passkey on this device before. Only
// used to decide whether to lead with the passkey button; it is a UI hint and
// carries no authority.
export function passkeyUsedHere() {
  try { return localStorage.getItem(LAST_USED_KEY) === '1' } catch { return false }
}

/* -------------------------------------------------------------- helpers */
function checkAborted(signal) {
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
}

async function post(body, token, signal) {
  checkAborted(signal)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 15000)
  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Something went wrong. Try again.')
    checkAborted(signal)
    return json
  } catch (err) {
    checkAborted(signal)
    if (controller.signal.aborted) throw new Error('The connection took too long. Please try again, or use your password.')
    if (err instanceof TypeError) throw new Error('Could not connect. Check your connection and try again.')
    throw err
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

// Enrolment cancellation stays quiet. Sign-in handles ambiguous browser
// failures separately so explicit attempts always offer a next step.
function friendlyError(err) {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'AbortError') return null // cancelled
  if (name === 'InvalidStateError') return 'This device already has a passkey for that account.'
  if (name === 'SecurityError') return 'Passkeys need a secure connection to this site.'
  return err?.message || 'That didn\u2019t work. Try again, or use your password.'
}

/* --------------------------------------------------------- sign in */

/**
 * Sign in with a passkey. Returns { ok: true } on success, { ok: false,
 * error } on failure, or { ok: false, cancelled: true } when the caller
 * aborts or an unused autofill suggestion is retired.
 *
 * @param {object} opts
 * @param {boolean} opts.conditional  use autofill UI rather than a modal
 * @param {AbortSignal} opts.signal    cancel before the session exchange
 * @param {function} opts.onPhase      report preparation, device and verification progress
 * @param {boolean|function} opts.rememberMe persistence choice, read at session creation
 */
export async function signInWithPasskey({ conditional = false, signal, onPhase, rememberMe } = {}) {
  if (!isPasskeyCapable()) return { ok: false, error: 'This device doesn\u2019t support passkeys.' }

  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  // Autofill can wait indefinitely, but server challenges expire in five
  // minutes. Retire the suggestion before it can offer an expired challenge.
  let expiryTimer
  let credentialSelected = false
  const startedAt = Date.now()
  try {
    checkAborted(signal)
    onPhase?.('preparing')
    const { options, challengeId } = await post({ type: 'passkey_auth_options' }, null, controller.signal)
    checkAborted(controller.signal)
    expiryTimer = setTimeout(abort, conditional ? 240000 : 65000)

    const publicKey = {
      ...options,
      challenge: b64urlToBuf(options.challenge),
      allowCredentials: (options.allowCredentials || []).map(c => ({
        ...c, id: b64urlToBuf(c.id),
      })),
    }

    onPhase?.('waiting')
    const cred = await navigator.credentials.get({
      publicKey,
      signal: controller.signal,
      ...(conditional ? { mediation: 'conditional' } : {}),
    })
    clearTimeout(expiryTimer)
    checkAborted(controller.signal)
    if (!cred) return conditional ? { ok: false, cancelled: true } : { ok: false, error: 'No passkey was selected. Try again or use your password.' }
    credentialSelected = true
    // Timers may pause in a background tab or while a phone is locked.
    if (Date.now() - startedAt >= 240000) throw new Error('That sign-in attempt expired. Please try again or use your password.')
    onPhase?.('verifying')

    const { token_hash } = await post({
      type: 'passkey_auth_verify',
      challengeId,
      credential: {
        id: cred.id,
        rawId: bufToB64url(cred.rawId),
        type: cred.type,
        response: {
          clientDataJSON: bufToB64url(cred.response.clientDataJSON),
          authenticatorData: bufToB64url(cred.response.authenticatorData),
          signature: bufToB64url(cred.response.signature),
          userHandle: cred.response.userHandle ? bufToB64url(cred.response.userHandle) : null,
        },
      },
    }, null, controller.signal)
    checkAborted(controller.signal)
    if (!token_hash) throw new Error('Could not complete passkey sign-in. Please try again.')

    // The server verified the assertion and issued a one-time token; this
    // exchanges it for a real Supabase session. The token is single-use and
    // short-lived, so it is safe to hand to the client.
    onPhase?.('session')
    const persist = typeof rememberMe === 'function' ? rememberMe() : rememberMe
    if (typeof persist === 'boolean') {
      try { localStorage.setItem('ls_remember_me', String(persist)) } catch {}
    }
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' })
    if (error || !data?.session) return { ok: false, error: 'Your passkey was verified, but sign-in could not finish. Please try again or use your password.' }

    try { localStorage.setItem(LAST_USED_KEY, '1') } catch {}
    return { ok: true }
  } catch (err) {
    if (signal?.aborted) return { ok: false, cancelled: true }
    // Browsers use NotAllowedError for cancellation, timeout AND no matching
    // credential. An explicit attempt needs a useful next step in every case.
    if (!conditional && (err?.name === 'NotAllowedError' || err?.name === 'AbortError')) {
      return { ok: false, error: 'Passkey sign-in was not completed. Try again, use a passkey from another device, or continue with your password.' }
    }
    if (conditional && !credentialSelected) return { ok: false, cancelled: true }
    const msg = friendlyError(err)
    return msg ? { ok: false, error: msg } : { ok: false, cancelled: true }
  } finally {
    clearTimeout(expiryTimer)
    signal?.removeEventListener('abort', abort)
  }
}

/* --------------------------------------------------------- enrolment */

/**
 * Create a passkey for the signed-in user. Call this from Settings, or from
 * the prompt shown after a successful password sign-in.
 */
export async function enrolPasskey({ deviceLabel } = {}) {
  if (!isPasskeyCapable()) return { ok: false, error: 'This device doesn\u2019t support passkeys.' }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in first, then add a passkey.' }

  try {
    const { options, challengeId } = await post({ type: 'passkey_register_options' }, session.access_token)

    const publicKey = {
      ...options,
      challenge: b64urlToBuf(options.challenge),
      user: { ...options.user, id: b64urlToBuf(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map(c => ({
        ...c, id: b64urlToBuf(c.id),
      })),
    }

    const cred = await navigator.credentials.create({ publicKey })
    if (!cred) return { ok: false, cancelled: true }

    await post({
      type: 'passkey_register_verify',
      challengeId,
      deviceLabel: deviceLabel || guessDeviceLabel(),
      credential: {
        id: cred.id,
        rawId: bufToB64url(cred.rawId),
        type: cred.type,
        response: {
          clientDataJSON: bufToB64url(cred.response.clientDataJSON),
          attestationObject: bufToB64url(cred.response.attestationObject),
          transports: cred.response.getTransports?.() || [],
        },
      },
    }, session.access_token)

    try { localStorage.setItem(LAST_USED_KEY, '1') } catch {}
    return { ok: true }
  } catch (err) {
    const msg = friendlyError(err)
    return msg ? { ok: false, error: msg } : { ok: false, cancelled: true }
  }
}

export async function listPasskeys() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []
  try {
    const { passkeys } = await post({ type: 'passkey_list' }, session.access_token)
    return passkeys || []
  } catch {
    return []
  }
}

export async function removePasskey(id) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in first.' }
  try {
    await post({ type: 'passkey_delete', id }, session.access_token)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Best-effort, for the credential list in Settings. Never shown as fact
// elsewhere — user agents lie and this is only a memory aid for "which
// device was this?".
function guessDeviceLabel() {
  const ua = navigator.userAgent || ''
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android device'
  if (/Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}
