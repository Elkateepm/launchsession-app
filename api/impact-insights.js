import { createClient } from '@supabase/supabase-js'

const DAY_MS = 1000 * 60 * 60 * 24
const RISK_THRESHOLD = 4.5
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const MIN_REFRESH_GAP_MS = 5 * 60 * 1000 // 5 minutes between manual refreshes

const OUTCOME_AREA_LABELS = {
  confidence: 'Confidence', attendance: 'Attendance', education: 'Education', wellbeing: 'Wellbeing',
  resilience: 'Resilience', employability: 'Employability', social: 'Social skills', leadership: 'Leadership',
  communication: 'Communication', teamwork: 'Teamwork', mental_health: 'Mental health', behaviour: 'Behaviour',
  aspiration: 'Aspiration',
}

function trendLine(points) {
  const n = points.length
  if (n < 3) return null
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

const toPoints = list => list.map(s => ({ x: new Date(s.recorded_at).getTime() / DAY_MS, y: s.score })).sort((a, b) => a.x - b.x)

// Computes the same grounded signals as the client-side heuristic, but as
// structured data rather than English sentences — the model only writes the
// prose, it never invents or recalculates the numbers.
function computeSignals(children, scores, goals) {
  const byChild = {}
  scores.forEach(s => { (byChild[s.child_id] = byChild[s.child_id] || []).push(s) })
  const nameOf = id => children.find(c => c.id === id)?.first_name || 'Someone'
  const now = new Date()
  const nowDays = now.getTime() / DAY_MS
  const recentCutoff = new Date(now.getTime() - 30 * DAY_MS)

  const areas = []
  Object.entries(OUTCOME_AREA_LABELS).forEach(([key, label]) => {
    const pts = toPoints(scores.filter(s => s.area === key))
    if (pts.length < 3) return
    const trend = trendLine(pts)
    if (!trend) return
    const current = pts[pts.length - 1].y
    const forecast = trend.intercept + trend.slope * (nowDays + 30)
    areas.push({ label, current: Math.round(current * 10) / 10, direction: trend.slope > 0.01 ? 'up' : trend.slope < -0.01 ? 'down' : 'flat', forecastRisk: trend.slope < -0.01 && current >= RISK_THRESHOLD && forecast < RISK_THRESHOLD })
  })

  const decliningNames = []
  const risingNames = []
  Object.entries(byChild).forEach(([childId, list]) => {
    const pts = toPoints(list)
    const trend = trendLine(pts)
    if (!trend) return
    const recentAvg = list.filter(s => new Date(s.recorded_at) > recentCutoff)
    const avg = recentAvg.length ? recentAvg.reduce((s, x) => s + x.score, 0) / recentAvg.length : null
    if (trend.slope < -0.02 && avg !== null && avg < RISK_THRESHOLD + 1) decliningNames.push(nameOf(childId))
    if (trend.slope > 0.03 && pts.length >= 3) risingNames.push(nameOf(childId))
  })

  const goalsAtRisk = (goals || []).filter(g => {
    if (g.status !== 'active' || !g.target_date) return false
    const daysLeft = (new Date(g.target_date).getTime() - now.getTime()) / DAY_MS
    return daysLeft >= 0 && daysLeft <= 14 && (g.progress_pct || 0) < 50
  }).map(g => ({ title: g.title, daysLeft: Math.round((new Date(g.target_date) - now) / DAY_MS), progressPct: g.progress_pct || 0 }))

  return {
    trackedCount: Object.keys(byChild).length,
    areas,
    decliningNames: decliningNames.slice(0, 5),
    risingNames: risingNames.slice(0, 5),
    goalsAtRisk: goalsAtRisk.slice(0, 5),
  }
}

async function callClaude(signals) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const system = `You write short, honest impact summaries for youth-charity programme managers, based only on precomputed signals — never invent numbers, names, or facts not present in the signals you're given. Output strict JSON only, no markdown fences, matching exactly: {"headline": string, "bullets": [{"tone": "success"|"warning"|"accent", "text": string}]}. 3 to 5 bullets. Tone "success" for genuine positive momentum, "warning" for risks needing attention, "accent" for neutral suggestions. Keep each bullet under 25 words, warm but direct, no hype, no emoji.`
  const user = `Signals:\n${JSON.stringify(signals)}\n\nIf trackedCount is 0 or there is nothing meaningful in the signals, return {"headline": null, "bullets": []}.`

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
      console.error('impact-insights: missing required Supabase env vars')
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

    const { data: cached } = await adminClient.from('ai_insights_cache').select('content, generated_at').eq('org_id', orgId).eq('module', 'impact_outcomes').maybeSingle()

    const cacheAgeMs = cached ? Date.now() - new Date(cached.generated_at).getTime() : Infinity
    if (cached && !force && cacheAgeMs < CACHE_TTL_MS) {
      return res.status(200).json({ ...cached.content, cached: true, generated_at: cached.generated_at })
    }
    if (cached && force && cacheAgeMs < MIN_REFRESH_GAP_MS) {
      return res.status(429).json({ error: 'Insights were just refreshed — try again in a few minutes.' })
    }

    const [{ data: children }, { data: scores }, { data: goals }] = await Promise.all([
      adminClient.from('children').select('id, first_name').eq('org_id', orgId).eq('active', true),
      adminClient.from('outcome_scores').select('child_id, area, score, recorded_at').eq('org_id', orgId),
      adminClient.from('goals').select('title, status, progress_pct, target_date').eq('org_id', orgId),
    ])

    const signals = computeSignals(children || [], scores || [], goals || [])

    let content
    try {
      content = await callClaude(signals)
    } catch (aiErr) {
      console.error('impact-insights: Claude call failed', aiErr)
      return res.status(502).json({ error: 'AI insight generation failed', detail: aiErr?.message || String(aiErr) })
    }

    const generatedAt = new Date().toISOString()
    await adminClient.from('ai_insights_cache').upsert({ org_id: orgId, module: 'impact_outcomes', content, generated_at: generatedAt }, { onConflict: 'org_id,module' })

    return res.status(200).json({ ...content, cached: false, generated_at: generatedAt })
  } catch (err) {
    console.error('impact-insights: unhandled exception', err)
    return res.status(500).json({ error: 'Internal server error', detail: err?.message || String(err) })
  }
}
