import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import RegisterSheet from './RegisterSheet'

const mockRows = {
  sessions: [{ id: 's1', title: 'Swimming Session' }],
  children: [{ id: 'c1', first_name: 'Ada' }],
  attendance: [{ session_id: 's1', child_id: 'c1', status: 'signed_in' }],
  session_reflections: [],
}
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: t => {
      const q = { select: () => q, eq: () => q, order: () => q,
        single: () => Promise.resolve({ data: mockRows[t][0], error: null }),
        then: (res, rej) => Promise.resolve({ data: mockRows[t] }).then(res, rej) }
      return q
    },
  },
}))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
// The real panel is Home's; here we only check what it is given.
jest.mock('../hub/Hub', () => ({
  ModalEdgeFade: () => null,
  LiveSessionPanel: ({ sessions, childList, getLiveSessionStats, onClosed }) => (
    <div>
      <div>panel for {sessions[0].title}, {childList.length} young people, {getLiveSessionStats(sessions[0]).signedIn} signed in</div>
      <button onClick={onClosed}>close register</button>
    </div>
  ),
}))

test('opens Home\'s register for the session, with its own data', async () => {
  const onClose = jest.fn()
  render(<RegisterSheet sessionId="s1" org={{ id: 'o1' }} authUserId="u1" userRole="staff" onClose={onClose} />)
  expect(screen.getByRole('status')).toHaveTextContent('Opening register')
  expect(await screen.findByText('panel for Swimming Session, 1 young people, 1 signed in')).toBeInTheDocument()
  fireEvent.click(screen.getByText('close register'))
  expect(onClose).toHaveBeenCalled()
})

test('Escape and the close button close it', async () => {
  const onClose = jest.fn()
  render(<RegisterSheet sessionId="s1" org={{ id: 'o1' }} onClose={onClose} />)
  await screen.findByText(/panel for/)
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Close register' }))
  expect(onClose).toHaveBeenCalledTimes(2)
})
