import { signInWithPasskey } from './passkey'
import { supabase } from './supabase'

jest.mock('./supabase', () => ({ supabase: { auth: { verifyOtp: jest.fn() } } }))

const options = { options: { challenge: 'AQID', rpId: 'localhost', timeout: 60000 }, challengeId: 'challenge' }
const credential = {
  id: 'credential', rawId: new Uint8Array([1, 2, 3]).buffer, type: 'public-key',
  response: { clientDataJSON: new ArrayBuffer(1), authenticatorData: new ArrayBuffer(1), signature: new ArrayBuffer(1), userHandle: null },
}
const response = json => ({ ok: true, json: async () => json })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  window.PublicKeyCredential = function () {}
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get: jest.fn().mockResolvedValue(credential) } })
  global.fetch = jest.fn().mockResolvedValueOnce(response(options)).mockResolvedValueOnce(response({ token_hash: 'verified-token' }))
  supabase.auth.verifyOtp.mockReset().mockResolvedValue({ data: { session: { user: { id: 'user' } } }, error: null })
})
afterEach(() => { jest.useRealTimers(); delete global.fetch })

test('creates a session only after verification and applies the latest persistence choice', async () => {
  const phases = []
  const result = await signInWithPasskey({ onPhase: phase => phases.push(phase), rememberMe: () => false })
  expect(result).toEqual({ ok: true })
  expect(phases).toEqual(['preparing', 'waiting', 'verifying', 'session'])
  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'verified-token', type: 'email' })
  expect(localStorage.getItem('ls_remember_me')).toBe('false')
})

test('aborting a slow options response cannot open an obsolete device prompt', async () => {
  let resolve
  fetch.mockReset().mockReturnValue(new Promise(done => { resolve = done }))
  const controller = new AbortController()
  const pending = signInWithPasskey({ signal: controller.signal })
  controller.abort()
  resolve(response(options))
  expect(await pending).toEqual({ ok: false, cancelled: true })
  expect(navigator.credentials.get).not.toHaveBeenCalled()
  expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
})

test('aborting verification cannot create a late session', async () => {
  let resolve
  fetch.mockReset().mockResolvedValueOnce(response(options)).mockReturnValueOnce(new Promise(done => { resolve = done }))
  const controller = new AbortController()
  const pending = signInWithPasskey({ signal: controller.signal })
  await flush()
  controller.abort()
  resolve(response({ token_hash: 'late-token' }))
  expect(await pending).toEqual({ ok: false, cancelled: true })
  expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
})

test('explicit browser timeout gives a retry and password fallback', async () => {
  navigator.credentials.get.mockRejectedValue(new DOMException('Timed out', 'NotAllowedError'))
  expect(await signInWithPasskey()).toEqual({ ok: false, error: expect.stringContaining('password') })
})

test('background autofill errors stay silent before a credential is selected', async () => {
  fetch.mockReset().mockRejectedValue(new TypeError('Network failed'))
  expect(await signInWithPasskey({ conditional: true })).toEqual({ ok: false, cancelled: true })
})

test('retires idle autofill before the server challenge expires', async () => {
  navigator.credentials.get.mockImplementation(({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
  }))
  const pending = signInWithPasskey({ conditional: true })
  await flush()
  jest.advanceTimersByTime(240000)
  expect(await pending).toEqual({ ok: false, cancelled: true })
  expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
})

test('network timeout recovers instead of waiting forever', async () => {
  fetch.mockReset().mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  }))
  const pending = signInWithPasskey()
  jest.advanceTimersByTime(15000)
  expect(await pending).toEqual({ ok: false, error: expect.stringContaining('connection took too long') })
})

test('never reports success without a Supabase session', async () => {
  supabase.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: null })
  expect(await signInWithPasskey()).toEqual({ ok: false, error: expect.stringContaining('could not finish') })
  expect(localStorage.getItem('ls_passkey_last_used')).toBeNull()
})

test('does not exchange an invalid server response', async () => {
  fetch.mockReset().mockResolvedValueOnce(response(options)).mockResolvedValueOnce(response({}))
  expect((await signInWithPasskey()).ok).toBe(false)
  expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
})


test('rejects a stale autofill result even when background timers were suspended', async () => {
  let resolve
  navigator.credentials.get.mockReturnValue(new Promise(done => { resolve = done }))
  const pending = signInWithPasskey({ conditional: true })
  await flush()
  jest.setSystemTime(Date.now() + 300000)
  resolve(credential)
  expect(await pending).toEqual({ ok: false, error: expect.stringContaining('expired') })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
})
