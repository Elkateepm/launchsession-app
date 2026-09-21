import handler from '../../api/send-form-email'
import { createClient } from '@supabase/supabase-js'
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('web-push', () => ({}))
test.each(['passkey_auth_options', 'passkey_auth_verify', 'passkey_register_options', 'passkey_register_verify', 'passkey_list', 'passkey_delete'])('retired %s returns 410 without accessing authentication or data', async type => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
  await handler({ method: 'POST', body: { type }, headers: {} }, res)
  expect(res.status).toHaveBeenCalledWith(410)
  expect(createClient).not.toHaveBeenCalled()
})
