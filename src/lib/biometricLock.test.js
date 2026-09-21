import { isAppLockPlatform, hasPlatformAuthenticator, isEnrolledFor, enrolBiometric, verifyBiometric } from './biometricLock'
import { isNativeShell, nativeVerify } from './nativeBiometric'
jest.mock('./nativeBiometric', () => ({ isNativeShell: jest.fn(), nativeHasBiometry: jest.fn(), nativeVerify: jest.fn() }))
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); isNativeShell.mockReturnValue(false) })
test('old browser enrolment cannot trigger a credential lock', async () => {
  localStorage.setItem('ls_biometric_cred', JSON.stringify({ credentialId: 'old-browser-key', userId: 'staff' }))
  expect(isAppLockPlatform()).toBe(false)
  expect(isEnrolledFor('staff')).toBe(false)
  expect(await hasPlatformAuthenticator()).toBe(false)
  expect((await enrolBiometric({ userId: 'staff' })).reason).toBe('unsupported')
  expect((await verifyBiometric()).reason).toBe('unsupported')
  expect(nativeVerify).not.toHaveBeenCalled()
})
test('native OS biometrics still support the existing app lock', async () => {
  isNativeShell.mockReturnValue(true)
  nativeVerify.mockResolvedValue({ ok: true })
  expect(await enrolBiometric({ userId: 'staff' })).toEqual({ ok: true })
  expect(isEnrolledFor('staff')).toBe(true)
  expect(isEnrolledFor('other')).toBe(false)
  expect(await verifyBiometric()).toEqual({ ok: true })
})
