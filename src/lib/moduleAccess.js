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

// ─────────────────────────────────────────────────────────────────────────
// Per-member access levels
//
// Layer three, beneath the organisation's purchased modules (above) and the
// role checks. The authoritative resolution lives in the database function
// module_access(), which the RLS policies consult; the client reads the same
// answer through the my_module_access() RPC rather than recomputing it, so the
// nav cannot disagree with what the policies will actually allow.
// ─────────────────────────────────────────────────────────────────────────

export const LEVELS = { NONE: 'none', VIEW: 'view', EDIT: 'edit' }

export function levelRank(level) {
  if (level === 'edit') return 2
  if (level === 'view') return 1
  return 0
}

// Modules that can be granted per member, in the order the Access screens
// list them. `people` and `planner` cover the core records that have no
// purchasable module of their own but still need to be restrictable.
export const ACCESS_MODULES = [
  { key: 'people', label: 'Young People', icon: '👧', hint: 'The directory — browsing, adding and editing' },
  { key: 'planner', label: 'Sessions & Projects', icon: '🚀', hint: 'Planning, notes, reflections and participants' },
  { key: 'registers', label: 'Registers', icon: '✅', hint: 'Attendance and corrections' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'safeguarding', label: 'Safeguarding', icon: '🛡', hint: 'Concerns and safeguarding documents' },
  { key: 'case_management', label: 'Case Management', icon: '📁' },
  { key: 'risk_assessments', label: 'Risk Assessments', icon: '⚠️' },
  { key: 'medical_alerts', label: 'Medical Alerts', icon: '💊' },
  { key: 'forms', label: 'Forms', icon: '📝' },
  { key: 'volunteers', label: 'Volunteers', icon: '❤️' },
  { key: 'messaging', label: 'Messaging', icon: '💬', hint: 'Threads, announcements and SMS' },
  { key: 'gallery', label: 'Gallery', icon: '🖼' },
  { key: 'reports', label: 'Reports', icon: '📈' },
  { key: 'impact_outcomes', label: 'Impact & Outcomes', icon: '🌱' },
  { key: 'fundraising', label: 'Fundraising', icon: '💷', hint: 'Campaigns, donations and grants' },
  { key: 'payments', label: 'Payments', icon: '💳' },
  { key: 'resource_booking', label: 'Resource Booking', icon: '🗓' },
  { key: 'events_trips', label: 'Events & Trips', icon: '✈️' },
  { key: 'mentoring', label: 'Mentoring', icon: '🤝' },
]

// Roles whose access can be templated.
//
// Owner and admin are absent because they always resolve to 'edit' -- making
// administrators restrictable means one bad save locks an organisation out of
// the screen that would undo it.
//
// Volunteers and parents are absent because they never reach the dashboard:
// both are routed to their own portals, so a module grant against one would be
// a control that looks like it does something and does not. The database
// refuses rows for these roles outright rather than storing that lie.
export const TEMPLATABLE_ROLES = [
  { key: 'manager', label: 'Managers' },
  { key: 'staff', label: 'Staff' },
]

// Roles this layer deliberately does not govern, and why -- shown in place of
// the editor rather than presenting controls that would be refused on save.
export const UNGOVERNED_ROLES = {
  owner: 'Owners can reach every module. To restrict this person, change their account role to Staff first.',
  admin: 'Administrators can reach every module. To restrict this person, change their account role to Staff first.',
  volunteer: 'Volunteers use the volunteer portal, not the dashboard, so module access does not apply to them.',
  parent: 'Parents use the parent portal, not the dashboard, so module access does not apply to them.',
}

export const LEVEL_OPTIONS = [
  { key: 'none', label: 'No access', desc: 'Hidden from the menu and blocked in the database' },
  { key: 'view', label: 'View only', desc: 'Can open and read, cannot add, change or delete' },
  { key: 'edit', label: 'Full access', desc: 'Can read and make changes' },
]

/**
 * Combines all three layers into the single question a component asks:
 * what can this person do with this module, right now?
 *
 * A module the organisation has not enabled is 'none' regardless of any grant
 * -- a grant narrows, it never buys.
 */
export function makeModuleLevel(org, levels) {
  const allowed = allowedModules(org)
  return (key) => {
    // Base modules are always org-allowed; `people` and `planner` are among
    // them, so a grant is the only thing that can restrict those.
    if (!allowed.includes(key) && ALL_MODULE_KEYS.includes(key)) return 'none'
    return (levels && levels[key]) || 'edit'
  }
}
