import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import RegisterWorkspace from './RegisterWorkspace'
import { registerView, ageOnDate, UNGROUPED } from './registerView'
import { getTerms } from '../../lib/terminology'

jest.mock('../shared/SignedImg', () => () => null)
const people = [
  { id: 'a', first_name: 'Alex', last_name: 'Example', group_name: 'Tigers', date_of_birth: '2014-10-06' },
  { id: 'b', first_name: 'Sam', last_name: 'Example', group_name: 'Teens', allergies: 'Pollen' },
  { id: 'c', first_name: 'River', last_name: 'Example', group_name: 'Old group', has_epipen: true },
]
const groups = [{ key: 't', label: 'Tigers', color: '#6245db' }, { key: 's', label: 'Teens', color: '#0f766e' }]
const session = { id: 's1', title: 'After-school club', start_time: '15:30', end_time: '18:00', opened_at: '2026-10-05T14:30:00Z' }
const secondSession = { id: 's2', title: 'Football', start_time: '16:00' }
const attendance = [
  { session_id: 's1', child_id: 'a', status: 'expected' },
  { session_id: 's1', child_id: 'b', status: 'signed_in' },
  { session_id: 's2', child_id: 'c', status: 'signed_in' },
]
const props = () => ({
  org: { id: 'o1', name: 'Example organisation', primary_color: '#6245db' }, terms: getTerms(), people, sessions: [session, secondSession], session, groups, attendance,
  selectedIds: new Set(), onClearSelection: jest.fn(), onSessionChange: jest.fn(), onSelectMode: jest.fn(), onToggleSelect: jest.fn(), onSelectVisible: jest.fn(), onAssign: jest.fn(), onPerson: jest.fn(), onOpenRegister: jest.fn(), onPlan: jest.fn(), onToday: jest.fn(), onAdd: jest.fn(), onImport: jest.fn(), onTemplates: jest.fn(), onGroups: jest.fn(), onMedical: jest.fn(), onPrint: jest.fn(), onHistory: jest.fn(), onArchive: jest.fn(),
})

test('roster and totals exclude people from other sessions and from the directory', () => {
  const result = registerView({ people, attendance, sessionId: 's1', groups })
  expect(result.visible.map(person => person.id)).toEqual(['a', 'b'])
  expect(result.counts).toMatchObject({ total: 2, signed_in: 1, expected: 1 })
  expect(registerView({ people, attendance, sessionId: 's3', groups }).counts.total).toBe(0)
})

test('trimmed search and case-insensitive groups work together', () => {
  const result = registerView({ people, attendance, sessionId: 's1', groups, search: '  ALEX  ', group: 'tigers' })
  expect(result.visible.map(person => person.id)).toEqual(['a'])
})

test('unconfigured groups are ungrouped and EpiPens count as care alerts', () => {
  const result = registerView({ people, attendance, sessionId: 's1', groups, directory: true, group: UNGROUPED, filter: 'alerts' })
  expect(result.visible.map(person => person.id)).toEqual(['c'])
  expect(result.alertCount).toBe(2)
})

test('age changes on the birthday in London', () => {
  expect(ageOnDate('2014-10-06', '2026-10-05')).toBe(11)
  expect(ageOnDate('2014-10-06', '2026-10-06')).toBe(12)
  expect(ageOnDate(null)).toBeNull()
})

test('on-site shortcut clears the group and search without changing the headcount', () => {
  render(<RegisterWorkspace {...props()} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by group' }), { target: { value: 'Tigers' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), { target: { value: 'Alex' } })
  fireEvent.click(screen.getByRole('button', { name: '1 currently on site' }))
  expect(screen.getByRole('textbox', { name: 'Search by name' })).toHaveValue('')
  expect(screen.getByRole('combobox', { name: 'Filter by group' })).toHaveValue('all')
  expect(screen.getByRole('button', { name: 'Open Sam Example' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Open Alex Example' })).not.toBeInTheDocument()
})

test('directory shows everyone; attendance opens the selected session route', () => {
  const callbacks = props()
  render(<RegisterWorkspace {...callbacks} />)
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Register views' })).getByRole('button', { name: /Everyone/ }))
  expect(screen.getByRole('button', { name: 'Open River Example' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Take attendance/ }))
  expect(callbacks.onOpenRegister).toHaveBeenCalledWith(session)
  fireEvent.change(screen.getByRole('combobox', { name: /Choose today's/ }), { target: { value: 's2' } })
  expect(callbacks.onSessionChange).toHaveBeenCalledWith('s2')
})

test('tools print only filtered people and allow access to the archive', () => {
  const callbacks = props()
  render(<RegisterWorkspace {...callbacks} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), { target: { value: 'Alex' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tools' }))
  fireEvent.click(screen.getByRole('button', { name: 'Print current view' }))
  expect(callbacks.onPrint).toHaveBeenCalledWith([people[0]], true)
  fireEvent.click(screen.getByRole('button', { name: 'Tools' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archived registers' }))
  expect(callbacks.onArchive).toHaveBeenCalled()
})

test('selection includes only shown people', () => {
  const callbacks = props()
  render(<RegisterWorkspace {...callbacks} selectMode />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), { target: { value: 'Sam' } })
  fireEvent.click(screen.getByRole('button', { name: 'Select shown' }))
  expect(callbacks.onSelectVisible).toHaveBeenCalledWith(['b'])
})

test('with no session the directory and planner remain usable', () => {
  const callbacks = props()
  render(<RegisterWorkspace {...callbacks} session={null} sessions={[]} />)
  expect(screen.queryByText('Not marked')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open River Example' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Open session planner/ }))
  expect(callbacks.onPlan).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Import register' }))
  expect(callbacks.onImport).toHaveBeenCalled()
})

test('a session with no attendance does not pretend the entire directory is expected', () => {
  render(<RegisterWorkspace {...props()} attendance={[]} />)
  expect(screen.getByText('Build this register')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '0 currently on site' })).toBeInTheDocument()
})


test('failed session fetch has a retry and never pretends there are no plans', () => {
  const onRetrySessions = jest.fn()
  render(<RegisterWorkspace {...props()} session={null} sessions={[]} sessionsError="Could not load plans" onRetrySessions={onRetrySessions} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load plans')
  expect(screen.queryByText(/No session scheduled/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry sessions' }))
  expect(onRetrySessions).toHaveBeenCalled()
})

test('filter changes clear the hidden bulk selection and delivery shortcuts navigate', () => {
  const callbacks = props()
  render(<RegisterWorkspace {...callbacks} />)
  fireEvent.click(screen.getByRole('button', { name: /Care alerts/ }))
  expect(callbacks.onClearSelection).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Today' }))
  expect(callbacks.onToday).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Sessions' }))
  expect(callbacks.onPlan).toHaveBeenCalled()
})
