import React from 'react'
import { render, screen } from '@testing-library/react'
import PastSessionRegister from './PastSessionRegister'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
jest.mock('../shared/SignedImg', () => () => null)
jest.mock('./AttendanceCorrectionModal', () => () => null)

const child = (id, first, extra = {}) => ({ id, first_name: first, last_name: 'Example', group_name: null, ...extra })
const session = { id: 's1', title: 'Thursday club', session_date: '2026-10-08', start_time: '10:00:00', end_time: '12:00:00', closed_at: '2026-10-08T12:05:00Z' }

function renderClosed(grouped) {
  const rows = [...grouped.expected, ...grouped.signed_in, ...grouped.absent, ...grouped.signed_out]
  render(<PastSessionRegister session={session} org={{ id: 'o1', name: 'Club' }} grouped={grouped} rows={rows} staffRows={[]} peopleProfiles={{}}
    notes={[]} auditLog={[]} userRole="staff" authUserId="u1" groupLabel={g => g || 'Ungrouped'} safeguardingCount={0}
    onClose={() => {}} onOpenNotes={() => {}} onOpenChild={() => {}} onReload={() => {}} />)
}

test('a closed register opens on the people who came, not an empty Expected tab', () => {
  renderClosed({ expected: [], signed_in: [{ child: child('a', 'Amara', { allergies: 'Nuts' }), att: { status: 'signed_in' } }], absent: [], signed_out: [] })
  expect(screen.getByText('Amara Example')).toBeInTheDocument()
  expect(screen.queryByText(/Nobody in this list/)).not.toBeInTheDocument()
})

test('it still opens on Expected when someone was never resolved', () => {
  renderClosed({ expected: [{ child: child('b', 'Ben'), att: null }], signed_in: [{ child: child('a', 'Amara'), att: { status: 'signed_in' } }], absent: [], signed_out: [] })
  expect(screen.getByText('Ben Example')).toBeInTheDocument()
  expect(screen.queryByText('Amara Example')).not.toBeInTheDocument()
})

test('someone never signed out shows as that, not as a second count of "Attended"', () => {
  renderClosed({
    expected: [],
    signed_in: [{ child: child('a', 'Amara', { allergies: 'Peanuts' }), att: { status: 'signed_in', signed_in_at: '2026-10-08T09:05:00Z' } }],
    absent: [],
    signed_out: [{ child: child('b', 'Ben'), att: { status: 'signed_out', signed_in_at: '2026-10-08T09:00:00Z', signed_out_at: '2026-10-08T11:00:00Z' } }],
  })
  expect(screen.getByRole('button', { name: /Not signed out 1/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Attended/ })).not.toBeInTheDocument()
  expect(screen.getByText(/^Signed in at .* · Not signed out$/)).toBeInTheDocument()
  // The allergy itself, not just that there is one.
  expect(screen.getByLabelText('Allergy: Peanuts')).toHaveTextContent('Peanuts')
})
