import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Hub, { SessionQuickActions } from './Hub'
import { supabase } from '../../lib/supabase'
import { useModuleAccess } from '../../context/ModuleAccessContext'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../lib/useRealtimeTable', () => ({ useRealtimeTable: () => {} }))
jest.mock('../../lib/storageUrl', () => ({ signRows: rows => Promise.resolve(rows), signedUrl: () => Promise.resolve('') }))
jest.mock('../../lib/hrAccess', () => ({ useHrAttention: () => ({ show: false }) }))
jest.mock('../../context/ModuleAccessContext', () => ({ useModuleAccess: jest.fn() }))
jest.mock('../../services/pushNotifications', () => ({ isPushSupported: () => false }))
jest.mock('../safeguarding/CauseForConcernForm', () => () => null)
jest.mock('../registers/LiveRegister', () => () => null)
jest.mock('../children/ChildrenDirectory', () => ({ InviteParentModal: () => null }))
jest.mock('../volunteers/AddVolunteersToSessionModal', () => () => null)
jest.mock('../shared/HistoricalAttendanceModal', () => () => null)
jest.mock('../incidents/ReportChips', () => () => null)

beforeEach(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  useModuleAccess.mockReturnValue({ levels: {} })
  supabase.from.mockImplementation(() => {
    const query = { then: resolve => Promise.resolve({ data: [], error: null }).then(resolve) }
    for (const method of ['select', 'eq', 'order', 'is', 'in', 'not', 'limit', 'gte', 'lte', 'single']) query[method] = () => query
    return query
  })
})

const org = { id: 'test-org', name: 'Community Club', modules: ['reports', 'registers'], primary_color: '#315B46' }

test('risk assessment picker escapes the card and has no session photo upload', async () => {
  const openCard = jest.fn()
  const { container } = render(<div onClick={openCard} style={{ overflow: 'hidden', transform: 'translateY(-2px)' }}>
    <SessionQuickActions session={{ id: 'session-1', title: 'Sports' }} org={org} orgId={org.id} />
  </div>)
  fireEvent.click(await screen.findByRole('button', { name: /Attach Risk Assessment/ }))
  const search = await screen.findByPlaceholderText('Search risk assessments…')
  expect(container).not.toContainElement(search)
  fireEvent.click(search)
  expect(openCard).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Add Photo/ })).not.toBeInTheDocument()
  expect(container.querySelector('input[type="file"]')).toBeNull()
})

test('Home renders one week-ahead list and routes its actions without the old filler banner', async () => {
  const onNavigate = jest.fn()
  render(<Hub org={org} userProfile={{ role: 'admin' }} onNavigate={onNavigate} />)
  await screen.findByRole('region', { name: 'Daily command centre' })
  expect(screen.getAllByText('Week ahead')).toHaveLength(1)
  expect(screen.queryByText(/Keep making an impact/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('View current and past registers →'))
  expect(onNavigate).toHaveBeenCalledWith('registers', undefined)
  fireEvent.click(screen.getByText('Calendar →'))
  expect(onNavigate).toHaveBeenCalledWith('calendar', undefined)
})

test('on day one Home leaves out the panels that would only show zeros', async () => {
  render(<Hub org={org} userProfile={{ role: 'admin' }} onNavigate={jest.fn()} />)
  await screen.findByRole('region', { name: 'Daily command centre' })
  expect(screen.queryByText('Impact snapshot · this month')).not.toBeInTheDocument()
  expect(screen.queryByText('What are we learning?')).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Today at a glance' })).not.toBeInTheDocument()
  // Nothing on today: the hero offers "Plan a session", so Quick actions does not repeat it.
  expect(screen.queryByRole('button', { name: /^New session$/ })).not.toBeInTheDocument()
  // And no "weather unavailable" card for a club that has not set a town.
  expect(screen.queryByText(/Weather unavailable/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Add your town in Settings/ })).toBeInTheDocument()
})

