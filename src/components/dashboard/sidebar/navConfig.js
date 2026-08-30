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
      { id: 'calendar', label: 'Calendar', icon: 'calendar', tab: 'calendar', moduleKey: 'calendar' },
      { id: 'planner', label: 'Sessions', icon: 'sessions', tab: 'planner', moduleKey: 'planner' },
      { id: 'projects', label: 'Projects', icon: 'projects', tab: 'projects_list', matchTabs: ['projects_list', 'projects'], accessKey: 'planner' },
      { id: 'registers', label: 'Registers', icon: 'registers', tab: 'registers', moduleKey: 'registers' },
      // Rendered by Dashboard but absent from the old sidebar, so it was only
      // reachable by deep link. Module-gated, so it appears only where enabled.
      { id: 'mentoring', label: 'Mentoring', icon: 'mentoring', tab: 'mentoring', moduleKey: 'mentoring' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      // Label comes from the org's own terminology (People / Young People /
      // Members / Players), resolved at render.
      { id: 'children', label: null, termKey: 'People', icon: 'children', tab: 'children', accessKey: 'people' },
      // Staff are managed in HR (Operations). Volunteers stay separate: they
      // are a different relationship with different records, and merging them
      // would recreate the ambiguity this consolidation removed.
      { id: 'volunteers', label: 'Volunteers', icon: 'volunteers', tab: 'volunteers', moduleKey: 'volunteers' },
      { id: 'newsletter', label: 'Newsletter', icon: 'newsletter', tab: 'newsletter', moduleKey: 'messaging' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    items: [
      { id: 'safeguarding', label: 'Safeguarding Hub', icon: 'safeguarding', tab: 'safeguarding', moduleKey: 'safeguarding' },
      { id: 'risk_assessments', label: 'Risk Assessments', icon: 'risk', tab: 'risk_assessments', moduleKey: 'risk_assessments' },
      { id: 'forms', label: 'Forms', icon: 'forms', tab: 'forms', moduleKey: 'forms', badgeKey: 'forms' },
      { id: 'medical_alerts', label: 'Medical Alerts', icon: 'medical', tab: 'medical_alerts', moduleKey: 'medical_alerts' },
    ],
  },
]

// Collapsed by default. These are things staff consult occasionally rather than
// work in daily, and keeping them shut is most of what shortens the sidebar.
export const NAV_GROUPS = [
  {
    id: 'insights',
    label: 'Insights',
    icon: 'insights',
    items: [
      { id: 'reports', label: 'Reports', icon: 'reports', tab: 'reports', moduleKey: 'reports' },
      { id: 'impact_outcomes', label: 'Impact & Outcomes', icon: 'impact', tab: 'impact_outcomes', moduleKey: 'impact_outcomes' },
      // Fundraising is hibernated, not deleted. It is three products sharing a
      // tab -- campaigns/donations, a grants marketplace and a document vault
      // with an application tracker -- and none of the three can ship: the only
      // payment provider implementation is `none`, so no donation can actually
      // be taken, and `grants` is twenty hand-seeded rows with no ingestion
      // behind it. The route, components and data all stay; this is a one-line
      // restore once one of the three is built properly.
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'operations',
    items: [
      { id: 'payments', label: 'Payments', icon: 'payments', tab: 'payments', moduleKey: 'payments' },
      { id: 'resource_booking', label: 'Resource Booking', icon: 'resources', tab: 'resource_booking', moduleKey: 'resource_booking' },
      { id: 'messaging', label: 'Messaging', icon: 'messaging', tab: 'messaging', moduleKey: 'messaging' },
      { id: 'gallery', label: 'Gallery', icon: 'gallery', tab: 'gallery', moduleKey: 'gallery' },
      // Not module-gated: staff management absorbed the old Staff & Volunteers
      // page, which was always available. Compliance and leave inside HR are
      // still gated on the module.
      { id: 'hr', label: 'HR', icon: 'hr', tab: 'hr', adminOnly: true },
      { id: 'parent_portal', label: 'Parent Portal', icon: 'parents', tab: 'parent_portal', moduleKey: 'parent_portal' },
      { id: 'templates', label: 'Templates', icon: 'templates', tab: 'templates', adminOnly: true },
      // Events & Trips is deliberately absent. An event or trip is a session
      // carrying an event session_type, so it already shows up in Sessions and
      // in Calendar -- the dedicated page was a third view of the same rows.
      // Planning one is a calendar action now: Calendar's plan picker still
      // routes to the events_trips tab, so that route and its component stay
      // for that entry point and for existing deep links. Dropping the route
      // means dropping the picker option with it.
    ],
  },
]

// Reached through the Organisation item rather than sitting permanently in the
// nav. The routes are untouched; only their entry point moved.
export const ORG_ITEMS = [
  { id: 'settings', label: 'Settings', icon: 'settings', tab: 'settings', adminOnly: true },
  { id: 'branding', label: 'Branding', icon: 'branding', tab: 'branding', adminOnly: true },
]

// Actions offered by the Create button. Each points at an existing flow --
// nothing here builds a second way to create anything.
export const CREATE_ACTIONS = [
  { id: 'session', label: 'New Session', icon: 'sessions', tab: 'planner', moduleKey: 'planner', intent: 'create' },
  { id: 'project', label: 'New Project', icon: 'projects', tab: 'projects_list', intent: 'create', accessKey: 'planner' },
  { id: 'child', label: null, termKey: 'Person', labelPrefix: 'Add ', icon: 'children', tab: 'children', intent: 'create', accessKey: 'people' },
  { id: 'register', label: 'New Register', icon: 'registers', tab: 'registers', moduleKey: 'registers', intent: 'create' },
  { id: 'concern', label: 'Safeguarding Concern', icon: 'safeguarding', tab: 'safeguarding', moduleKey: 'safeguarding', intent: 'create' },
  { id: 'risk', label: 'Risk Assessment', icon: 'risk', tab: 'risk_assessments', moduleKey: 'risk_assessments', intent: 'create' },
  { id: 'form', label: 'New Form', icon: 'forms', tab: 'forms', moduleKey: 'forms', intent: 'create' },
  { id: 'payment', label: 'Record Payment', icon: 'payments', tab: 'payments', moduleKey: 'payments', intent: 'create' },
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
