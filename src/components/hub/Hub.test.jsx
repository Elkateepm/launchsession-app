import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Hub from './Hub'
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

test('Home renders one week-ahead list and routes its actions without the old filler banner', async () => {
  const onNavigate = jest.fn()
  render(<Hub org={org} userProfile={{ role: 'admin' }} onNavigate={onNavigate} />)
  await screen.findByRole('region', { name: 'Daily command centre' })
  expect(screen.getAllByText('Week ahead')).toHaveLength(1)
  expect(screen.getByText('Impact snapshot · this month')).toBeInTheDocument()
  expect(screen.queryByText(/Keep making an impact/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('View current and past registers →'))
  expect(onNavigate).toHaveBeenCalledWith('registers', undefined)
  fireEvent.click(screen.getAllByText('Explore reports →')[0])
  expect(onNavigate).toHaveBeenCalledWith('reports', undefined)
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
