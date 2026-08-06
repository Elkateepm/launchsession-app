// Shared building blocks for the Payments module (Overview, Charges, Transactions,
// Reconciliation, plus the Child Profile and Register integrations). Kept in one
// file so every surface speaks the same visual language.

export const PB = {
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  gradient: 'linear-gradient(135deg, #4F7DFF 0%, #2563EB 100%)',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  amber: '#B45309',
  amberBg: '#FEF3C7',
  red: '#DC2626',
  redBg: '#FEE2E2',
  grey: '#64748B',
  greyBg: '#F1F5F9',
  purple: '#7C3AED',
  purpleBg: '#EDE9FE',
}

export const CHARGE_TYPES = [
  { key: 'trip', label: 'Trip' },
  { key: 'session_fee', label: 'Session fee' },
  { key: 'membership', label: 'Membership' },
  { key: 'uniform', label: 'Uniform' },
  { key: 'transport', label: 'Transport' },
  { key: 'activity', label: 'Activity' },
  { key: 'custom', label: 'Custom' },
]

export const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'card', label: 'Card', icon: '💳' },
  { key: 'bank_transfer', label: 'Bank transfer', icon: '🏦' },
  { key: 'payment_link', label: 'Payment link', icon: '🔗' },
  { key: 'voucher', label: 'Voucher', icon: '🎟️' },
  { key: 'other', label: 'Other', icon: '📝' },
]

// computed_status comes from the payment_charge_balances view (unpaid | part_paid |
// paid | overdue | waived) -- 'refunded' is set directly on payment_charges.status
// when a charge's only payment gets fully refunded (handled by the UI, not the view).
export const STATUS_META = {
  paid:       { label: 'Paid',       color: PB.green,  bg: PB.greenBg },
  part_paid:  { label: 'Part paid',  color: PB.amber,  bg: PB.amberBg },
  unpaid:     { label: 'Unpaid',     color: PB.grey,   bg: PB.greyBg },
  overdue:    { label: 'Overdue',    color: PB.red,    bg: PB.redBg },
  waived:     { label: 'Waived',     color: PB.purple, bg: PB.purpleBg },
  refunded:   { label: 'Refunded',   color: PB.blue,   bg: '#DBEAFE' },
}

export function statusMeta(key) {
  return STATUS_META[key] || STATUS_META.unpaid
}

export function fmtMoney(n) {
  const v = Number(n) || 0
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function chargeTypeLabel(key) {
  return CHARGE_TYPES.find(t => t.key === key)?.label || 'Custom'
}

export function methodLabel(key) {
  return PAYMENT_METHODS.find(m => m.key === key)?.label || key
}

// Style object for a status pill -- consumed as <span style={chipStyle(status)}>.
export function chipStyle(status, size = 'md') {
  const meta = statusMeta(status)
  const pad = size === 'sm' ? '2px 8px' : '4px 11px'
  const fontSize = size === 'sm' ? 10.5 : 11.5
  return {
    display: 'inline-flex', alignItems: 'center', fontWeight: 800, borderRadius: 99,
    padding: pad, fontSize, color: meta.color, background: meta.bg, whiteSpace: 'nowrap',
  }
}

// Small card shell matching the rest of the app (white, rounded, soft border/shadow).
export function card(extra = {}) {
  return {
    background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18,
    boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(15,23,42,0.15)',
    ...extra,
  }
}

export const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#0F172A',
}

export function btnPrimary(color = PB.blue) {
  return {
    padding: '10px 18px', borderRadius: 10, border: 'none', background: color, color: '#fff',
    fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  }
}

export const btnGhost = {
  padding: '10px 18px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}

export function initials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
}

// Rolls up a list of payment_charge_balances rows into the four Overview summary numbers.
export function summarise(charges) {
  let due = 0, collected = 0, outstanding = 0, overdue = 0
  const childrenDue = new Set(), childrenOutstanding = new Set(), childrenOverdue = new Set()
  for (const c of charges) {
    due += Number(c.amount) || 0
    collected += Number(c.paid_amount) || 0
    if (c.computed_status !== 'waived') {
      outstanding += Number(c.remaining) || 0
      if (Number(c.remaining) > 0) childrenOutstanding.add(c.child_id)
    }
    if (c.computed_status === 'overdue') {
      overdue += Number(c.remaining) || 0
      childrenOverdue.add(c.child_id)
    }
    childrenDue.add(c.child_id)
  }
  return {
    due, collected, outstanding, overdue,
    dueChildren: childrenDue.size, outstandingChildren: childrenOutstanding.size, overdueChildren: childrenOverdue.size,
  }
}
