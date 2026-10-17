import { readRecoveryLink, recoverySignInUrl, requestPasswordReset } from './passwordReset'
import { supabase } from './supabase'

jest.mock('./supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }))
const base = 'https://app.launchsession.co.uk/reset-password?org=community-youth'
beforeEach(() => jest.clearAllMocks())

test.each(['', '#type=signup&access_token=a&refresh_token=b', '#type=recovery&access_token=a', '#type=recovery&access_token=a&refresh_token=b&error=access_denied'])('rejects missing, non-recovery and errored links: %s', hash => {
  expect(readRecoveryLink(base + hash).kind).toBe('invalid')
})
test('supports new token hashes and existing implicit links', () => {
  expect(readRecoveryLink(base + '#type=recovery&token_hash=one-use')).toMatchObject({ org: 'community-youth', kind: 'token', token_hash: 'one-use' })
  expect(readRecoveryLink(base + '#type=recovery&access_token=a&refresh_token=b')).toMatchObject({ kind: 'session', access_token: 'a', refresh_token: 'b' })
})
test('only permits internal sign-in destinations with explicit organisation context', () => {
  expect(recoverySignInUrl({ org: 'community-youth' })).toBe('/login?org=community-youth')
  expect(recoverySignInUrl({ org: 'community-youth', portal: 'volunteer' })).toBe('/volunteer/community-youth')
  expect(recoverySignInUrl({})).toBe('/org-search')
})
test.each([{ error: 'delivery failed' }, { success: false }, { success: true, data: { statusCode: 403, message: 'Forbidden' } }])('rejects legacy HTTP-200 failures: %p', async data => {
  supabase.functions.invoke.mockResolvedValue({ data, error: null })
  await expect(requestPasswordReset('staff@example.com', { slug: 'community-youth' })).rejects.toThrow('could not send')
})
test('volunteer requests preserve the portal and correctly encode the organisation', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: { success: true } })
  await requestPasswordReset(' staff@example.com ', { slug: 'community-youth' }, 'volunteer')
  expect(supabase.functions.invoke).toHaveBeenCalledWith('send-password-reset-email', expect.objectContaining({ body: expect.objectContaining({ email: 'staff@example.com', redirect_to: window.location.origin + '/reset-password?org=community-youth&portal=volunteer' }) }))
})
