import { statFor } from './OfficeOverview'

describe('statFor', () => {
  // The card is a decision aid: "is there anything for me in here?" A wrong
  // or missing number is worse than no card at all.
  it('puts new responses ahead of the live form count, and marks them urgent', () => {
    expect(statFor('forms', { forms: 3 }, 2)).toEqual({ text: '2 new responses', urgent: true })
    expect(statFor('forms', { forms: 3 }, 1)).toEqual({ text: '1 new response', urgent: true })
  })

  it('falls back to live forms when nothing is waiting', () => {
    expect(statFor('forms', { forms: 3 }, 0)).toEqual({ text: '3 live forms' })
    expect(statFor('forms', { forms: 1 }, 0)).toEqual({ text: '1 live form' })
  })

  // Zero is a real answer and worth showing -- "No live forms" tells you the
  // screen is empty without opening it. Unknown is not, and must stay blank.
  it('distinguishes zero from unknown', () => {
    expect(statFor('forms', { forms: 0 }, 0)).toEqual({ text: 'No live forms' })
    expect(statFor('forms', {}, 0)).toBeNull()
    expect(statFor('newsletter', {}, 0)).toBeNull()
    expect(statFor('payments', {}, 0)).toBeNull()
  })

  it('gets the singular right everywhere it counts', () => {
    expect(statFor('newsletter', { newsletter: 1 }, 0).text).toBe('1 draft')
    expect(statFor('newsletter', { newsletter: 4 }, 0).text).toBe('4 drafts')
    expect(statFor('newsletter', { newsletter: 0 }, 0).text).toBe('Nothing in draft')
    expect(statFor('resource_booking', { resource_booking: 0 }, 0).text).toBe('Nothing booked')
    expect(statFor('resource_booking', { resource_booking: 5 }, 0).text).toBe('5 upcoming')
    expect(statFor('payments', { payments: 0 }, 0).text).toBe('Nothing this month')
    expect(statFor('templates', { templates: 0 }, 0).text).toBe('None yet')
    expect(statFor('templates', { templates: 7 }, 0).text).toBe('7 ready to use')
  })

  it('says so plainly where the screen is not built yet', () => {
    expect(statFor('parent_portal', {}, 0)).toEqual({ text: 'Coming soon', muted: true })
  })

  it('returns null for anything it has no opinion about', () => {
    expect(statFor('something_else', {}, 0)).toBeNull()
  })
})