test('once sessions have run this month, impact and learning appear', async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
  const earlier = `${today.slice(0, 7)}-01` < today ? `${today.slice(0, 7)}-01` : today
  const delivered = { id: 'd1', org_id: org.id, title: 'Football', session_date: earlier, start_time: '10:00:00', end_time: '11:00:00', closed_at: `${earlier}T11:00:00Z`, status: 'completed' }
  supabase.from.mockImplementation(table => {
    const query = { then: resolve => Promise.resolve({ data: table === 'sessions' ? [delivered] : [], error: null }).then(resolve) }
    for (const method of ['select', 'eq', 'order', 'is', 'in', 'not', 'limit', 'gte', 'lte', 'single']) query[method] = () => query
    return query
  })
  render(<Hub org={org} userProfile={{ role: 'admin' }} onNavigate={jest.fn()} />)
  expect(await screen.findByText('Impact snapshot · this month')).toBeInTheDocument()
  expect(screen.getByText('What are we learning?')).toBeInTheDocument()
})

test('restricted staff do not see report widgets or creation shortcuts', async () => {
  useModuleAccess.mockReturnValue({ levels: { reports: 'none', planner: 'view', people: 'none', risk_assessments: 'view' } })
  render(<Hub org={org} userProfile={{ role: 'staff' }} />)
  await screen.findByRole('region', { name: 'Daily command centre' })
  expect(screen.queryByText('Impact snapshot · this month')).not.toBeInTheDocument()
  expect(screen.queryByText('What are we learning?')).not.toBeInTheDocument()
  expect(screen.queryByText(/New session/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Plan a session/i)).not.toBeInTheDocument()
})

function mockAttachment({ saved = false, error = null } = {}) {
  const assessment = { id: 'ra1', name: 'Day trip assessment', status: 'approved' }
  const insert = jest.fn()
  const select = jest.fn()
  supabase.from.mockImplementation(table => {
    let inserting = false
    const query = {
      then: resolve => Promise.resolve(inserting
        ? { data: null, error }
        : { data: table === 'risk_assessments' ? [assessment] : saved ? [{ risk_assessments: assessment }] : [], error: null }).then(resolve),
      insert: value => { inserting = true; insert(table, value); return query },
      select: value => { select(value); return query },
    }
    for (const method of ['eq', 'order', 'limit']) query[method] = () => query
    return query
  })
  return { insert, select }
}

test('existing attachment loads using the explicit organisation relationship', async () => {
  const { select } = mockAttachment({ saved: true })
  render(<SessionQuickActions session={{ id: 's1' }} orgId={org.id} />)
  expect(await screen.findByRole('button', { name: /Risk Assessment Attached/ })).toBeInTheDocument()
  expect(select).toHaveBeenCalledWith('risk_assessments!ras_assessment_org_fk(id, name, risk_rating, status)')
})

test('successful attachment updates the badge and closes the picker', async () => {
  const { insert } = mockAttachment()
  render(<SessionQuickActions session={{ id: 's1', title: 'Day trip' }} orgId={org.id} />)
  fireEvent.click(await screen.findByRole('button', { name: /Attach Risk Assessment/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Day trip assessment/ }))
  expect(await screen.findByRole('button', { name: /Risk Assessment Attached/ })).toBeInTheDocument()
  expect(screen.queryByPlaceholderText('Search risk assessments…')).not.toBeInTheDocument()
  expect(insert).toHaveBeenCalledWith('risk_assessment_sessions', { assessment_id: 'ra1', session_id: 's1', org_id: org.id })
})

test('failed attachment keeps the picker open and shows the save error', async () => {
  mockAttachment({ error: { message: 'Permission denied' } })
  render(<SessionQuickActions session={{ id: 's1' }} orgId={org.id} />)
  fireEvent.click(await screen.findByRole('button', { name: /Attach Risk Assessment/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Day trip assessment/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied')
  expect(screen.getByPlaceholderText('Search risk assessments…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Day trip assessment/ })).toBeEnabled()
})
