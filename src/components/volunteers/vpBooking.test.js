import { bookingState } from './vpBooking'

test('what the volunteer sees for each stage', () => {
  expect(bookingState(null, null)).toMatchObject({ state: 'none', button: 'Ask to help' })
  expect(bookingState(null, { status: 'requested' })).toMatchObject({ state: 'requested', button: 'Withdraw', label: 'Asked to help · waiting for the team' })
  expect(bookingState(null, { status: 'declined' })).toMatchObject({ state: 'declined', button: null })
  expect(bookingState({ id: 'b' }, { status: 'requested' })).toMatchObject({ state: 'booked', button: 'Cancel' })
  expect(bookingState({ id: 'b', signed_in_at: 'x' })).toMatchObject({ state: 'signed_in', button: null })
})
