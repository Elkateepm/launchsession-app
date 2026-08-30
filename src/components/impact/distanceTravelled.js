// Distance travelled — the measure this module is actually for.
//
// The previous page averaged every reading ever recorded and showed the result
// as "Organisation Health / 100". That number moves the wrong way. A young
// person's first reading is a baseline, taken at intake, and intake scores are
// low by definition -- that is the whole point of recording them. So every new
// person taken on dragged the organisation's headline score down, and an org
// doing more outreach looked like it was getting worse at its job.
//
// What funders ask for, and what the youth sector measures, is distance
// travelled: where did this person start, where are they now, how far did they
// move. That is immune to intake volume, because a baseline only ever counts as
// the start of its own pair.
//
// Everything here is pure. No component recomputes these numbers; they read
// them from one place so the headline, the area rows and the person list cannot
// disagree with each other.

// A subjective 1-10 rating recorded by different staff on different days
// carries at least half a point of noise. Movement smaller than this is not
// evidence of anything, so it counts as holding steady rather than as a change.
export const MOVEMENT_THRESHOLD = 0.5

// A person with no reading for this long has gone quiet: whatever the last
// score said, it is no longer a current answer.
export const STALE_DAYS = 90

const at = (s) => new Date(s.recorded_at).getTime()

/**
 * Pair up readings into baseline -> latest, per person per area.
 *
 * A single reading produces no pair. That is deliberate: one score is a
 * starting point, not a result, and counting it as either progress or decline
 * would be inventing a story the data does not tell.
 */
export function buildPairs(scores, since = null) {
  const usable = scores.filter(s => s && s.score != null && s.recorded_at && s.child_id && s.area)
  const windowed = since ? usable.filter(s => at(s) >= since.getTime()) : usable

  const groups = new Map()
  for (const s of windowed) {
    const key = `${s.child_id}::${s.area}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }

  const pairs = []
  for (const [key, list] of groups) {
    if (list.length < 2) continue
    list.sort((a, b) => at(a) - at(b))
    const baseline = list[0]
    const latest = list[list.length - 1]
    const [childId, area] = key.split('::')
    pairs.push({
      childId, area,
      baseline: baseline.score,
      latest: latest.score,
      delta: latest.score - baseline.score,
      baselineAt: baseline.recorded_at,
      latestAt: latest.recorded_at,
      readings: list.length,
    })
  }
  return pairs
}

export const directionOf = (delta) =>
  delta >= MOVEMENT_THRESHOLD ? 'improved'
    : delta <= -MOVEMENT_THRESHOLD ? 'declined'
      : 'held'

/**
 * The whole picture for one window, computed once.
 *
 * `tracked` counts anyone with any reading at all, `measured` only those with a
 * pair. The gap between the two is itself worth showing -- it is the honest
 * answer to "why is this number based on fewer people than we work with".
 */
export function buildImpact(scores, children = [], since = null) {
  const pairs = buildPairs(scores, since)

  const byChild = new Map()
  for (const p of pairs) {
    if (!byChild.has(p.childId)) byChild.set(p.childId, [])
    byChild.get(p.childId).push(p)
  }

  const people = []
  for (const [childId, list] of byChild) {
    const delta = list.reduce((s, p) => s + p.delta, 0) / list.length
    people.push({
      childId,
      areas: list.length,
      delta,
      direction: directionOf(delta),
      baseline: list.reduce((s, p) => s + p.baseline, 0) / list.length,
      latest: list.reduce((s, p) => s + p.latest, 0) / list.length,
      lastReadingAt: list.reduce((max, p) => (p.latestAt > max ? p.latestAt : max), list[0].latestAt),
      pairs: list,
    })
  }

  const byArea = new Map()
  for (const p of pairs) {
    if (!byArea.has(p.area)) byArea.set(p.area, [])
    byArea.get(p.area).push(p)
  }
  const areas = [...byArea.entries()].map(([area, list]) => ({
    area,
    people: new Set(list.map(p => p.childId)).size,
    baseline: list.reduce((s, p) => s + p.baseline, 0) / list.length,
    latest: list.reduce((s, p) => s + p.latest, 0) / list.length,
    delta: list.reduce((s, p) => s + p.delta, 0) / list.length,
  })).sort((a, b) => b.delta - a.delta)

  // Anyone with a reading in the window, paired or not.
  const windowed = since
    ? scores.filter(s => s.score != null && new Date(s.recorded_at) >= since)
    : scores.filter(s => s.score != null)
  const trackedIds = new Set(windowed.map(s => s.child_id))

  const improved = people.filter(p => p.direction === 'improved').length
  const declined = people.filter(p => p.direction === 'declined').length
  const held = people.filter(p => p.direction === 'held').length

  const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  const lastByChild = new Map()
  for (const s of windowed) {
    const t = at(s)
    if (!lastByChild.has(s.child_id) || t > lastByChild.get(s.child_id)) lastByChild.set(s.child_id, t)
  }
  const goneQuiet = [...lastByChild.entries()]
    .filter(([, t]) => t < staleCutoff)
    .map(([childId, t]) => ({ childId, lastReadingAt: new Date(t).toISOString() }))

  return {
    pairs,
    people: people.sort((a, b) => b.delta - a.delta),
    areas,
    goneQuiet,
    totals: {
      roster: children.length,
      tracked: trackedIds.size,
      measured: people.length,
      improved, held, declined,
      // Averaged across people, not across pairs, so one person rated on ten
      // areas does not outweigh nine people rated on one.
      avgDelta: people.length ? people.reduce((s, p) => s + p.delta, 0) / people.length : null,
    },
  }
}

/** Goal counts, which are the one outcome here that is not a subjective rating. */
export function buildGoals(goals, since = null) {
  const list = goals || []
  const completed = list.filter(g => g.status === 'completed' || g.completed_at)
  const inWindow = since
    ? completed.filter(g => g.completed_at && new Date(g.completed_at) >= since)
    : completed
  const today = new Date().toISOString().slice(0, 10)
  const active = list.filter(g => !(g.status === 'completed' || g.completed_at))
  return {
    completed: inWindow.length,
    completedAll: completed.length,
    active: active.length,
    overdue: active.filter(g => g.target_date && g.target_date < today).length,
    recent: inWindow
      .slice()
      .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))
      .slice(0, 5),
  }
}
