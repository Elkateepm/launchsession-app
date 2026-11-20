// The server-side half of the charity discount: what happens to an existing
// Stripe subscription when LaunchSession verifies a charity number.
import { applyCharityDiscount } from '../../api/send-form-email'

const verified = { id: 'o1', charity_number: 'SC054561', charity_status: 'verified', stripe_subscription_id: 'sub_1' }

function fakeStripe(subscription, { couponExists = true } = {}) {
  return {
    subscriptions: {
      retrieve: jest.fn(async () => {
        if (!subscription) { const e = new Error('No such subscription'); e.code = 'resource_missing'; throw e }
        return subscription
      }),
      update: jest.fn(async (id, params) => ({ id, ...params })),
    },
    coupons: {
      retrieve: jest.fn(async id => { if (!couponExists) { const e = new Error('missing'); e.code = 'resource_missing'; throw e } return { id } }),
      create: jest.fn(async params => ({ id: params.id })),
    },
  }
}

test('puts the 20% coupon on a live subscription that has no discount', async () => {
  const stripe = fakeStripe({ id: 'sub_1', status: 'active', discounts: [] })
  expect(await applyCharityDiscount({ stripe, org: verified })).toEqual({ applied: true, reason: 'applied', subscription: 'sub_1' })
  expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { discounts: [{ coupon: 'launchsession-registered-charity-20' }] })
})

test('makes the coupon the first time it is needed, with the same terms as checkout', async () => {
  const stripe = fakeStripe({ id: 'sub_1', status: 'trialing', discounts: [] }, { couponExists: false })
  await applyCharityDiscount({ stripe, org: verified })
  expect(stripe.coupons.create).toHaveBeenCalledWith({ id: 'launchsession-registered-charity-20', percent_off: 20, duration: 'forever', name: 'Registered charity (20% off)' })
})

test('leaves a subscription that already has the charity coupon alone', async () => {
  const stripe = fakeStripe({ id: 'sub_1', status: 'active', discounts: [{ coupon: { id: 'launchsession-registered-charity-20' } }] })
  expect((await applyCharityDiscount({ stripe, org: verified })).reason).toBe('already_applied')
  expect(stripe.subscriptions.update).not.toHaveBeenCalled()
})

test('does not stack on top of another discount', async () => {
  const stripe = fakeStripe({ id: 'sub_1', status: 'active', discounts: [{ coupon: { id: 'FOUNDING50' } }] })
  expect((await applyCharityDiscount({ stripe, org: verified })).reason).toBe('other_discount')
  expect(stripe.subscriptions.update).not.toHaveBeenCalled()
})

test('no subscription yet: nothing to change, checkout will apply it', async () => {
  const stripe = fakeStripe(null)
  expect((await applyCharityDiscount({ stripe, org: { ...verified, stripe_subscription_id: null } })).reason).toBe('no_subscription')
  expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
})

test.each([
  [{ ...verified, charity_status: 'rejected' }, 'not_eligible'],
  [{ ...verified, charity_number: null }, 'not_eligible'],
])('never discounts an organisation that is not a charity: %j', async (org, reason) => {
  const stripe = fakeStripe({ id: 'sub_1', status: 'active', discounts: [] })
  expect((await applyCharityDiscount({ stripe, org })).reason).toBe(reason)
  expect(stripe.subscriptions.update).not.toHaveBeenCalled()
})

test('ended or missing subscriptions are skipped', async () => {
  expect((await applyCharityDiscount({ stripe: fakeStripe({ id: 'sub_1', status: 'canceled', discounts: [] }), org: verified })).reason).toBe('subscription_ended')
  expect((await applyCharityDiscount({ stripe: fakeStripe(null), org: verified })).reason).toBe('subscription_missing')
})
