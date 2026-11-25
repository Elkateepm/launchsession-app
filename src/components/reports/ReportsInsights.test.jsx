import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import InsightsHome from './InsightsHome'
import ReportStudio from './ReportStudio'
import { normalizeInsights, fromLegacy } from '../../lib/insights'
import { loadInsights, loadDocs, insertReportDefinition, updateReportDefinition } from '../../lib/insightsService'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
jest.mock('../../lib/insightsService', () => ({
  loadInsights: jest.fn(),
  loadDocs: jest.fn(),
  insertReportDefinition: jest.fn(),
  updateReportDefinition: jest.fn(),
  markReportRun: jest.fn(),
  downloadCsv: jest.fn(),
  saveErrorMessage: (e) => e.message,
}))

const terms = {
  person: 'young person', people: 'young people', Person: 'Young Person', People: 'Young People',
  session: 'session', sessions: 'sessions', Session: 'Session', Sessions: 'Sessions',
  group: 'group', Group: 'Group', Groups: 'Groups', Staff: 'Staff',
}
const org = { id: 'org-1', name: 'Community Club', primary_color: '#315B46' }

const raw = (overrides = {}) => ({
  from: '2026-09-01', to: '2026-11-24', prev_from: '2026-06-08', prev_to: '2026-08-31', bucket: 'week',
  current: { sessions_delivered: 22, hours: 95, attendances: 32, marked: 62, attendance_rate: 52, reached: 17, new_people: 4, volunteer_hours: 12.5, volunteers: 2, locations: 4, concerns_raised: 3 },
  previous: { sessions_delivered: 51, hours: 195, attendances: 271, marked: 314, attendance_rate: 86, reached: 46, new_people: 46, volunteer_hours: 0, concerns_raised: 6 },
  series: [
    { start: '2026-09-01', finish: '2026-09-06', sessions: 2, hours: 6, marked: 6, rate: 67, reached: 4, volunteer_hours: 2.5, concerns: 1 },
    { start: '2026-09-07', finish: '2026-09-13', sessions: 9, hours: 40, marked: 30, rate: 47, reached: 9, volunteer_hours: 6, concerns: 1 },
    { start: '2026-09-14', finish: '2026-09-20', sessions: 11, hours: 49, marked: 26, rate: 54, reached: 8, volunteer_hours: 4, concerns: 1 },
  ],
  by_project: [{ id: 'a0000000-0000-0000-0000-0000000000a1', label: 'Summer Camp', sessions: 12, reached: 10, rate: 60 }],
  by_group: [{ label: 'Juniors', reached: 9, attendances: 20 }],
  by_location: [{ label: 'Hall', sessions: 15 }],
  by_age: { age_8_11: 9, age_12_15: 7 },
  can_see_safeguarding: true,
  safeguarding: { open_now: 6, resolved_in_period: 0, follow_up_overdue: 1 },
  options: { projects: [{ id: 'a0000000-0000-0000-0000-0000000000a1', name: 'Summer Camp' }], groups: ['Juniors', 'Seniors'] },
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  loadDocs.mockResolvedValue({})
})

describe('InsightsHome', () => {
  test('shows headline figures with their change, findings, trends and breakdowns', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<InsightsHome org={org} role="admin" terms={terms} isMobile={false} attention={[]} />)
    expect((await screen.findAllByText('Young People reached')).length).toBeGreaterThan(0)
    expect(screen.getByText('−63%')).toBeInTheDocument()
    expect(screen.getByText('−34 pts')).toBeInTheDocument()
    expect(screen.getByText(/Attendance down 34 points on the 85 days before/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Attendance rate' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Volunteer hours' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Safeguarding concerns raised' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'By project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All projects/ })).toBeInTheDocument()
  })

  test('never shows safeguarding figures to staff, even if they arrive', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<InsightsHome org={org} role="staff" terms={terms} isMobile={false} attention={[]} />)
    await screen.findAllByText('Young People reached')
    expect(screen.queryByText('Concerns raised')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Safeguarding concerns raised' })).toBeNull()
    expect(screen.queryByText(/safeguarding concern/i)).toBeNull()
  })

  test('a chart can be read as a table', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<InsightsHome org={org} role="admin" terms={terms} isMobile={false} attention={[]} />)
    const card = await screen.findByRole('region', { name: 'Attendance rate' })
    fireEvent.click(within(card).getByRole('button', { name: 'Show as table' }))
    expect(within(card).getByText('Week of 7 Sep 2026')).toBeInTheDocument()
    expect(within(card).getByText('47%')).toBeInTheDocument()
  })

  test('filters narrow the request and the period drives the dates', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<InsightsHome org={org} role="admin" terms={terms} isMobile={false} attention={[]} />)
    fireEvent.click(await screen.findByRole('button', { name: /All groups/ }))
    fireEvent.click(screen.getByLabelText('Juniors'))
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 selected' }))
    await waitFor(() => expect(loadInsights).toHaveBeenLastCalledWith(expect.objectContaining({ groups: ['Juniors'], projects: [] })))
    fireEvent.click(screen.getByRole('radio', { name: /Last 12 months/ }))
    await waitFor(() => {
      const last = loadInsights.mock.calls[loadInsights.mock.calls.length - 1][0]
      expect(last.groups).toEqual(['Juniors'])
      expect(last.to > last.from).toBe(true)
    })
  })

  test('without the new aggregate, filters and the charts it cannot support are hidden', async () => {
    loadInsights.mockResolvedValue(fromLegacy({
      from: '2026-09-01', to: '2026-11-24',
      cur: { delivery: { delivered: 5, hours: 10, by_month: [{ label: 'Sep 2026', n: 5, hours: 10 }] }, attendance: { rate: 80, prev_rate: 70, marked: 20, by_month: [] }, young: { reached: 8 } },
      prev: {},
    }))
    render(<InsightsHome org={org} role="admin" terms={terms} isMobile={false} attention={[]} />)
    await screen.findAllByText('Young People reached')
    expect(screen.queryByRole('button', { name: /All projects/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Volunteer hours' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Young People reached' })).toBeNull()
  })

  test('an empty period says so and offers a longer one', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw({ current: { sessions_delivered: 0, reached: 0, marked: 0 }, series: [] })))
    render(<InsightsHome org={org} role="admin" terms={terms} isMobile={true} attention={[]} />)
    expect(await screen.findByText(/Nothing to show for last 90 days/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Look at the last 12 months' })).toBeInTheDocument()
  })

  test('a load failure can be retried', async () => {
    loadInsights.mockRejectedValueOnce(new Error('Network down')).mockResolvedValue(normalizeInsights(raw()))
    render(<InsightsHome org={org} role="admin" terms={terms} isMobile={false} attention={[]} />)
    expect(await screen.findByText('Network down')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Young People reached')).length).toBeGreaterThan(0)
  })
})

