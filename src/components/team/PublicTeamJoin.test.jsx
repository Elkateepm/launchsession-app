import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PublicTeamJoin from './PublicTeamJoin'

const mockRpc = jest.fn()
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a) => mockRpc(...a) } }))

const code = '11111111-2222-3333-4444-555555555555'
beforeEach(() => {
  mockRpc.mockReset()
  mockRpc.mockImplementation((fn) => Promise.resolve(fn === 'get_team_join_page'
    ? { data: [{ org_name: 'Riverside', logo_url: null, primary_color: '#123456' }] }
    : { error: null }))
})

test('a turned-off or made-up link says so instead of showing a form', async () => {
  mockRpc.mockResolvedValueOnce({ data: [] })
  render(<PublicTeamJoin code={code} />)
  expect(await screen.findByText("This join link isn't working")).toBeInTheDocument()
})

test('a garbled code is not even looked up', async () => {
  render(<PublicTeamJoin code="not-a-code" />)
  expect(await screen.findByText("This join link isn't working")).toBeInTheDocument()
  expect(mockRpc).not.toHaveBeenCalled()
})

test('asks to join with the code, and says approval comes by email', async () => {
  render(<PublicTeamJoin code={code} />)
  fireEvent.change(await screen.findByLabelText('Your name *'), { target: { value: 'Jo Bloggs' } })
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'jo@example.com' } })
  fireEvent.click(screen.getByText('Ask to join'))
  await waitFor(() => expect(screen.getByText('Request sent')).toBeInTheDocument())
  expect(mockRpc).toHaveBeenCalledWith('submit_team_join_request', expect.objectContaining({ p_code: code, p_full_name: 'Jo Bloggs', p_email: 'jo@example.com' }))
})
