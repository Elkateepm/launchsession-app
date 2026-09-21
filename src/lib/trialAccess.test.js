import { trialDaysRemaining, isPlanEnded, allowedModules, ALL_MODULE_KEYS } from './moduleAccess'

const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString()

describe('trialDaysRemaining', () => {
  it('rounds part-days up, so the last afternoon still reads as a day left', () => {
    expect(trialDaysRemaining({ plan: 'trial', trial_expires_at: daysFromNow(0.2) })).toBe(1)
    expect(trialDaysRemaining({ plan: 'trial', trial_expires_at: daysFromNow(13.4) })).toBe(14)
  })

  it('never goes negative once the trial has passed', () => {
    expect(trialDaysRemaining({ plan: 'trial', trial_expires_at: daysFromNow(-9) })).toBe(0)
  })

  it('is null where the question does not apply', () => {
    expect(trialDaysRemaining(null)).toBeNull()
    expect(trialDaysRemaining({ plan: 'advanced', trial_expires_at: daysFromNow(3) })).toBeNull()
    // Open-ended trial: no countdown to show.
    expect(trialDaysRemaining({ plan: 'trial', trial_expires_at: null })).toBeNull()
    expect(trialDaysRemaining({ plan: 'trial', trial_expires_at: 'not a date' })).toBeNull()
  })
})

describe('isPlanEnded', () => {
  it('locks a trial that has run out', () => {
    expect(isPlanEnded({ plan: 'trial', trial_expires_at: daysFromNow(-1) })).toBe(true)
  })

  it('leaves a running trial alone', () => {
    expect(isPlanEnded({ plan: 'trial', trial_expires_at: daysFromNow(1) })).toBe(false)
  })

  // Mirrors org_write_locked(): several organisations predate the column, and
  // locking them out because a field is empty would be the wrong reading.
  it('treats a trial with no expiry as still running', () => {
    expect(isPlanEnded({ plan: 'trial', trial_expires_at: null })).toBe(false)
  })

  it('locks an expired plan and a dead subscription', () => {
    expect(isPlanEnded({ plan: 'expired' })).toBe(true)
    expect(isPlanEnded({ plan: 'advanced', subscription_status: 'canceled' })).toBe(true)
    expect(isPlanEnded({ plan: 'advanced', subscription_status: 'unpaid' })).toBe(true)
  })

  // Stripe retries a failed card for about two weeks. Going read-only on the
  // first failed charge would lock an organisation out mid-session over a card
  // that is about to go through.
  it('does not lock on past_due', () => {
    expect(isPlanEnded({ plan: 'advanced', subscription_status: 'past_due' })).toBe(false)
  })

  it('leaves a paying organisation alone, even past its old trial date', () => {
    expect(isPlanEnded({ plan: 'pro_plus', subscription_status: 'active', trial_expires_at: daysFromNow(-90) })).toBe(false)
  })

  it('is false for no org at all, rather than locking the app during load', () => {
    expect(isPlanEnded(null)).toBe(false)
    expect(isPlanEnded(undefined)).toBe(false)
  })
})

describe('allowedModules', () => {
  it('grants everything during a trial, whatever modules says', () => {
    const org = { plan: 'trial', trial_expires_at: daysFromNow(5), modules: ['calendar'] }
    ALL_MODULE_KEYS.forEach(key => expect(allowedModules(org)).toContain(key))
  })

  it('falls back to the purchased set once the trial is over', () => {
    const org = { plan: 'starter', modules: ['registers'] }
    expect(allowedModules(org)).toContain('registers')
    expect(allowedModules(org)).not.toContain('fundraising')
  })

  it('leaves an expired org with the base modules only', () => {
    const org = { plan: 'expired', modules: [] }
    expect(allowedModules(org)).not.toContain('fundraising')
    expect(allowedModules(org)).not.toContain('reports')
    // Read-only, but the shell still renders.
    expect(allowedModules(org)).toContain('calendar')
  })
})
