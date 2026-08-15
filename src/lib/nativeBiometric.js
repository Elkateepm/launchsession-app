// Native (Capacitor) implementation of the app lock's biometric check.
//
// WHY THIS EXISTS
// WebAuthn is the right mechanism in a browser, but inside the native shell it
// is the wrong one twice over. It presents a passkey chooser rather than going
// straight to Face ID, and a WKWebView only gets passkey support at all with an
// Associated Domains entitlement and a served apple-app-site-association file.
// Natively there is a direct API for exactly this, so use it.
//
// The public shape here deliberately mirrors biometricLock.js -- same return
// contract of { ok } or { ok: false, reason, message } -- so the caller in
// biometricLock.js can pick a path without the UI knowing which one ran.
//
// LOADING
// The plugin is imported dynamically and only on the native path. A static
// import would pull it into the web bundle for the majority of users who will
// never run the native shell.

// The native runtime injects window.Capacitor. Detecting via the global rather
// than importing @capacitor/core keeps the web bundle completely unchanged --
// no new dependency is evaluated in a browser.
export function isNativeShell() {
  if (typeof window === 'undefined') return false
  try {
    return window.Capacitor?.isNativePlatform?.() === true
  } catch (e) {
    return false
  }
}

let pluginPromise = null
function loadPlugin() {
  if (!pluginPromise) {
    pluginPromise = import('@aparajita/capacitor-biometric-auth')
      .catch(() => null) // shell built without the plugin: fall through to unsupported
  }
  return pluginPromise
}

/**
 * Whether this device has enrolled biometry we can actually use.
 * Hardware support alone isn't enough -- a phone with Face ID hardware but no
 * enrolled face must not be offered the toggle.
 */
export async function nativeHasBiometry() {
  const mod = await loadPlugin()
  if (!mod) return false
  try {
    const result = await mod.BiometricAuth.checkBiometry()
    return !!result?.isAvailable
  } catch (e) {
    return false
  }
}

/**
 * Human label for the device's biometry, for use in copy ("Unlock with Face ID").
 * Returns null when there is nothing enrolled.
 */
export async function nativeBiometryLabel() {
  const mod = await loadPlugin()
  if (!mod) return null
  try {
    const { isAvailable, biometryType } = await mod.BiometricAuth.checkBiometry()
    if (!isAvailable) return null
    const { BiometryType } = mod
    switch (biometryType) {
      case BiometryType.faceId: return 'Face ID'
      case BiometryType.touchId: return 'Touch ID'
      case BiometryType.faceAuthentication: return 'face unlock'
      case BiometryType.fingerprintAuthentication: return 'fingerprint'
      case BiometryType.irisAuthentication: return 'iris unlock'
      default: return 'biometrics'
    }
  } catch (e) {
    return null
  }
}

/**
 * Present the OS biometric prompt.
 *
 * There is no enrolment step natively: unlike WebAuthn there is no credential
 * to create, we are simply asking the OS to verify whoever is holding the
 * phone. Enrolment on this path therefore means "the user turned the lock on",
 * which biometricLock.js records, and this function is the whole of the check.
 */
export async function nativeVerify({ reason } = {}) {
  const mod = await loadPlugin()
  if (!mod) return { ok: false, reason: 'unsupported', message: 'Biometric unlock is not available in this build.' }

  try {
    await mod.BiometricAuth.authenticate({
      reason: reason || 'Unlock LaunchSession',
      cancelTitle: 'Cancel',
      androidTitle: 'Unlock LaunchSession',
      androidSubtitle: 'Confirm it\u2019s you to continue',
      // Passcode fallback is deliberately allowed. Without it, a user whose
      // face fails to scan -- wet hands, a mask, a cracked sensor -- is locked
      // out of an app they are already signed in to, with no route back except
      // signing out. The lock is a speed bump, not a security boundary, so
      // trading a little strictness for not stranding people is correct.
      allowDeviceCredential: true,
      androidConfirmationRequired: false,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, ...describeNativeError(err) }
  }
}

// Codes come from the plugin's BiometryErrorType. Mapped to the same `reason`
// vocabulary the WebAuthn path uses so the lock screen needs no native-specific
// branches.
function describeNativeError(err) {
  const code = err?.code || ''
  switch (code) {
    case 'userCancel':
    case 'appCancel':
    case 'systemCancel':
    case 'userFallback':
      return { reason: 'cancelled', message: 'Unlock was cancelled.' }
    case 'authenticationFailed':
      return { reason: 'failed', message: 'Not recognised. Try again, or use your password.' }
    case 'biometryLockout':
      // Too many failed attempts; the OS has disabled biometry until the device
      // passcode is entered. Telling the user to keep trying would be wrong.
      return { reason: 'lockout', message: 'Too many attempts. Unlock your device with its passcode, then try again.' }
    case 'biometryNotEnrolled':
      return { reason: 'not_enrolled_device', message: 'No face or fingerprint is set up on this device.' }
    case 'biometryNotAvailable':
      return { reason: 'unsupported', message: 'This device cannot use biometric unlock.' }
    case 'passcodeNotSet':
    case 'noDeviceCredential':
      return { reason: 'no_passcode', message: 'Set a passcode on this device to use app lock.' }
    default:
      return { reason: 'error', message: 'Something went wrong. Please try again or use your password.' }
  }
}
