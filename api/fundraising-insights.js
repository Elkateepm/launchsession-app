import { createClient } from '@supabase/supabase-js'

const DAY_MS = 1000 * 60 * 60 * 24
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const MIN_REFRESH_GAP_MS = 5 * 60 * 1000 // 5 minutes between manual refreshes

function statusOf(c) {
  const today = new Date().toISOString().slice(0, 10)
  if (c.start_date && c.start_date > today) return 'planning'
  if (c.end_date && c.end_date < today) return 'completed'
  return 'active'
}

// Same grounded pace/stalled/story computation as the client heuristic —
// the model only writes the prose, it never recalculates or invents the numbers.
function computeSignals(campaigns, latestDonationByCampaign) {
  const now = new Date()
  const paceAhead = []
  const paceBehind = []
  const stalled = []
  const missingStory = []

  campaigns.forEach(c => {
    const status = statusOf(c)
    if (status !== 'active') return

    if (c.target_amount && c.start_date && c.end_date) {
      const start = new Date(c.start_date), end = new Date(c.end_date)
      const totalDays = (end - start) / DAY_MS
      const elapsedDays = (now - start) / DAY_MS
      if (totalDays > 0 && elapsedDays > 0) {
        const expectedPct = Math.min(elapsedDays / totalDays, 1)
        const actualPct = (c.raised || 0) / c.target_amount
        const diff = actualPct - expectedPct
        if (diff > 0.1) paceAhead.push({ name: c.name, raisedPct: Math.round(actualPct * 100) })
        else if (diff < -0.15) paceBehind.push({ name: c.name, raisedPct: Math.round(actualPct * 100), timeUsedPct: Math.round(expectedPct * 100) })
      }
    }

    const latest = latestDonationByCampaign[c.id]
    const daysSince = latest ? (now - new Date(latest)) / DAY_MS : (now - new Date(c.start_date || c.created_at)) / DAY_MS
    if (daysSince >= 14) stalled.push({ name: c.name, daysSinceLastDonation: Math.floor(daysSince) })

    if (!c.description) missingStory.push(c.name)
  })

  return {
    activeCampaignCount: campaigns.filter(c => statusOf(c) === 'active').length,
    paceAhead: paceAhead.slice(0, 5),
    paceBehind: paceBehind.slice(0, 5),
    stalled: stalled.slice(0, 5),
    missingStory: missingStory.slice(0, 5),
  }
}

async function callClaude(signals) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const system = `You write short, warm, genuinely upbeat fundraising updates for charity staff who are not fundraising experts — think "encouraging teammate," not corporate dashboard. Base everything only on the precomputed signals given; never invent numbers, campaign names, or facts not present. Output strict JSON only, no markdown fences, matching exactly: {"headline": string, "bullets": [{"tone": "success"|"warning"|"accent", "text": string}]}. 3 to 5 bullets. "success" for genuine good news worth celebrating, "warning" for things needing attention (still kind, never alarmist), "accent" for a friendly tip. Each bullet under 22 words. You may use at most one light, tasteful emoji per bullet where it genuinely fits — never force it.`
  const user = `Signals:\n${JSON.stringify(signals)}\n\nIf activeCampaignCount is 0 and there is nothing meaningful in the signals, return {"headline": null, "bullets": []}.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  const cleaned = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  if (typeof parsed.headline === 'undefined' || !Array.isArray(parsed.bullets)) throw new Error('Unexpected shape from Claude')
  return parsed
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

    const { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_SERVICE_KEY } = process.env
    if (!REACT_APP_SUPABASE_URL || !REACT_APP_SUPABASE_ANON_KEY || !REACT_APP_SUPABASE_SERVICE_KEY) {
      console.error('fundraising-insights: missing required Supabase env vars')
      return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' })
    }

    const anonClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' })

    const { force } = req.body || {}
    const adminClient = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_SERVICE_KEY)

    const { data: profile, error: profileErr } = await adminClient.from('user_profiles').select('org_id').eq('id', user.id).maybeSingle()
    if (profileErr || !profile?.org_id) return res.status(403).json({ error: 'No organisation found for this account' })
    const orgId = profile.org_id

    const { data: cached } = await adminClient.from('ai_insights_cache').select('content, generated_at').eq('org_id', orgId).eq('module', 'fundraising').maybeSingle()

    const cacheAgeMs = cached ? Date.now() - new Date(cached.generated_at).getTime() : Infinity
    if (cached && !force && cacheAgeMs < CACHE_TTL_MS) {
      return res.status(200).json({ ...cached.content, cached: true, generated_at: cached.generated_at })
    }
    if (cached && force && cacheAgeMs < MIN_REFRESH_GAP_MS) {
      return res.status(429).json({ error: 'Insights were just refreshed — try again in a few minutes.' })
    }

    const [{ data: campaigns }, { data: donations }] = await Promise.all([
      adminClient.from('fundraising_campaigns').select('id, name, description, target_amount, raised, start_date, end_date, created_at').eq('org_id', orgId),
      adminClient.from('fundraising_donations').select('campaign_id, created_at').eq('org_id', orgId).order('created_at', { ascending: false }),
    ])

    const latestDonationByCampaign = {}
    ;(donations || []).forEach(d => { if (!latestDonationByCampaign[d.campaign_id]) latestDonationByCampaign[d.campaign_id] = d.created_at })

    const signals = computeSignals(campaigns || [], latestDonationByCampaign)

    let content
    try {
      content = await callClaude(signals)
    } catch (aiErr) {
      console.error('fundraising-insights: Claude call failed', aiErr)
      return res.status(502).json({ error: 'AI insight generation failed', detail: aiErr?.message || String(aiErr) })
    }

    const generatedAt = new Date().toISOString()
    await adminClient.from('ai_insights_cache').upsert({ org_id: orgId, module: 'fundraising', content, generated_at: generatedAt }, { onConflict: 'org_id,module' })

    return res.status(200).json({ ...content, cached: false, generated_at: generatedAt })
  } catch (err) {
    console.error('fundraising-insights: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
