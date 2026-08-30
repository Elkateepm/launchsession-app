import { buildImpact, buildPairs, buildGoals, directionOf, MOVEMENT_THRESHOLD } from './distanceTravelled'

// A reading `daysAgo` days before now.
const s = (child, area, score, daysAgo) => ({
  child_id: child, area, score,
  recorded_at: new Date(Date.now() - daysAgo * 864e5).toISOString(),
})

describe('pairing readings', () => {
  it('makes no pair from a single reading', () => {
    // One score is a starting point, not a result.
    expect(buildPairs([s('a', 'confidence', 3, 30)])).toHaveLength(0)
  })

  it('takes the earliest as baseline and the most recent as latest', () => {
    const [p] = buildPairs([
      s('a', 'confidence', 3, 30), s('a', 'confidence', 5, 15), s('a', 'confidence', 7, 1),
    ])
    expect(p.baseline).toBe(3)
    expect(p.latest).toBe(7)
    expect(p.delta).toBe(4)
    expect(p.readings).toBe(3)
  })

  it('ignores readings with no score', () => {
    expect(buildPairs([s('a', 'confidence', null, 30), s('a', 'confidence', 7, 1)])).toHaveLength(0)
  })

  it('does not pair across different areas', () => {
    expect(buildPairs([s('a', 'confidence', 3, 30), s('a', 'wellbeing', 7, 1)])).toHaveLength(0)
  })
})

describe('direction', () => {
  it('treats movement below the threshold as holding steady', () => {
    expect(directionOf(MOVEMENT_THRESHOLD - 0.1)).toBe('held')
    expect(directionOf(-(MOVEMENT_THRESHOLD - 0.1))).toBe('held')
  })

  it('treats the threshold itself as movement', () => {
    expect(directionOf(MOVEMENT_THRESHOLD)).toBe('improved')
    expect(directionOf(-MOVEMENT_THRESHOLD)).toBe('declined')
  })
})

describe('immunity to intake volume', () => {
  // The regression this module was rebuilt around. The previous page averaged
  // every reading ever recorded, so taking on a new person -- whose first score
  // is a baseline, and low by definition -- pushed the organisation's headline
  // number down. Doing more outreach made the charity look worse at its job.
  const cohort = [
    s('a', 'confidence', 3, 200), s('a', 'confidence', 8, 10),
    s('b', 'confidence', 4, 200), s('b', 'confidence', 9, 10),
  ]
  const meanOfAll = (list) => list.reduce((t, x) => t + x.score, 0) / list.length

  it('reproduces the old metric falling when an intake baseline lands', () => {
    const withIntake = [...cohort, s('c', 'confidence', 2, 1)]
    expect(meanOfAll(withIntake)).toBeLessThan(meanOfAll(cohort))
  })

  it('leaves distance travelled untouched by that same intake', () => {
    const before = buildImpact(cohort, [{ id: 'a' }, { id: 'b' }], null)
    const after = buildImpact([...cohort, s('c', 'confidence', 2, 1)],
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }], null)
    expect(after.totals.avgDelta).toBe(before.totals.avgDelta)
  })

  it('still counts the new intake as tracked, but not as measured', () => {
    const after = buildImpact([...cohort, s('c', 'confidence', 2, 1)],
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }], null)
    expect(after.totals.tracked).toBe(3)
    expect(after.totals.measured).toBe(2)
  })
})

describe('averaging', () => {
  // Someone rated on four areas must not outweigh three people rated on one.
  // 'big' moves +1 on one area and not at all on three, averaging 0.25 -- below
  // the threshold, so they held steady despite carrying the most data.
  const mixed = [
    s('big', 'confidence', 2, 100), s('big', 'confidence', 3, 1),
    ...['wellbeing', 'social', 'teamwork'].flatMap(a => [s('big', a, 2, 100), s('big', a, 2, 1)]),
    ...['x', 'y', 'z'].flatMap(id => [s(id, 'confidence', 2, 100), s(id, 'confidence', 9, 1)]),
  ]
  const roster = [{ id: 'big' }, { id: 'x' }, { id: 'y' }, { id: 'z' }]

  it('averages across people rather than across pairs', () => {
    const m = buildImpact(mixed, roster, null)
    expect(m.totals.avgDelta).toBeCloseTo((0.25 + 7 + 7 + 7) / 4, 10)
  })

  it('counts a sub-threshold mover as holding steady however many areas they have', () => {
    const m = buildImpact(mixed, roster, null)
    expect(m.totals.improved).toBe(3)
    expect(m.totals.held).toBe(1)
    expect(m.people.find(p => p.childId === 'big').areas).toBe(4)
  })
})

describe('reporting period', () => {
  const long = [s('a', 'confidence', 2, 300), s('a', 'confidence', 5, 100), s('a', 'confidence', 6, 5)]

  it('baselines against the earliest reading inside the window', () => {
    const [p] = buildImpact(long, [{ id: 'a' }], new Date(Date.now() - 180 * 864e5)).pairs
    expect(p.baseline).toBe(5)
    expect(p.latest).toBe(6)
  })

  it('uses the true first reading over all time', () => {
    expect(buildImpact(long, [{ id: 'a' }], null).pairs[0].baseline).toBe(2)
  })
})

describe('gone quiet', () => {
  it('flags someone with no recent reading', () => {
    const q = buildImpact([s('a', 'confidence', 5, 200), s('a', 'confidence', 6, 150)], [{ id: 'a' }], null)
    expect(q.goneQuiet).toHaveLength(1)
  })

  it('leaves a recently-read person alone', () => {
    const q = buildImpact([s('a', 'confidence', 5, 200), s('a', 'confidence', 6, 3)], [{ id: 'a' }], null)
    expect(q.goneQuiet).toHaveLength(0)
  })
})

describe('goals', () => {
  const iso = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString()

  it('counts completions inside the window only', () => {
    const goals = [
      { id: '1', status: 'completed', completed_at: iso(10) },
      { id: '2', status: 'completed', completed_at: iso(400) },
      { id: '3', status: 'active' },
    ]
    const g = buildGoals(goals, new Date(Date.now() - 180 * 864e5))
    expect(g.completed).toBe(1)
    expect(g.completedAll).toBe(2)
    expect(g.active).toBe(1)
  })

  it('counts an active goal past its target date as overdue', () => {
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
    const g = buildGoals([{ id: '1', status: 'active', target_date: yesterday }], null)
    expect(g.overdue).toBe(1)
  })

  it('does not call a completed goal overdue', () => {
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
    const g = buildGoals([{ id: '1', status: 'completed', completed_at: iso(1), target_date: yesterday }], null)
    expect(g.overdue).toBe(0)
  })
})
