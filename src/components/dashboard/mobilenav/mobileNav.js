// What the phone can actually reach, derived from the same nav data the
// desktop sidebar uses.
//
// The mobile dock and its "More" sheet used to be two hardcoded lists inside
// Dashboard.jsx, and they had drifted badly from the real nav:
//
//   • Sessions was in neither, so on a phone you could create a session from
//     the Launch menu but never open one again -- despite `planner` being a
//     base module every organisation always has.
//   • Neither list ran the access checks. The sidebar hides a module the
//     organisation has not enabled, has switched off in Settings > Display, or
//     that this member has no access to; the mobile lists showed all of it and
//     let people walk into a locked screen.
//   • The More sheet listed `team`, which TAB_ALIASES rewrites to `hr`. `hr` is
//     admin-only, so a non-admin tapping "Team & Staff" was silently returned
//     to Home. The sheet's own admin filter tested `team`, which is not in
//     ADMIN_ONLY_TABS, so it never caught it. The dock had the identical bug
//     against the same alias and it was fixed there; this is the other half.
//
// Deriving both from NAV_SECTIONS/NAV_GROUPS means adding a section to the nav
// reaches the phone with no second edit, which is the drift that caused all
// three of the above.

import {
  NAV_SECTIONS, NAV_GROUPS, ORG_ITEMS, visibleItems,
} from '../sidebar/navConfig'

// The two slots either side of the Launch button, most-reached-for first. The
// dock shows the first two that this organisation and this member can open, so
// it never renders a button that dead-ends on a locked module.
//
// Sessions leads: it is a base module (always available, never purchasable) and
// it is the thing the product is for. Registers follows because it is the
// in-session tool and it carries the only live badge. The rest are fallbacks
// for an organisation whose modules are pared back.
export const DOCK_CANDIDATES = [
  { id: 'planner', label: 'Sessions', icon: 'sessions', tab: 'planner', moduleKey: 'planner' },
  { id: 'registers', label: 'Registers', icon: 'registers', tab: 'registers', moduleKey: 'registers', badgeKey: 'registers' },
  { id: 'children', label: null, termKey: 'People', icon: 'children', tab: 'children', accessKey: 'people' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', tab: 'calendar', moduleKey: 'calendar' },
  { id: 'volunteers', label: 'Volunteers', icon: 'volunteers', tab: 'volunteers', moduleKey: 'volunteers' },
]

// Home and More are fixed, Launch is the centre, so two are left.
export const DOCK_SLOTS = 2

/** The dock's two flanking destinations for this viewer. */
export function dockDestinations(ctx) {
  return visibleItems(DOCK_CANDIDATES, ctx).slice(0, DOCK_SLOTS)
}

// Admin-only and not part of NAV_SECTIONS, so it needs naming here or it stays
// unreachable on a phone the way it was before.
const OVERVIEW_ITEMS = [
  { id: 'today', label: 'Today', icon: 'insights', tab: 'today', adminOnly: true },
]

/**
 * The More sheet's contents: every area this viewer can open that the dock is
 * not already showing, grouped the way the sidebar groups them.
 *
 * `exclude` takes the tabs already on the dock so nothing appears twice --
 * Volunteers used to sit in the dock and the sheet at the same time.
 *
 * `officeTabCount` is how many Office sub-tabs the viewer can open. The Office
 * row is one entry standing for several modules, so its visibility depends on
 * its contents rather than on a module of its own; passing 0 drops it.
 */
export function moreSections(ctx, { exclude = [], officeTabCount = 0 } = {}) {
  const skip = new Set([...exclude, 'home'])

  const keep = items => visibleItems(items, ctx).filter(i => !skip.has(i.tab))

  const sections = [
    { id: 'overview', label: 'Overview', items: keep(OVERVIEW_ITEMS) },
    ...NAV_SECTIONS.map(s => ({
      id: s.id,
      label: s.label,
      // The Office row is visible only when at least one thing behind it is.
      items: s.id === 'office' && officeTabCount === 0 ? [] : keep(s.items),
    })),
    ...NAV_GROUPS.map(g => ({ id: g.id, label: g.label, items: keep(g.items) })),
    { id: 'organisation', label: 'Organisation', items: keep(ORG_ITEMS) },
  ]

  return sections.filter(s => s.items.length > 0)
}

/** The label to print for an item, resolving the org's own terminology. */
export function itemLabel(item, terms) {
  return item.label || (item.termKey && terms?.[item.termKey]) || item.id
}
