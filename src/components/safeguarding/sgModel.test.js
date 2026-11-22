import {
  addDays, ageFrom, belongsTo, caseProblems, childChronology, childSignals, childrenToWatch, chronologyText,
  concernLabel, concernProblems, daysBetween, flowCounts, hubAttention, hubSummary, recentActivity, relativeDay,
} from './sgModel'

const TODAY = '2026-11-21'
const concern = (over = {}) => ({
  id: 'c1', child_name: 'Jordan Miles', concern_type: 'Neglect', status: 'open',
  dsl_notified: true, assigned_to: 'u1', follow_up_required: false, follow_up_due: null,
  escalated_to_case_id: null, created_at: '2026-11-20T10:00:00Z', ...over,
})
const kase = (over = {}) => ({
  id: 'k1', child_name: 'Sami Haddad', category: 'Bullying', status: 'open', archived: false, resolved_at: null,
  assigned_to_user_id: 'u1', requires_dsl: false, immediate_danger: false, next_review_date: null,
  created_at: '2026-11-10T10:00:00Z', ...over,
})
const child = (over = {}) => ({ id: 'ch1', first_name: 'Jordan', last_name: 'Miles', ...over })

describe('dates', () => {
  it('counts days and moves across month ends', () => {
    expect(daysBetween('2026-11-19', TODAY)).toBe(2)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays(TODAY, -30)).toBe('2026-10-22')
  })
  it('says when in words people use', () => {
    expect(relativeDay('2026-11-21T08:00:00Z', TODAY)).toBe('today')
    expect(relativeDay('2026-11-20T08:00:00Z', TODAY)).toBe('yesterday')
    expect(relativeDay('2026-11-18', TODAY)).toBe('3 days ago')
    expect(relativeDay('2026-10-01', TODAY)).toBe('on 1 Oct 2026')
  })
  it('works out an age from a date of birth', () => {
    expect(ageFrom('2011-11-22', TODAY)).toBe(14)
    expect(ageFrom('2011-11-21', TODAY)).toBe(15)
    expect(ageFrom(null, TODAY)).toBeNull()
  })
})

describe('what has gone wrong with a concern', () => {
  it('puts the lead not knowing first and treats it as urgent', () => {
    const p = concernProblems(concern({ dsl_notified: false, assigned_to: null }), TODAY)
    expect(p.map(x => x.code)).toEqual(['lead', 'owner'])
    expect(p[0].urgency).toBe('urgent')
  })
  it('chases follow-ups by date, and a follow-up with no date', () => {
    expect(concernProblems(concern({ follow_up_required: true, follow_up_due: '2026-11-19' }), TODAY)[0].text).toBe('follow-up 2 days overdue')
    expect(concernProblems(concern({ follow_up_required: true, follow_up_due: TODAY }), TODAY)[0].code).toBe('due')
    expect(concernProblems(concern({ follow_up_required: true }), TODAY)[0].code).toBe('nodate')
  })
  it('flags a concern left open a fortnight', () => {
    expect(concernProblems(concern({ created_at: '2026-11-01T09:00:00Z' }), TODAY).map(x => x.code)).toEqual(['stale'])
  })
  it('stops chasing once it is closed or handed over to a case', () => {
    expect(concernProblems(concern({ dsl_notified: false, status: 'closed' }), TODAY)).toEqual([])
    expect(concernProblems(concern({ dsl_notified: false, escalated_to_case_id: 'k1' }), TODAY)).toEqual([])
  })
  it('names the register\'s quick concerns plainly', () => {
    expect(concernLabel({ concern_type: 'other' })).toBe('Concern')
    expect(concernLabel({ concern_type: 'online safety' })).toBe('Online safety concern')
  })
})

describe('what has gone wrong with a case', () => {
  it('knows danger, missed reviews, late tasks, no owner and waiting for the lead', () => {
    const p = caseProblems(kase({ immediate_danger: true, next_review_date: '2026-11-18', assigned_to_user_id: null, requires_dsl: true }),
      [{ case_id: 'k1', title: 'Call school', due_date: '2026-11-20', completed: false }, { case_id: 'k1', title: 'Done', due_date: '2026-11-01', completed: true }], TODAY)
    expect(p.map(x => x.code)).toEqual(['danger', 'review', 'tasks', 'owner', 'lead'])
    expect(p[1].text).toBe('review 3 days overdue')
    expect(p[2].text).toBe('task overdue: Call school')
  })
  it('leaves acknowledged danger and closed cases alone', () => {
    expect(caseProblems(kase({ immediate_danger: true, risk_ack_at: '2026-11-20T10:00:00Z' }), [], TODAY)).toEqual([])
    expect(caseProblems(kase({ assigned_to_user_id: null, status: 'closed' }), [], TODAY)).toEqual([])
    expect(caseProblems(kase({ assigned_to_user_id: null, archived: true }), [], TODAY)).toEqual([])
  })
})

