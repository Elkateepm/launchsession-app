import React from 'react'
import { render, waitFor } from '@testing-library/react'
import FunderReport from './FunderReport'
import { getFunderMetrics } from '../../lib/funderReport'

jest.mock('../../lib/funderReport', () => ({
  ...jest.requireActual('../../lib/funderReport'),
  getFunderMetrics: jest.fn(),
}))

// The real shape report_funder_metrics returns for Solidarity Sports.
const METRICS = {
  from: '2026-01-01', to: '2026-08-30', generated_at: '2026-08-30T22:46:55Z',
  reach: { people: 47, new_to_us: 47, returning: 0, on_roll: 54, schools: 2, with_sen: 1,
    age_bands: { age_8_11: 25, age_12_15: 19, age_16_18: 2, unknown: 1 } },
  engagement: { attended_once: 6, attended_2_4: 15, attended_5_9: 11, attended_10_plus: 15,
    median_sessions: 6, total_attendances: 307, retained: 0, retention_base: 0 },
  delivery: { sessions_planned: 55, sessions_delivered: 55, contact_hours: 188,
    participant_hours: 555, locations: 22, projects: 2 },
  attendance: { rate: 86, prev_rate: null, absences: 52 },
  outcomes: { measured: 1, tracked: 3, improved: 0, held: 0, declined: 1, avg_delta: '-9.00',
    by_area: [{ area: 'education', people: 1, baseline: '10.00', latest: '1.00', delta: '-9.00' }] },
  goals: { completed: 0, active: 0 },
  safeguarding: { open_concerns: 6 },
}

const org = { id: 'o1', name: 'Solidarity Sports' }

describe('FunderReport document', () => {
  beforeEach(() => getFunderMetrics.mockResolvedValue(METRICS))

  it('renders every section a grant report is expected to carry', async () => {
    const { container } = render(
      <FunderReport org={org} range={{ from: '2026-01-01', to: '2026-08-30' }} onClose={() => {}} />)
    await waitFor(() => expect(container.textContent).toContain('Impact and delivery report'))
    const t = container.textContent
    for (const heading of ['Summary', 'Who we reached', 'How much they got',
      'What we delivered', 'What changed', 'Safeguarding', 'What this report does not cover']) {
      expect(t).toContain(heading)
    }
  })

  it('carries the org, the period and the real figures', async () => {
    const { container } = render(
      <FunderReport org={org} range={{ from: '2026-01-01', to: '2026-08-30' }} onClose={() => {}} />)
    await waitFor(() => expect(container.textContent).toContain('Solidarity Sports'))
    const t = container.textContent
    expect(t).toContain('1 January 2026 to 30 August 2026')
    expect(t).toContain('47')   // reached
    expect(t).toContain('307')  // attendances
    expect(t).toContain('86%')  // attendance rate
    expect(t).toContain('555h') // participant hours
  })

  it('never claims an improvement that did not happen', async () => {
    const { container } = render(
      <FunderReport org={org} range={{ from: '2026-01-01', to: '2026-08-30' }} onClose={() => {}} />)
    await waitFor(() => expect(container.textContent).toContain('Summary'))
    expect(container.textContent).toContain('Scores fell by an average of 9.0 points')
  })

  it('states its own gaps on the document', async () => {
    const { container } = render(
      <FunderReport org={org} range={{ from: '2026-01-01', to: '2026-08-30' }} onClose={() => {}} />)
    await waitFor(() => expect(container.textContent).toContain('does not cover'))
    expect(container.textContent).toContain('Ethnicity, gender, postcode')
    expect(container.textContent).toContain('not validated instruments')
  })

  it('surfaces the failure rather than an empty document', async () => {
    getFunderMetrics.mockRejectedValue(new Error('Not authorised'))
    const { container } = render(
      <FunderReport org={org} range={{ from: '2026-01-01', to: '2026-08-30' }} onClose={() => {}} />)
    await waitFor(() => expect(container.textContent).toContain('Could not build the report'))
  })
})
