import { normalisePlan, toStored, withTimes, fit, sessionLength, equipmentList, outcomesCovered, nowInPlan, moveBlock, duplicateBlock, removeBlock, scaffold, blocksFromHtml, planToHtml, newBlock, STARTER_ACTIVITIES, KINDS } from './sessionPlan'
import { OUTCOME_AREAS } from '../components/impact/impact_shared'

const session = { session_date: '2026-11-28', start_time: '16:30', end_time: '18:00' }
const plan = [
  newBlock({ kind: 'welcome', title: 'Welcome', minutes: 10 }),
  newBlock({ kind: 'warmup', title: 'Warm-up', minutes: 15, equipment: ['Cones', 'balls'] }),
  newBlock({ kind: 'game', title: 'Game', minutes: 40, equipment: ['Balls', 'Bibs'], outcome: 'teamwork' }),
]

test('stored plans are cleaned up, and saved small', () => {
  expect(normalisePlan(null)).toEqual([])
  const [b] = normalisePlan([{ kind: 'nope', minutes: 9999, title: 'x', equipment: ['  Cones ', '', 3] }])
  expect(b).toMatchObject({ kind: 'activity', minutes: 600, equipment: ['Cones'] })
  expect(Object.keys(toStored([{ id: 'a', kind: 'game', title: 'G', minutes: 5 }])[0]).sort()).toEqual(['id', 'kind', 'minutes', 'title'])
})

test('times follow from the session start and each block before it', () => {
  const timed = withTimes(plan, '16:30')
  expect(timed.map(b => `${b.start}-${b.end}`)).toEqual(['16:30-16:40', '16:40-16:55', '16:55-17:35'])
})

test('fit: spare, exact, over, and overnight sessions', () => {
  expect(sessionLength(session)).toBe(90)
  expect(sessionLength({ start_time: '23:10', end_time: '01:10' })).toBe(120)
  expect(fit(plan, session)).toMatchObject({ status: 'short', spare: 25, text: '65 of 90 min planned · 25 min spare' })
  expect(fit([...plan, newBlock({ minutes: 25 })], session)).toMatchObject({ status: 'fits' })
  expect(fit([...plan, newBlock({ minutes: 40 })], session)).toMatchObject({ status: 'over', over: 15 })
  expect(fit([], session).status).toBe('empty')
})

test('what to bring merges the same item across blocks', () => {
  expect(equipmentList(plan)).toEqual([
    { item: 'balls', uses: ['Warm-up', 'Game'] },
    { item: 'Bibs', uses: ['Game'] },
    { item: 'Cones', uses: ['Warm-up'] },
  ])
  expect(outcomesCovered(plan)).toEqual([{ key: 'teamwork', minutes: 40 }])
})

test('on the day: before, during (with time left and next), after', () => {
  const timed = withTimes(plan, '16:30')
  const t = (h, m) => h * 60 + m
  expect(nowInPlan(timed, session, '2026-11-27', t(17, 0))).toBeNull()
  expect(nowInPlan(timed, session, '2026-11-28', t(16, 0))).toMatchObject({ phase: 'before', startsIn: 30 })
  const now = nowInPlan(timed, session, '2026-11-28', t(16, 45))
  expect(now).toMatchObject({ phase: 'during', index: 1, left: 10 })
  expect(now.next.title).toBe('Game')
  expect(nowInPlan(timed, session, '2026-11-28', t(17, 40))).toMatchObject({ phase: 'after' })
})

test('move, duplicate, remove', () => {
  expect(moveBlock(plan, 0, 1).map(b => b.title)).toEqual(['Warm-up', 'Welcome', 'Game'])
  expect(moveBlock(plan, 0, -1)).toBe(plan)
  const dup = duplicateBlock(plan, 1)
  expect(dup.map(b => b.title)).toEqual(['Welcome', 'Warm-up', 'Warm-up (again)', 'Game'])
  expect(dup[2].id).not.toBe(dup[1].id)
  expect(removeBlock(plan, 0).length).toBe(2)
})

test('a starting shape fills the session exactly', () => {
  const s = scaffold(session)
  expect(s.map(b => b.kind)).toEqual(['welcome', 'warmup', 'activity', 'game', 'reflection'])
  expect(s.reduce((a, b) => a + b.minutes, 0)).toBe(90)
  expect(scaffold({ start_time: '10:00', end_time: '10:45' }).reduce((a, b) => a + b.minutes, 0)).toBe(45)
})

test('older free-text plans become blocks', () => {
  const sport = '<h2>Session Overview</h2><p>Duration: 90 minutes</p><h2>Warm Up (15 mins)</h2><ul><li>Dynamic stretching</li><li>Passing in pairs</li></ul><h2>Small-sided Games (30 mins)</h2><ul><li>5v5</li></ul><h2>Cool Down &amp; Reflection (10 mins)</h2>'
  expect(blocksFromHtml(sport).map(b => [b.kind, b.title, b.minutes, b.details])).toEqual([
    ['warmup', 'Warm Up', 15, 'Dynamic stretching\nPassing in pairs'],
    ['game', 'Small-sided Games', 30, '5v5'],
    ['cooldown', 'Cool Down & Reflection', 10, ''],
  ])
  const day = '<h2>Morning (09:00-12:00)</h2><ul><li>09:00 - Registration and welcome</li><li>09:15 - Icebreaker games</li><li>09:45 - Sport session 1</li></ul>'
  expect(blocksFromHtml(day).map(b => [b.kind, b.minutes])).toEqual([['welcome', 15], ['icebreaker', 30], ['activity', 30]])
  // and back again
  expect(blocksFromHtml(planToHtml(plan)).map(b => [b.title, b.minutes])).toEqual(plan.map(b => [b.title, b.minutes]))
})

test('built-in ideas use real kinds and real outcome areas', () => {
  const kinds = KINDS.map(k => k.key), areas = OUTCOME_AREAS.map(a => a.key)
  for (const a of STARTER_ACTIVITIES) {
    expect(kinds).toContain(a.kind)
    if (a.outcome) expect(areas).toContain(a.outcome)
  }
})
