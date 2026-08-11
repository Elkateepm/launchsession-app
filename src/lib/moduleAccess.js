// Which modules an organisation can actually open.
//
// Three separate components were each deciding this from org.modules directly,
// which meant the answer could drift between the sidebar, the Hub and the
// Calendar. This is the single definition.
//
// The distinction that matters: org.modules is the SUGGESTED / purchased set,
// not the permitted set. Since organisation-type presets were introduced, a
// sports club no longer gets 'fundraising' by default -- but "not suggested for
// your type" is not the same as "you must pay for this", and treating the two
// the same put a £19.99 paywall in front of modules during a free trial that
// explicitly promises "full access to everything, free for 14 days".

// Every module key in the product. Kept here so the trial grant can't fall out
// of step with the nav when a module is added.
export const ALL_MODULE_KEYS = [
  'calendar', 'registers', 'planner', 'volunteers', 'messaging', 'gallery',
  'safeguarding', 'forms', 'case_management', 'risk_assessments', 'medical_alerts',
  'reports', 'impact_outcomes', 'fundraising',
  'hr', 'payments', 'resource_booking', 'events_trips',
  'parent_portal', 'mentoring',
]

// Always available regardless of plan -- you cannot run the product without
// being able to see a calendar, plan a session or record a risk assessment.
export const BASE_MODULE_KEYS = [
  'home', 'calendar', 'planner', 'events_trips', 'team', 'settings',
  'templates', 'risk_assessments',
]

/**
 * True while the organisation is inside an active free trial.
 * A null trial_expires_at is treated as still running: several existing orgs
 * have no expiry set, and locking them out because a column is empty would be
 * the wrong way to resolve that ambiguity.
 */
export function isTrialActive(org) {
  if (!org) return false
  if (org.plan !== 'trial') return false
  if (!org.trial_expires_at) return true
  const expiry = new Date(org.trial_expires_at)
  if (isNaN(expiry)) return true
  return expiry > new Date()
}

/**
 * The module keys this organisation may open right now.
 */
export function allowedModules(org) {
  if (isTrialActive(org)) return [...BASE_MODULE_KEYS, ...ALL_MODULE_KEYS]
  return [...BASE_MODULE_KEYS, ...(org?.modules || [])]
}

/**
 * hasModule(key) for a given org.
 */
export function makeHasModule(org) {
  const allowed = allowedModules(org)
  return (key) => allowed.includes(key)
}
