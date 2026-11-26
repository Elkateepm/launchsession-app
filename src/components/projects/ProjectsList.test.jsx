import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ProjectsList from './ProjectsList'

let rows = {}
const builder = table => {
  const q = { select: () => q, eq: () => q, in: () => q, order: () => q, then: (res, rej) => Promise.resolve({ data: rows[table] || [] }).then(res, rej) }
  return q
}
jest.mock('../../lib/supabase', () => ({ supabase: { from: t => builder(t), rpc: jest.fn() } }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
jest.mock('../../lib/today', () => ({ todayInLondon: () => '2026-11-26' }))
jest.mock('./ProjectWizard', () => ({ __esModule: true, default: ({ initialHoliday }) => <div role="dialog">wizard {initialHoliday || 'blank'}</div>, PROJECT_TYPES: [{ key: 'holiday_project', label: 'Holiday Project' }] }))

const org = { id: 'o1', name: 'Riverside', primary_color: '#0E7C86' }

test('with no projects, invites the first one and offers school holidays', async () => {
  rows = { projects: [] }
  render(<ProjectsList org={org} session={{}} onNavigate={jest.fn()} />)
  expect(await screen.findByText('Plan your first programme')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Christmas holidays 2026/ }))
  expect(screen.getByRole('dialog')).toHaveTextContent('wizard 2026-12-21')
})

test('spotlights the live project and groups the rest', async () => {
  rows = {
    projects: [
      { id: 'a', name: 'Autumn scheme', start_date: '2026-11-23', end_date: '2026-11-27', project_type: 'holiday_project' },
      { id: 'b', name: 'Christmas club', start_date: '2026-12-21', end_date: '2026-12-24' },
      { id: 'c', name: 'October half term', start_date: '2026-10-26', end_date: '2026-10-30' },
    ],
    sessions: [{ id: 's1', project_id: 'a', session_date: '2026-11-23', title: 'Day 1' }, { id: 's2', project_id: 'a', session_date: '2026-11-27', title: 'Day 5' }],
    attendance: [{ session_id: 's1', child_id: 'k1', status: 'signed_out' }],
  }
  const onNavigate = jest.fn()
  render(<ProjectsList org={org} session={{}} onNavigate={onNavigate} />)
  expect(await screen.findByRole('heading', { name: 'Autumn scheme' })).toBeInTheDocument()
  expect(screen.getByText('Happening now')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Coming up/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Finished/ })).toBeInTheDocument()
  expect(screen.getByText('Together so far')).toBeInTheDocument()
  // Christmas is covered by a project, so the nudge offers the next holiday.
  expect(screen.getByText(/February half term 2027 is coming up/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Open project/ }))
  expect(onNavigate).toHaveBeenCalledWith('projects', { projectId: 'a' })
})
