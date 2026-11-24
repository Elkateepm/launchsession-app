import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPasswordResetHandler } from './handler.mjs'

const ORG = { name: 'Community Youth', logo_url: 'https://assets.example/community.png', primary_color: '#0F766E', branding_enabled: true }

const setup = ({ linkError, status = 200, token = 'single-use-token', configured = true, thrown = false, org = ORG, limited = false, limiterError = null } = {}) => {
  const sent = []
  const generated = []
  const limits = []
  const lookups = []
  const handler = createPasswordResetHandler({
    env: () => configured ? 'server-only-test-value' : undefined,
    createClient: () => ({
      rpc: async (name, args) => { limits.push({ name, ...args }); return { data: limiterError ? null : !limited, error: limiterError } },
      from: table => ({ select: () => ({ eq: (column, value) => ({ maybeSingle: async () => {
        lookups.push({ table, column, value })
        return { data: org, error: null }
      } }) }) }),
      auth: { admin: { generateLink: async options => {
        generated.push(options)
        return { data: { properties: { hashed_token: token } }, error: linkError }
      } } },
    }),
    fetch: async (_url, options) => {
      sent.push(JSON.parse(options.body))
      if (thrown) throw new Error('Provider unavailable')
      return new Response('{}', { status })
    },
  })
  const request = body => handler(new Request('https://function.test', { method: 'POST', body: JSON.stringify({ email: 'staff@example.com', org_slug: 'community-youth', ...body }) }))
  return { handler, request, sent, generated, limits, lookups }
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

test('the organisation comes from its record, never from the request', async () => {
  const { request, sent, lookups } = setup()
  await request({ org_name: 'Your account is locked. Call 0800 000 000', org_logo: 'https://evil.example/logo.png', org_color: '#FF0000' })
  assert.deepEqual(lookups, [{ table: 'organisations', column: 'slug', value: 'community-youth' }])
  assert.equal(sent[0].subject, 'Reset your Community Youth password')
  assert.ok(sent[0].html.includes('Community Youth'))
  assert.ok(sent[0].html.includes('https://assets.example/community.png'))
  assert.ok(sent[0].html.includes('#0F766E'))
  for (const injected of ['0800 000 000', 'evil.example', '#FF0000']) {
    assert.ok(!sent[0].html.includes(injected) && !sent[0].text.includes(injected), injected)
  }
})

test('a name with markup in the organisation record is escaped too', async () => {
  const { request, sent } = setup({ org: { ...ORG, name: '<img src=x onerror=alert(1)>' } })
  await request()
  assert.ok(!sent[0].html.includes('<img src=x'))
  assert.ok(sent[0].html.includes('&lt;img src=x onerror=alert(1)&gt;'))
})

test('an organisation without branding gets the LaunchSession logo and colour', async () => {
  const { request, sent } = setup({ org: { ...ORG, branding_enabled: false } })
  await request()
  assert.ok(sent[0].html.includes('Community Youth'))
  assert.ok(sent[0].html.includes('https://app.launchsession.co.uk/logo.png'))
  assert.ok(!sent[0].html.includes('https://assets.example/community.png'))
  assert.ok(sent[0].html.includes('#3B82F6'))
})

test('no organisation, or an unknown one, reads as LaunchSession', async () => {
  const none = setup({ org: null })
  await none.request()
  assert.equal(none.sent[0].subject, 'Reset your LaunchSession password')
  const noSlug = setup()
  await noSlug.request({ org_slug: undefined })
  assert.equal(noSlug.lookups.length, 0)
  assert.equal(noSlug.sent[0].subject, 'Reset your LaunchSession password')
})

test('rate limits refuse before any token exists, the same for every address', async () => {
  const { request, sent, generated, limits } = setup({ limited: true })
  const response = await request({ email: 'Staff@Example.com' })
  assert.equal(response.status, 429)
  assert.ok((await response.json()).error)
  assert.equal(generated.length, 0)
  assert.equal(sent.length, 0)
  assert.equal(limits[0].name, 'check_rate_limit')
  assert.equal(limits[0].p_bucket, 'pw-reset:email:staff@example.com')
})

test('an unavailable rate limiter does not stop resets', async () => {
  const { request, sent } = setup({ limiterError: { message: 'function missing' } })
  assert.equal((await request()).status, 200)
  assert.equal(sent.length, 1)
})
