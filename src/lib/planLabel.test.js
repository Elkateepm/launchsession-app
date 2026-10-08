import { planLabel } from './moduleAccess'

test('plans show by name, never as their database key', () => {
  expect(planLabel('platform')).toBe('Complete Platform')
  expect(planLabel('platform_office')).toBe('Platform + Office')
  expect(planLabel('platform_office_branding')).toBe('Platform + Office + Branding')
  expect(planLabel('trial')).toBe('Free trial')
  expect(planLabel(null)).toBe('Free trial')
  expect(planLabel('some_new_plan')).toBe('Some new plan')
})
