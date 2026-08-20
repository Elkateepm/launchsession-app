// Single definition of the sidebar's structure.
//
// The nav was previously ten blocks of near-identical JSX inside Dashboard.jsx,
// which is why the groupings had drifted: Young People sat under Delivery,
// Risk Assessments under Safeguarding, Volunteers away from Staff. Describing
// the nav as data makes a regrouping a one-line change instead of a refactor.
//
// `tab` values are unchanged from the previous sidebar. Existing deep links
// (?tab=children and so on) must keep working, so nothing here renames a tab —
// only where it appears.

export const NAV_SECTIONS = [
  {
    id: 'delivery',
    label: 'Delivery',
    items: [
      { id: 'calendar', label: 'Calendar', icon: '📅', tab: 'calendar', moduleKey: 'calendar' },
      { id: 'planner', label: 'Sessions', icon: '🚀', tab: 'planner', moduleKey: 'planner' },
      { id: 'projects', label: 'Projects', icon: '🗂', tab: 'projects_list', matchTabs: ['projects_list', 'projects'], accessKey: 'planner' },
      { id: 'registers', label: 'Registers', icon: '✅', tab: 'registers', moduleKey: 'registers' },
      // Rendered by Dashboard but absent from the old sidebar, so it was only
      // reachable by deep link. Module-gated, so it appears only where enabled.
      { id: 'mentoring', label: 'Mentoring', icon: '🤝', tab: 'mentoring', moduleKey: 'mentoring' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      // Label comes from the org's own terminology (People / Young People /
      // Members / Players), resolved at render.
      { id: 'children', label: null, termKey: 'People', icon: '👧', tab: 'children', accessKey: 'people' },
      // Staff are managed in HR (Operations). Volunteers stay separate: they
      // are a different relationship with different records, and merging them
      // would recreate the ambiguity this consolidation removed.
      { id: 'volunteers', label: 'Volunteers', icon: '❤️', tab: 'volunteers', moduleKey: 'volunteers' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    items: [
      { id: 'safeguarding', label: 'Safeguarding', icon: '🛡', tab: 'safeguarding', moduleKey: 'safeguarding' },
      { id: 'risk_assessments', label: 'Risk Assessments', icon: '⚠️', tab: 'risk_assessments', moduleKey: 'risk_assessments' },
      { id: 'case_management', label: 'Case Management', icon: '📁', tab: 'case_management', moduleKey: 'case_management' },
      { id: 'forms', label: 'Forms', icon: '📝', tab: 'forms', moduleKey: 'forms', badgeKey: 'forms' },
      { id: 'medical_alerts', label: 'Medical Alerts', icon: '💊', tab: 'medical_alerts', moduleKey: 'medical_alerts' },
    ],
  },
]

// Collapsed by default. These are things staff consult occasionally rather than
// work in daily, and keeping them shut is most of what shortens the sidebar.
export const NAV_GROUPS = [
  {
    id: 'insights',
    label: 'Insights',
    icon: '📊',
    items: [
      { id: 'reports', label: 'Reports', icon: '📈', tab: 'reports', moduleKey: 'reports' },
      { id: 'impact_outcomes', label: 'Impact & Outcomes', icon: '🌱', tab: 'impact_outcomes', moduleKey: 'impact_outcomes' },
      { id: 'fundraising', label: 'Fundraising', icon: '💷', tab: 'fundraising', moduleKey: 'fundraising' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: '🧰',
    items: [
      { id: 'payments', label: 'Payments', icon: '💳', tab: 'payments', moduleKey: 'payments' },
      { id: 'resource_booking', label: 'Resource Booking', icon: '🗓', tab: 'resource_booking', moduleKey: 'resource_booking' },
      { id: 'events_trips', label: 'Events & Trips', icon: '✈️', tab: 'events_trips', moduleKey: 'events_trips' },
      { id: 'messaging', label: 'Messaging', icon: '💬', tab: 'messaging', moduleKey: 'messaging' },
      { id: 'gallery', label: 'Gallery', icon: '🖼', tab: 'gallery', moduleKey: 'gallery' },
      // Not module-gated: staff management absorbed the old Staff & Volunteers
      // page, which was always available. Compliance and leave inside HR are
      // still gated on the module.
      { id: 'hr', label: 'HR', icon: '🧑‍💼', tab: 'hr', adminOnly: true },
      { id: 'parent_portal', label: 'Parent Portal', icon: '👨‍👩‍👧', tab: 'parent_portal', moduleKey: 'parent_portal' },
      { id: 'templates', label: 'Templates', icon: '📄', tab: 'templates', adminOnly: true },
    ],
  },
]

// Reached through the Organisation item rather than sitting permanently in the
// nav. The routes are untouched; only their entry point moved.
export const ORG_ITEMS = [
  { id: 'settings', label: 'Settings', icon: '⚙️', tab: 'settings', adminOnly: true },
  { id: 'branding', label: 'Branding', icon: '🎨', tab: 'branding', adminOnly: true },
]

// Actions offered by the Create button. Each points at an existing flow --
// nothing here builds a second way to create anything.
export const CREATE_ACTIONS = [
  { id: 'session', label: 'New Session', icon: '🚀', tab: 'planner', moduleKey: 'planner', intent: 'create' },
  { id: 'project', label: 'New Project', icon: '🗂', tab: 'projects_list', intent: 'create', accessKey: 'planner' },
  { id: 'child', label: null, termKey: 'Person', labelPrefix: 'Add ', icon: '👧', tab: 'children', intent: 'create', accessKey: 'people' },
  { id: 'register', label: 'New Register', icon: '✅', tab: 'registers', moduleKey: 'registers', intent: 'create' },
  { id: 'concern', label: 'Safeguarding Concern', icon: '🛡', tab: 'safeguarding', moduleKey: 'safeguarding', intent: 'create' },
  { id: 'risk', label: 'Risk Assessment', icon: '⚠️', tab: 'risk_assessments', moduleKey: 'risk_assessments', intent: 'create' },
  { id: 'form', label: 'New Form', icon: '📝', tab: 'forms', moduleKey: 'forms', intent: 'create' },
  { id: 'payment', label: 'Record Payment', icon: '💳', tab: 'payments', moduleKey: 'payments', intent: 'create' },
]

/**
 * Whether an item should appear at all.
 *
 * Modules the organisation has not enabled are hidden rather than shown locked.
 * That is a deliberate change: a shorter, honest sidebar is the point of the
 * redesign, and a row that cannot be clicked is not navigation. The locked
 * screen and its routes still exist, so upgrade prompts elsewhere and any
 * existing deep link continue to work.
 */
export function isItemVisible(item, { hasModule, isAdmin, moduleLevel }) {
  if (item.adminOnly && !isAdmin) return false
  if (item.moduleKey && !hasModule(item.moduleKey)) return false
  // Per-member access. Some items have no moduleKey because they are core
  // rather than purchasable (Young People, Projects); accessKey names the
  // module that governs them so they can still be restricted per person.
  const accessKey = item.accessKey || item.moduleKey
  if (accessKey && moduleLevel && moduleLevel(accessKey) === 'none') return false
  return true
}

export function visibleItems(items, ctx) {
  return items.filter(i => isItemVisible(i, ctx))
}

/** Which collapsible group, if any, contains the active tab. */
export function groupContainingTab(tab) {
  const g = NAV_GROUPS.find(group => group.items.some(i => i.tab === tab || (i.matchTabs || []).includes(tab)))
  return g?.id || null
}

export function isItemActive(item, tab) {
  if (item.matchTabs) return item.matchTabs.includes(tab)
  return item.tab === tab
}
