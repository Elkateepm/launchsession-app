import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPasswordResetHandler } from './handler.mjs'

const setup = ({ linkError, status = 200, token = 'single-use-token', configured = true, thrown = false } = {}) => {
  const sent = []
  const generated = []
  const handler = createPasswordResetHandler({
    env: () => configured ? 'server-only-test-value' : undefined,
    createClient: () => ({ auth: { admin: { generateLink: async options => {
      generated.push(options)
      return { data: { properties: { hashed_token: token } }, error: linkError }
    } } } }),
    fetch: async (_url, options) => {
      sent.push(JSON.parse(options.body))
      if (thrown) throw new Error('Provider unavailable')
      return new Response('{}', { status })
    },
  })
  const request = body => handler(new Request('https://function.test', { method: 'POST', body: JSON.stringify({ email: 'staff@example.com', org_slug: 'community-youth', ...body }) }))
  return { handler, request, sent, generated }
}

test('sends a safe application recovery link with organisation and portal context', async () => {
  const { request, sent } = setup()
  const response = await request({ redirect_to: 'https://attacker.example/reset-password?portal=volunteer', org_name: '<b>Community</b>', org_logo: 'https://assets.example/logo.png" onerror="alert(1)' })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true })
  assert.equal(sent.length, 1)
  const url = sent[0].text.match(/https:\/\/app\.launchsession\.co\.uk\/reset-password[^\s]+/)[0]
  const destination = new URL(url)
  assert.equal(destination.searchParams.get('org'), 'community-youth')
  assert.equal(destination.searchParams.get('portal'), 'volunteer')
  assert.equal(new URLSearchParams(destination.hash.slice(1)).get('type'), 'recovery')
  assert.equal(new URLSearchParams(destination.hash.slice(1)).get('token_hash'), 'single-use-token')
  assert.ok(!sent[0].html.includes('<b>Community</b>'))
  assert.ok(!sent[0].html.includes('" onerror="'))
  assert.ok(!sent[0].text.includes('attacker.example'))
})
test('unknown accounts have the same public success response without sending mail', async () => {
  const { request, sent } = setup({ linkError: { code: 'user_not_found' } })
  const response = await request()
  assert.deepEqual(await response.json(), { success: true })
  assert.equal(sent.length, 0)
})
test('Auth generation failures are surfaced and cannot claim delivery', async () => {
  const { request, sent } = setup({ linkError: { code: 'unexpected_failure' } })
  assert.equal((await request()).status, 502)
  assert.equal(sent.length, 0)
})
for (const status of [401, 403, 429, 500]) test(`mail provider HTTP ${status} is a failed reset request`, async () => {
  const { request } = setup({ status })
  const response = await request()
  assert.equal(response.status, 502)
  assert.ok((await response.json()).error)
})
test('network failures and missing configuration return retryable errors', async () => {
  assert.equal((await setup({ thrown: true }).request()).status, 503)
  const { request, generated } = setup({ configured: false })
  assert.equal((await request()).status, 503)
  assert.equal(generated.length, 0)
})
test('invalid inputs and methods cannot generate recovery tokens', async () => {
  const { handler, request, generated } = setup()
  assert.equal((await request({ email: 'not-an-email' })).status, 400)
  assert.equal((await handler(new Request('https://function.test'))).status, 405)
  assert.equal((await handler(new Request('https://function.test', { method: 'POST', body: '{invalid' }))).status, 400)
  assert.equal(generated.length, 0)
  const options = await handler(new Request('https://function.test', { method: 'OPTIONS' }))
  assert.equal(options.status, 200)
  assert.equal(options.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
})
