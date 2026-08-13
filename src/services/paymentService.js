// Payment abstraction layer.
//
// THE RULE: no fundraising component imports Stripe, or any other provider,
// directly. Everything goes through the functions in this file. When a provider
// is connected later, only src/services/providers/* changes -- campaign cards,
// the donation page and the settings screen do not.
//
// Right now there is exactly one provider implementation and it is `none`: it
// answers honestly that payments are unavailable rather than throwing or
// pretending. That keeps the UI on the real code path from day one, so
// connecting Stripe later exercises plumbing that has already been running,
// rather than switching on a branch nobody has ever executed.

import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------- statuses

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  // Manual entries only. There is no provider to confirm them, so they are
  // final on creation -- they never move through pending/processing.
  RECORDED: 'recorded',
}

// The statuses that represent money the organisation actually has. Kept here
// and mirrored by recalc_campaign_raised() in the database so a total is the
// same number whether it was computed in SQL or in the browser.
export const COUNTED_STATUSES = [
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.RECORDED,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
]

export function countsTowardsTotal(status) {
  return COUNTED_STATUSES.includes(status)
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
]

export function statusLabel(status) {
  switch (status) {
    case PAYMENT_STATUS.PAID: return 'Paid'
    case PAYMENT_STATUS.RECORDED: return 'Recorded'
    case PAYMENT_STATUS.PENDING: return 'Pending'
    case PAYMENT_STATUS.PROCESSING: return 'Processing'
    case PAYMENT_STATUS.FAILED: return 'Failed'
    case PAYMENT_STATUS.CANCELLED: return 'Cancelled'
    case PAYMENT_STATUS.REFUNDED: return 'Refunded'
    case PAYMENT_STATUS.PARTIALLY_REFUNDED: return 'Part refunded'
    default: return 'Unknown'
  }
}

// ---------------------------------------------------------------- provider

const NULL_PROVIDER = {
  id: 'none',
  label: 'No provider connected',
  supportsCheckout: false,
  supportsRefunds: false,

  async createPayment() {
    return { ok: false, reason: 'no_provider', message: 'Online payments are not set up yet.' }
  },
  async createPaymentLink() {
    // The link row itself is still created -- see createPaymentLink below. What
    // the provider can't do is give it a working checkout, so it stays in
    // 'setup_required' and the public page shows the coming-soon state.
    return { ok: false, reason: 'no_provider', message: 'Connect a payment provider to take online donations.' }
  },
  async getPaymentStatus() {
    return { ok: false, reason: 'no_provider' }
  },
  async refundPayment() {
    return { ok: false, reason: 'no_provider', message: 'Refunds need a connected payment provider.' }
  },
  async startOnboarding() {
    return { ok: false, reason: 'coming_soon', message: 'Online payment setup is coming soon.' }
  },
}

// Resolved per org from organisation_payment_accounts. Cached briefly because
// several cards on the overview ask the same question on one render.
let providerCache = { orgId: null, at: 0, value: null }
const PROVIDER_TTL_MS = 30 * 1000

export async function getPaymentProvider(orgId) {
  if (!orgId) return NULL_PROVIDER
  const fresh = providerCache.orgId === orgId && (Date.now() - providerCache.at) < PROVIDER_TTL_MS
  if (fresh && providerCache.value) return providerCache.value

  let provider = NULL_PROVIDER
  try {
    const { data } = await supabase
      .from('organisation_payment_accounts')
      .select('provider, status, payments_enabled, provider_account_id')
      .eq('org_id', orgId)
      .maybeSingle()

    // payments_enabled is checked as well as status: Stripe can report an
    // account as connected while still withholding charging capability during
    // review, and treating that as live would show donors a checkout that fails.
    if (data?.provider === 'stripe' && data.status === 'connected' && data.payments_enabled) {
      // const { stripeProvider } = await import('./providers/stripe')
      // provider = stripeProvider(data)
      provider = NULL_PROVIDER
    }
  } catch (e) {
    provider = NULL_PROVIDER
  }

  providerCache = { orgId, at: Date.now(), value: provider }
  return provider
}

export function clearProviderCache() {
  providerCache = { orgId: null, at: 0, value: null }
}

export async function getPaymentAccount(orgId) {
  if (!orgId) return null
  const { data } = await supabase
    .from('organisation_payment_accounts')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  return data || null
}

export async function paymentsEnabled(orgId) {
  const p = await getPaymentProvider(orgId)
  return p.supportsCheckout
}

// ------------------------------------------------------------------ actions

export async function createPayment({ orgId, campaignId, amount, supporter, giftAid, anonymous }) {
  const provider = await getPaymentProvider(orgId)
  if (!provider.supportsCheckout) {
    return { ok: false, reason: 'no_provider', message: 'Online payments are not set up yet.' }
  }
  return provider.createPayment({ orgId, campaignId, amount, supporter, giftAid, anonymous })
}

export async function getPaymentStatus({ orgId, providerPaymentId }) {
  const provider = await getPaymentProvider(orgId)
  return provider.getPaymentStatus({ providerPaymentId })
}

/**
 * Refunds are deliberately not implemented against the ledger here. A refund
 * has to originate at the provider and come back through a webhook -- writing
 * `refunded` locally first would leave the ledger claiming money was returned
 * that the provider never sent.
 */
export async function refundPayment({ orgId, donationId, amount }) {
  const provider = await getPaymentProvider(orgId)
  if (!provider.supportsRefunds) {
    return { ok: false, reason: 'no_provider', message: 'Refunds need a connected payment provider.' }
  }
  return provider.refundPayment({ donationId, amount })
}

export async function startPaymentOnboarding(orgId) {
  const provider = await getPaymentProvider(orgId)
  return provider.startOnboarding({ orgId })
}

// -------------------------------------------------------------- pay links

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function publicPayUrl(slug) {
  const base = typeof window !== 'undefined' && window.location.hostname.includes('localhost')
    ? window.location.origin
    : 'https://launchsession.co.uk'
  return `${base}/pay/${slug}`
}

/**
 * Creates the link record regardless of provider. The URL, QR code and public
 * page are useful to an organisation before checkout works -- they can put the
 * page in front of supporters and see the campaign -- so the row is real and
 * only its status reflects that payment isn't plumbed in yet.
 */
export async function createPaymentLink({ orgId, campaignId, campaignName, suggestedAmounts, allowCustomAmount }) {
  const base = slugify(campaignName) || 'donate'

  // Slugs are globally unique because they sit in a public URL, so a collision
  // with another organisation's campaign is possible and must be resolved
  // rather than surfaced as a database error.
  let slug = base
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: taken } = await supabase
      .from('fundraising_payment_links')
      .select('id')
      .ilike('slug', slug)
      .maybeSingle()
    if (!taken) break
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data, error } = await supabase
    .from('fundraising_payment_links')
    .insert({
      org_id: orgId,
      campaign_id: campaignId,
      slug,
      status: 'setup_required',
      suggested_amounts: suggestedAmounts || [10, 25, 50, 100],
      allow_custom_amount: allowCustomAmount !== false,
    })
    .select()
    .single()

  if (error) return { ok: false, message: error.message }

  const provider = await getPaymentProvider(orgId)
  if (provider.supportsCheckout) {
    const hosted = await provider.createPaymentLink({ orgId, campaignId, slug })
    if (hosted.ok) {
      await supabase.from('fundraising_payment_links').update({ status: 'active' }).eq('id', data.id)
      return { ok: true, link: { ...data, status: 'active' } }
    }
  }

  return { ok: true, link: data }
}
