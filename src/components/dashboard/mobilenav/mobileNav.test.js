import {
  dockDestinations, moreSections, itemLabel, DOCK_SLOTS, DOCK_CANDIDATES,
} from './mobileNav'

// An organisation with everything switched on, so each test varies only the
// one thing it is about.
const ctx = (over = {}) => ({
  hasModule: () => true,
  isAdmin: true,
  moduleLevel: () => 'edit',
  hiddenItems: [],
  ...over,
})

const allTabs = sections => sections.flatMap(s => s.items.map(i => i.tab))

describe('the dock', () => {
  it('fills its slots and leads with Sessions', () => {
    const dock = dockDestinations(ctx())
    expect(dock).toHaveLength(DOCK_SLOTS)
    expect(dock[0].tab).toBe('planner')
  })

  it('never offers a destination the organisation cannot open', () => {
    // Registers not purchased: the slot goes to the next available area rather
    // than to a button that lands on the locked screen.
    const dock = dockDestinations(ctx({ hasModule: k => k !== 'registers' }))
    expect(dock.map(d => d.tab)).not.toContain('registers')
    expect(dock).toHaveLength(DOCK_SLOTS)
  })

  it('never offers a destination this member has no access to', () => {
    const dock = dockDestinations(ctx({ moduleLevel: k => (k === 'planner' ? 'none' : 'edit') }))
    expect(dock.map(d => d.tab)).not.toContain('planner')
  })

  it('respects an area the organisation switched off in settings', () => {
    const dock = dockDestinations(ctx({ hiddenItems: ['planner'] }))
    expect(dock.map(d => d.tab)).not.toContain('planner')
  })
})

describe('the More sheet', () => {
  it('reaches the areas the old hardcoded list left stranded', () => {
    const tabs = allTabs(moreSections(ctx(), { officeTabCount: 3 }))
    // Every one of these was unreachable on a phone before.
    expect(tabs).toEqual(expect.arrayContaining([
      'children', 'messaging', 'risk_assessments', 'medical_alerts', 'office', 'today',
    ]))
  })

  it('does not repeat what the dock is already showing', () => {
    const dock = dockDestinations(ctx())
    const tabs = allTabs(moreSections(ctx(), { exclude: dock.map(d => d.tab) }))
    dock.forEach(d => expect(tabs).not.toContain(d.tab))
  })

  it('never sends a non-admin to an admin-only area', () => {
    // The regression this replaces: the sheet listed `team`, TAB_ALIASES
    // rewrote it to `hr`, and a non-admin tapping it was bounced to Home.
    const tabs = allTabs(moreSections(ctx({ isAdmin: false }), { officeTabCount: 3 }))
    expect(tabs).not.toContain('hr')
    expect(tabs).not.toContain('team')
    expect(tabs).not.toContain('settings')
    expect(tabs).not.toContain('today')
  })

  it('hides modules the organisation has not enabled', () => {
    const tabs = allTabs(moreSections(ctx({ hasModule: k => k !== 'messaging' })))
    expect(tabs).not.toContain('messaging')
  })

  it('drops the Office row when nothing behind it is open to this viewer', () => {
    const withOffice = moreSections(ctx(), { officeTabCount: 2 })
    const without = moreSections(ctx(), { officeTabCount: 0 })
    expect(allTabs(withOffice)).toContain('office')
    expect(allTabs(without)).not.toContain('office')
  })

  it('returns no empty groups', () => {
    moreSections(ctx({ hasModule: () => false, isAdmin: false }), { officeTabCount: 0 })
      .forEach(s => expect(s.items.length).toBeGreaterThan(0))
  })
})

describe('labels', () => {
  it("uses the organisation's own word for its people", () => {
    const people = DOCK_CANDIDATES.find(i => i.id === 'children')
    expect(itemLabel(people, { People: 'Players' })).toBe('Players')
    expect(itemLabel(people, { People: 'Members' })).toBe('Members')
  })

  it('falls back to the plain label when there is no term', () => {
    expect(itemLabel({ id: 'planner', label: 'Sessions' }, {})).toBe('Sessions')
  })
})