describe('the needs-attention list', () => {
  it('gives one item per concern, not one per problem', () => {
    const items = hubAttention({ concerns: [concern({ dsl_notified: false, assigned_to: null })], today: TODAY })
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe("Jordan Miles: the safeguarding lead hasn't been told")
    expect(items[0].detail).toBe('Neglect concern, raised yesterday · Nobody owns it')
    expect(items[0].urgency).toBe('urgent')
  })
  it('puts urgent things first across concerns, cases and the accident book', () => {
    const items = hubAttention({
      concerns: [concern({ id: 'c2', assigned_to: null })],
      cases: [kase({ immediate_danger: true })],
      injuries: [{ id: 'i1', parent_notified: true, follow_up_needed: true }, { id: 'i2', parent_notified: false }],
      today: TODAY,
    })
    expect(items.map(i => i.kind)).toEqual(['case', 'injuries', 'concern'])
    expect(items[1].title).toBe('1 parent not told about an injury')
    expect(items[1].detail).toBe('1 follow-up open as well · 2 accident book entries to finish')
  })
  it('is empty when everything is in hand', () => {
    expect(hubAttention({ concerns: [concern()], cases: [kase()], injuries: [{ parent_notified: true }], today: TODAY })).toEqual([])
  })
})

describe('from concern to case', () => {
  it('counts each open concern once, and handed-over ones as cases', () => {
    const flow = flowCounts([
      concern({ id: 'a', dsl_notified: false }),
      concern({ id: 'b' }),
      concern({ id: 'c', escalated_to_case_id: 'k1' }),
      concern({ id: 'd', status: 'closed', closed_at: '2026-11-05T10:00:00Z' }),
      concern({ id: 'e', status: 'closed', closed_at: '2026-10-05T10:00:00Z' }),
    ], [kase(), kase({ id: 'k2', status: 'closed', updated_at: '2026-11-15T10:00:00Z' })], TODAY)
    expect(flow).toEqual({ raised: 1, withLead: 1, cases: 1, closed: 2 })
  })
  it('sums it up in a line', () => {
    expect(hubSummary([{ urgency: 'urgent' }, { urgency: 'soon' }], { raised: 1, withLead: 2, cases: 1 })).toBe('1 thing to sort out now · 3 open concerns · 1 open case')
    expect(hubSummary([], { raised: 0, withLead: 0, cases: 0 })).toBe('Nothing needs you right now. No open concerns or cases.')
  })
})

describe('a child\'s records', () => {
  it('matches by link, then by any name in the list, whatever the spacing or case', () => {
    expect(belongsTo({ child_id: 'ch1' }, child())).toBe(true)
    expect(belongsTo({ child_name: ' jordan  MILES ' }, child())).toBe(true)
    expect(belongsTo({ child_id: 'ch9', child_name: 'Amy Lee, Jordan Miles' }, child())).toBe(true)
    expect(belongsTo({ child_name: 'Jordan Milesy' }, child())).toBe(false)
  })
  it('scores the children who most need a look first', () => {
    const kids = [child(), child({ id: 'ch2', first_name: 'Sami', last_name: 'Haddad' }), child({ id: 'ch3', first_name: 'Ruby', last_name: 'Clarke' })]
    const signals = childSignals({
      children: kids,
      concerns: [concern({ child_id: 'ch1' })],
      cases: [kase()],
      checks: [{ id: 'w1', child_id: 'ch3', mood: 'happy', created_at: '2026-11-20T10:00:00Z' }],
      injuries: [{ id: 'i1', child_id: 'ch1', occurred_at: '2026-11-19T10:00:00Z' }],
      today: TODAY,
    })
    expect(signals.ch1).toMatchObject({ openConcerns: 1, openCases: 0, injuries30: 1, concernsEver: 1, score: 5 })
    expect(signals.ch2).toMatchObject({ openCases: 1, score: 5 })
    expect(signals.ch3.lastCheck.mood).toBe('happy')
    expect(childrenToWatch(kids, signals).map(k => k.id)).toEqual(['ch1', 'ch2'])
  })
  it('builds a newest-first chronology and a copyable text version', () => {
    const data = {
      concerns: [concern({ child_id: 'ch1', date_of_incident: '2026-11-19', description: 'Arrived hungry again.', submitter_name: 'Aisha' })],
      cases: [kase({ child_name: 'Jordan Miles', created_at: '2026-11-20T09:00:00Z' })],
      injuries: [{ id: 'i1', child_id: 'ch1', occurred_at: '2026-11-21T09:00:00Z', injury_type: 'Graze', body_part: 'Knee', parent_notified: false }],
      checks: [{ id: 'w1', child_id: 'ch1', mood: 'worried', created_at: '2026-11-18T09:00:00Z' }],
    }
    const entries = childChronology(child(), data)
    expect(entries.map(e => e.title)).toEqual(['Injury: Graze, Knee', 'Bullying case opened', 'Neglect concern raised', 'Check-in: worried'])
    expect(entries[0].warn).toBe(true)
    const text = chronologyText(child(), entries, TODAY)
    expect(text.split('\n')[0]).toBe('Safeguarding chronology: Jordan Miles')
    expect(text).toContain('19 Nov 2026: Neglect concern raised - Arrived hungry again. - by Aisha')
  })
  it('names the child on a check-in in the hub\'s latest activity', () => {
    const items = recentActivity({ children: [child()], checks: [{ id: 'w1', child_id: 'ch1', mood: 'upset', created_at: '2026-11-20T09:00:00Z' }] })
    expect(items[0]).toMatchObject({ kind: 'check', child: 'Jordan Miles', title: 'Check-in: upset' })
  })
})
