// Registered charities get 20% off every plan (added 23 Oct 2026).
//
// The claim is a charity number on the organisation. It applies at checkout
// as soon as it is claimed, because asking a charity to wait for a manual
// check before it can pay would be friction for the honest majority, and the
// number is on a public register that LaunchSession checks afterwards. Only
// LaunchSession can mark a claim verified or rejected -- see
// guard_organisation_entitlements() in 20261023_charity_discount.sql.
// api/create-checkout-session.js applies the same 20% as a Stripe coupon; if
// you change the percentage, change it there too.

export const CHARITY_DISCOUNT_PERCENT = 20

// The three UK regulators. The number formats are what each register prints:
// England & Wales 6 or 7 digits (a linked charity adds "-1"), Scotland "SC"
// and 6 digits, Northern Ireland "NIC" and 6 digits.
export const REGULATORS = [
  { key: 'ccew', label: 'England & Wales (Charity Commission)', name: 'Charity Commission for England and Wales', example: '1123456', pattern: /^\d{6,7}(-\d{1,2})?$/ },
  { key: 'oscr', label: 'Scotland (OSCR)', name: 'Scottish Charity Regulator (OSCR)', example: 'SC012345', pattern: /^SC\d{6}$/ },
  { key: 'ccni', label: 'Northern Ireland (CCNI)', name: 'Charity Commission for Northern Ireland', example: 'NIC100002', pattern: /^NIC\d{6}$/ },
]

export const regulatorFor = key => REGULATORS.find(r => r.key === key) || null

// Spaces and case are how people type it, not part of the number. A Northern
// Ireland number is often written without its "NIC" prefix.
export function normaliseCharityNumber(raw, regulator) {
  const s = String(raw || '').toUpperCase().replace(/\s+/g, '')
  if (regulator === 'ccni' && /^\d{6}$/.test(s)) return 'NIC' + s
  return s
}

// The regulator a number most likely belongs to, so typing "SC012345" with
// England & Wales still selected corrects itself.
export function guessRegulator(raw) {
  const s = String(raw || '').toUpperCase().replace(/\s+/g, '')
  if (s.startsWith('SC')) return 'oscr'
  if (s.startsWith('NIC')) return 'ccni'
  return null
}

export function charityNumberError(raw, regulator) {
  const reg = regulatorFor(regulator)
  if (!reg) return 'Choose where your charity is registered.'
  const n = normaliseCharityNumber(raw, regulator)
  if (!n) return 'Enter your registered charity number.'
  if (!reg.pattern.test(n)) return `That doesn't look right for the ${reg.name} — numbers there look like ${reg.example}.`
  return ''
}

// Claimed or verified both count: a claim is honoured while it is checked.
export const hasCharityDiscount = org =>
  !!org?.charity_number && ['claimed', 'verified'].includes(org?.charity_status)

// Stripe takes the percentage off the invoice and rounds to the penny, so
// £49.99 becomes £39.99 and £59.99 becomes £47.99.
export const discountedPence = pence =>
  pence == null ? pence : Math.round(pence * (100 - CHARITY_DISCOUNT_PERCENT) / 100)