describe('ReportStudio', () => {
  test('staff are not offered the safeguarding summary', () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<ReportStudio org={org} role="staff" terms={terms} isMobile={false} initial={null} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Funder report/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Safeguarding summary/ })).toBeNull()
  })

  test('builds from a template, previews live and saves the definition', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    insertReportDefinition.mockResolvedValue({ id: 'saved-1' })
    const onSaved = jest.fn()
    render(<ReportStudio org={org} session={{ user: { id: 'u1' } }} role="admin" terms={terms} isMobile={false} initial={null} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: /Funder report/ }))

    const preview = document.getElementById('ls-doc-paper')
    expect(await within(preview).findByText('Headline figures')).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Funder report' })).toBeInTheDocument()
    await waitFor(() => expect(loadDocs).toHaveBeenCalledWith(['young_people', 'impact'], expect.any(Object)))

    fireEvent.change(screen.getByLabelText('Report title'), { target: { value: 'Lottery grant 2026' } })
    expect(within(preview).getByRole('heading', { name: 'Lottery grant 2026' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Key findings' }))
    expect(within(preview).queryByText('Key findings')).toBeNull()

    fireEvent.change(screen.getByLabelText('Introduction'), { target: { value: 'We had a good year.' } })
    expect(within(preview).getByText('We had a good year.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(insertReportDefinition).toHaveBeenCalled())
    const [orgId, userId, row] = insertReportDefinition.mock.calls[0]
    expect(orgId).toBe('org-1')
    expect(userId).toBe('u1')
    expect(row).toMatchObject({ name: 'Lottery grant 2026', report_type: 'funding' })
    expect(row.configuration.sections).not.toContain('facts')
    expect(row.configuration.text.narrative).toBe('We had a good year.')
    expect(await screen.findByText(/Saved to Your reports/)).toBeInTheDocument()
    expect(onSaved).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(updateReportDefinition).toHaveBeenCalledWith('saved-1', expect.objectContaining({ name: 'Lottery grant 2026' })))
  })

  test('sections can be reordered and added', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<ReportStudio org={org} role="admin" terms={terms} isMobile={false} initial={{ template: 'blank' }} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /By location/ }))
    fireEvent.click(screen.getByRole('button', { name: /Attendance over time/ }))
    const items = () => Array.from(document.querySelectorAll('#ls-studio-panel ol li')).map(li => li.textContent)
    expect(items()[2]).toMatch(/Attendance over time/)
    fireEvent.click(screen.getByRole('button', { name: 'Move Attendance over time up' }))
    expect(items()[1]).toMatch(/Attendance over time/)
    expect(await screen.findByText(/Changes compare with/)).toBeInTheDocument()
  })

  test('staff cannot add safeguarding sections and are told saving is not theirs when it is not', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<ReportStudio org={org} role="volunteer" terms={terms} isMobile={false} initial={{ template: 'board' }} onClose={() => {}} />)
    expect(await screen.findByText(/Changes compare with/)).toBeInTheDocument()
    expect(screen.queryByText('Safeguarding concerns raised')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  test('on a phone, build and preview are two tabs over one report', async () => {
    loadInsights.mockResolvedValue(normalizeInsights(raw()))
    render(<ReportStudio org={org} role="admin" terms={terms} isMobile={true} initial={{ template: 'termly' }} onClose={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Build' })).toHaveAttribute('aria-selected', 'true')
    expect(document.getElementById('ls-studio-preview')).toHaveStyle({ display: 'none' })
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    expect(document.getElementById('ls-studio-preview')).toHaveStyle({ display: 'block' })
    expect(document.getElementById('ls-studio-panel')).toHaveStyle({ display: 'none' })
    expect(await screen.findByText(/Changes compare with/)).toBeInTheDocument()
    expect(document.getElementById('ls-doc-print-root').parentElement).toBe(document.body)
  })
})
