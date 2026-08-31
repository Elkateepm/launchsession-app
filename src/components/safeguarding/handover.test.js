import { attentionItems, isHandedOver } from './SafeguardingDashboard'

const concern = (over = {}) => ({
  id: 'x1', child_name: 'Matilda Ward', status: 'open',
  dsl_notified: true, follow_up_required: false, follow_up_due: null,
  escalated_to_case_id: null, created_at: new Date().toISOString(), ...over,
})

describe('a concern that became a case', () => {
  it('is recognised by the link, not by a status', () => {
    // Escalation never set a status, so the two escalated concerns in the live
    // database sit in different states -- one left open, one closed by hand.
    // Reading the link gives the same answer for both.
    expect(isHandedOver(concern({ escalated_to_case_id: 'case-1', status: 'open' }))).toBe(true)
    expect(isHandedOver(concern({ escalated_to_case_id: 'case-1', status: 'closed' }))).toBe(true)
    expect(isHandedOver(concern())).toBe(false)
  })

  it('is no longer chased in the concerns view', () => {
    // Without this, one incident is outstanding work in two places: an open
    // concern here and an open case next door.
    const chased = attentionItems([concern({ dsl_notified: false })])
    expect(chased.length).toBeGreaterThan(0)

    const handedOver = attentionItems([concern({ dsl_notified: false, escalated_to_case_id: 'case-1' })])
    expect(handedOver).toHaveLength(0)
  })

  it('does not silence a concern that has not been handed over', () => {
    const items = attentionItems([concern({ dsl_notified: false })])
    expect(items.some(i => i.title === 'DSL not notified')).toBe(true)
  })

  it('stops an overdue follow-up nagging once a case owns it', () => {
    const overdue = {
      follow_up_required: true,
      follow_up_due: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10),
    }
    expect(attentionItems([concern(overdue)]).length).toBeGreaterThan(0)
    expect(attentionItems([concern({ ...overdue, escalated_to_case_id: 'case-1' })])).toHaveLength(0)
  })
})
