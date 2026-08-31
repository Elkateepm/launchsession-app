import {
  isItemVisible, visibleItems, HIDEABLE_ITEMS, NAV_SECTIONS, NAV_GROUPS, CREATE_ACTIONS, OFFICE_TABS,
} from './navConfig'

// An organisation with everything, so only the hidden list is under test.
const ctx = (hiddenItems = []) => ({
  hasModule: () => true,
  isAdmin: true,
  moduleLevel: () => 'edit',
  hiddenItems,
})

const allItems = [...NAV_SECTIONS.flatMap(s => s.items), ...NAV_GROUPS.flatMap(g => g.items)]

describe('switching a sidebar entry off', () => {
  it('hides only the entry that was switched off', () => {
    const shown = visibleItems(allItems, ctx(['mentoring']))
    expect(shown.some(i => i.id === 'mentoring')).toBe(false)
    expect(shown.length).toBe(allItems.length - 1)
  })

  it('shows everything when nothing is hidden', () => {
    expect(visibleItems(allItems, ctx([])).length).toBe(allItems.length)
    // Undefined is the shape an org row carries before anyone has saved.
    expect(visibleItems(allItems, ctx(undefined)).length).toBe(allItems.length)
  })

  it('is reversible — the entry returns when it is switched back on', () => {
    const off = visibleItems(allItems, ctx(['gallery', 'payments']))
    expect(off.some(i => i.id === 'gallery')).toBe(false)
    const on = visibleItems(allItems, ctx([]))
    expect(on.some(i => i.id === 'gallery')).toBe(true)
  })

  it('ignores an id that no longer matches anything', () => {
    // A tab removed from the product leaves its id behind in saved settings.
    expect(visibleItems(allItems, ctx(['a_tab_that_was_deleted'])).length).toBe(allItems.length)
  })

  it('does not confuse hiding with access', () => {
    // Hidden but entitled, versus entitled but not hidden: different reasons,
    // and only the module one means the org cannot open the screen.
    const item = { id: 'mentoring', moduleKey: 'mentoring' }
    expect(isItemVisible(item, ctx(['mentoring']))).toBe(false)
    expect(isItemVisible(item, { ...ctx([]), hasModule: () => false })).toBe(false)
    expect(isItemVisible(item, ctx([]))).toBe(true)
  })
})

describe('what an organisation is allowed to switch off', () => {
  it('offers every sidebar entry, and Office as its five modules', () => {
    // Office is one row but five switches: hiding the row would take all five
    // away at once, and its modules were individually hideable before it
    // existed.
    const offered = HIDEABLE_ITEMS.flatMap(g => g.items.map(i => i.id))
    const expected = allItems.filter(i => i.id !== 'office').map(i => i.id).concat(OFFICE_TABS.map(t => t.id))
    expect(new Set(offered)).toEqual(new Set(expected))
  })

  it('never offers a way to hide the route back to Settings', () => {
    // Settings and Branding live in ORG_ITEMS, and Home is not in the nav at
    // all. That is what stops an organisation switching off the only screen
    // that could switch anything back on.
    const offered = HIDEABLE_ITEMS.flatMap(g => g.items.map(i => i.id))
    for (const id of ['settings', 'branding', 'home']) {
      expect(offered).not.toContain(id)
    }
  })

  it('keeps its groups in the order the sidebar uses', () => {
    expect(HIDEABLE_ITEMS.map(g => g.group))
      .toEqual([...NAV_SECTIONS.map(s => s.label), ...NAV_GROUPS.map(g => g.label)])
  })
})

