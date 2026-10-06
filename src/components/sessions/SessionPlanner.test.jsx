import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { addDays, format, parseISO } from 'date-fns'
import SessionPlanner from './SessionPlanner'
import { supabase } from '../../lib/supabase'
import { londonDate } from '../../lib/sessionPhase'

jest.mock('../../lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn() },
  from: jest.fn(), storage: { from: jest.fn() }, rpc: jest.fn(),
} }))
jest.mock('../../hooks/useOrgSettings', () => ({ useOrgSettings: () => ({ groups: [], refetch: jest.fn() }) }))
jest.mock('../shared/SignedImg', () => () => null)

const org = { id: 'o1', name: 'Example organisation', slogan: 'Every child counts here', primary_color: '#6745db', secondary_color: '#137d68', logo_url: 'https://example.test/logo.png' }
const tomorrow = format(addDays(parseISO(londonDate()), 1), 'yyyy-MM-dd')

function serve(sessions) {
  supabase.from.mockImplementation(table => {
    const result = { data: table === 'sessions' ? sessions : [], error: null }
    const query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
    for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'not', 'is', 'single']) query[method] = jest.fn(() => query)
    return query
  })
}

beforeEach(() => { sessionStorage.clear() })

test('the page carries the organisation logo, name and strapline', async () => {
  serve([])
  const { container } = render(<SessionPlanner org={org} onNavigate={() => {}} />)
  expect(await screen.findByText('Example organisation')).toBeInTheDocument()
  expect(screen.getByText('Every child counts here')).toBeInTheDocument()
  expect(container.querySelector('img[src="https://example.test/logo.png"]')).not.toBeNull()
})

test('the banner names the next session when nothing is live', async () => {
  serve([{ id: 's1', org_id: 'o1', title: 'Football', session_date: tomorrow, start_time: '16:00:00', end_time: '18:00:00', status: 'scheduled' }])
  render(<SessionPlanner org={org} onNavigate={() => {}} />)
  expect(await screen.findByText('Tomorrow · 16:00')).toBeInTheDocument()
  expect(screen.getByText('Next session')).toBeInTheDocument()
})

test('the banner counts sessions that are running now', async () => {
  serve([{ id: 's1', org_id: 'o1', title: 'Drop-in', session_date: londonDate(), start_time: '00:00:00', end_time: '23:59:59', status: 'scheduled' }])
  render(<SessionPlanner org={org} onNavigate={() => {}} />)
  expect(await screen.findByText('1 session running')).toBeInTheDocument()
  expect(screen.getByText('Live now')).toBeInTheDocument()
})

test('delivery shortcuts lead to Registers and Today', async () => {
  serve([])
  const onNavigate = jest.fn()
  render(<SessionPlanner org={org} onNavigate={onNavigate} />)
  const shortcuts = await screen.findByRole('navigation', { name: 'Delivery shortcuts' })
  fireEvent.click(shortcuts.querySelector('button'))
  expect(onNavigate).toHaveBeenCalledWith('registers')
  fireEvent.click(screen.getByRole('button', { name: /Today/ }))
  expect(onNavigate).toHaveBeenCalledWith('today')
})

test('on a phone the shortcuts move into the options menu so the actions fit one row', async () => {
  const width = window.innerWidth
  window.innerWidth = 390
  try {
    serve([])
    const onNavigate = jest.fn()
    render(<SessionPlanner org={org} onNavigate={onNavigate} />)
    await screen.findByText('Example organisation')
    expect(screen.queryByRole('navigation', { name: 'Delivery shortcuts' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registers' }))
    expect(onNavigate).toHaveBeenCalledWith('registers')
  } finally {
    window.innerWidth = width
  }
})
