import { supabase } from './supabase'
import { SUSPENDED_MESSAGE, isSuspendedSignInError, fetchAccessBlock, rememberSuspension, hasSuspensionNotice, clearSuspensionNotice } from './accessBlock'

jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn() } }))
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear() })

test.each([
  [{ code: 'user_banned', message: 'User is banned' }, true],
  [{ message: 'User is banned' }, true],
  [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, false],
  [null, false],
])('recognises a banned sign-in: %j', (error, expected) => {
  expect(isSuspendedSignInError(error)).toBe(expected)
})

test('asks the database and returns the block', async () => {
  supabase.rpc.mockResolvedValue({ data: { reason: 'org_suspended', organisation: 'Riverside' }, error: null })
  expect(await fetchAccessBlock()).toEqual({ reason: 'org_suspended', organisation: 'Riverside' })
  expect(supabase.rpc).toHaveBeenCalledWith('my_access_block')
})

test.each([
  ['not blocked', () => supabase.rpc.mockResolvedValue({ data: null, error: null })],
  ['an error', () => supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })],
  ['a network failure', () => supabase.rpc.mockRejectedValue(new Error('offline'))],
])('fails open on %s', async (_label, arrange) => {
  arrange()
  expect(await fetchAccessBlock()).toBeNull()
})

test('the notice survives a redirect until it is cleared', () => {
  expect(hasSuspensionNotice()).toBe(false)
  rememberSuspension()
  expect(hasSuspensionNotice()).toBe(true)
  clearSuspensionNotice()
  expect(hasSuspensionNotice()).toBe(false)
})

test('the message tells people who to contact', () => {
  expect(SUSPENDED_MESSAGE).toMatch(/administrator/)
  expect(SUSPENDED_MESSAGE).toMatch(/support@launchsession\.co\.uk/)
})