describe('the Create menu follows the sidebar', () => {
  // Hiding Forms and leaving "New Form" in the Create menu would be a shortcut
  // into a tab the organisation has just said it does not use.
  const hiddenTabs = (hiddenIds) => {
    const tabs = new Set(allItems.filter(i => hiddenIds.includes(i.id)).map(i => i.tab))
    return CREATE_ACTIONS.filter(a => tabs.has(a.tab)).map(a => a.id)
  }

  it('drops the shortcut for a hidden tab', () => {
    const shown = visibleItems(CREATE_ACTIONS, ctx(hiddenTabs(['forms'])))
    expect(shown.some(a => a.id === 'form')).toBe(false)
  })

  it('leaves the rest of the menu alone', () => {
    const shown = visibleItems(CREATE_ACTIONS, ctx(hiddenTabs(['forms'])))
    expect(shown.length).toBe(CREATE_ACTIONS.length - 1)
    expect(shown.some(a => a.id === 'session')).toBe(true)
  })

  it('changes nothing when the hidden tab has no shortcut', () => {
    // Mentoring has a sidebar entry but nothing in the Create menu.
    expect(hiddenTabs(['mentoring'])).toEqual([])
    expect(visibleItems(CREATE_ACTIONS, ctx([])).length).toBe(CREATE_ACTIONS.length)
  })
})


describe('Office', () => {
  const officeIds = OFFICE_TABS.map(t => t.id)

  it('holds the desk-work modules and nothing else', () => {
    expect(officeIds).toEqual(['hr', 'payments', 'resource_booking', 'templates', 'parent_portal'])
  })

  it('takes them out of the sidebar as separate rows', () => {
    const sidebarIds = [
      ...NAV_SECTIONS.flatMap(s => s.items),
      ...NAV_GROUPS.flatMap(g => g.items),
    ].map(i => i.id)
    for (const id of officeIds) expect(sidebarIds).not.toContain(id)
    expect(sidebarIds).toContain('office')
  })

  it('keeps every existing deep link resolving', () => {
    // ?tab=payments and the rest must still land somewhere, so the tab names
    // are unchanged and the Office row claims them all.
    const office = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === 'office')
    for (const t of OFFICE_TABS) expect(office.matchTabs).toContain(t.tab)
    expect(office.matchTabs).toContain('office')
  })

  it('still offers all five in Settings > Display', () => {
    // Hiding one row would otherwise take all five away at once, and an
    // organisation that switched Payments off before Office existed keeps it.
    const group = HIDEABLE_ITEMS.find(g => g.group === 'Office')
    expect(group.items.map(i => i.id)).toEqual(officeIds)
    expect(HIDEABLE_ITEMS.flatMap(g => g.items.map(i => i.id))).not.toContain('office')
  })

  it('shows an admin every module', () => {
    const ctx = { hasModule: () => true, isAdmin: true, moduleLevel: () => 'edit', hiddenItems: [] }
    expect(visibleItems(OFFICE_TABS, ctx)).toHaveLength(5)
  })

  it('hides the admin-only modules from everyone else', () => {
    const ctx = { hasModule: () => true, isAdmin: false, moduleLevel: () => 'edit', hiddenItems: [] }
    const ids = visibleItems(OFFICE_TABS, ctx).map(i => i.id)
    expect(ids).not.toContain('hr')
    expect(ids).not.toContain('templates')
    expect(ids).toContain('payments')
  })

  it('drops a module the organisation has not bought', () => {
    const ctx = { hasModule: (k) => k !== 'payments', isAdmin: true, moduleLevel: () => 'edit', hiddenItems: [] }
    expect(visibleItems(OFFICE_TABS, ctx).map(i => i.id)).not.toContain('payments')
  })

  it('drops one the organisation has switched off', () => {
    const ctx = { hasModule: () => true, isAdmin: true, moduleLevel: () => 'edit', hiddenItems: ['templates'] }
    expect(visibleItems(OFFICE_TABS, ctx).map(i => i.id)).not.toContain('templates')
  })

  it('can end up empty, which is what the row checks before showing itself', () => {
    const ctx = { hasModule: () => false, isAdmin: false, moduleLevel: () => 'none', hiddenItems: [] }
    expect(visibleItems(OFFICE_TABS, ctx)).toHaveLength(0)
  })
})
