// Where a volunteer stands on one session, and what their button does.
// Booking is now a request that the team accepts (session_volunteer_requests);
// once accepted they are on the team (session_staff) as before.

export function bookingState(booking, request) {
  if (booking?.signed_in_at) return { state: 'signed_in', label: 'You are signed in', button: null }
  if (booking) return { state: 'booked', label: 'You are on the team', button: 'Cancel', detailButton: 'Cancel my place' }
  if (request?.status === 'requested') return { state: 'requested', label: 'Asked to help · waiting for the team', button: 'Withdraw', detailButton: 'Withdraw my request' }
  if (request?.status === 'declined') return { state: 'declined', label: 'Not needed this time', button: null }
  return { state: 'none', label: null, button: 'Ask to help', detailButton: 'Ask to help at this session' }
}
