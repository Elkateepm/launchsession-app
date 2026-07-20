// Shared constants and helpers for the Resource Centre.

export const CATEGORIES = [
  { key: 'room', label: 'Room', icon: '🏛️' },
  { key: 'vehicle', label: 'Vehicle', icon: '🚐' },
  { key: 'equipment', label: 'Equipment', icon: '📦' },
  { key: 'technology', label: 'Technology', icon: '💻' },
  { key: 'sports_equipment', label: 'Sports Equipment', icon: '⚽' },
  { key: 'venue', label: 'Venue', icon: '📍' },
  { key: 'other', label: 'Other', icon: '🔧' },
]

export function categoryMeta(key) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1]
}

export const STATUS_CONFIG = {
  available: { label: 'Available', color: '#16A34A', bg: '#F0FDF4', icon: '✓' },
  booked: { label: 'Booked', color: '#2563EB', bg: '#EFF6FF', icon: '📅' },
  partially_available: { label: 'Partially Available', color: '#D97706', bg: '#FFFBEB', icon: '◐' },
  checked_out: { label: 'Checked Out', color: '#7C3AED', bg: '#F5F3FF', icon: '↗' },
  low_stock: { label: 'Low Stock', color: '#D97706', bg: '#FFFBEB', icon: '⚠' },
  maintenance: { label: 'Maintenance', color: '#DC2626', bg: '#FEF2F2', icon: '🔧' },
  unavailable: { label: 'Unavailable', color: '#6B7280', bg: '#F9FAFB', icon: '✕' },
  overdue: { label: 'Overdue', color: '#DC2626', bg: '#FEF2F2', icon: '⏰' },
}

export function statusMeta(key) {
  return STATUS_CONFIG[key] || STATUS_CONFIG.unavailable
}

export const BOOKING_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#D97706', bg: '#FFFBEB' },
  confirmed: { label: 'Confirmed', color: '#16A34A', bg: '#F0FDF4' },
  declined: { label: 'Declined', color: '#DC2626', bg: '#FEF2F2' },
  changes_requested: { label: 'Changes Requested', color: '#D97706', bg: '#FFFBEB' },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: '#F9FAFB' },
  completed: { label: 'Completed', color: '#2563EB', bg: '#EFF6FF' },
}

export function fmtDate(d) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
export function fmtTime(d) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
}
export function fmtDateTimeLocal(d) {
  // For datetime-local input values
  const date = typeof d === 'string' ? new Date(d) : d
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Client-side pre-check so the UI can warn before hitting the DB's
// exclusion constraint (which is the real, authoritative guard).
export function findConflict(bookings, resourceId, startISO, endISO, excludeBookingId) {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()
  return bookings.find(b => {
    if (b.id === excludeBookingId) return false
    if (b.resource_id !== resourceId) return false
    if (!['pending', 'confirmed'].includes(b.status)) return false
    const bStart = new Date(b.start_time).getTime()
    const bEnd = new Date(b.end_time).getTime()
    return start < bEnd && end > bStart
  })
}

export function suggestNextSlot(bookings, resourceId, durationMs, afterISO) {
  const relevant = bookings
    .filter(b => b.resource_id === resourceId && ['pending', 'confirmed'].includes(b.status))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  let candidate = new Date(afterISO).getTime()
  for (const b of relevant) {
    const bStart = new Date(b.start_time).getTime()
    const bEnd = new Date(b.end_time).getTime()
    if (candidate + durationMs <= bStart) break
    if (candidate < bEnd) candidate = bEnd
  }
  return new Date(candidate)
}
