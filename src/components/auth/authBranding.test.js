import { getAuthBranding, hasAuthBranding } from './authBranding'
import { contrastRatio } from '../../lib/brandColors'
const custom = { name: 'Community Club', primary_color: '#FFE300', secondary_color: '#DB2777', accent_color: '#059669', logo_url: '/custom-logo.png', icon_url: '/custom-icon.png', slogan: 'Together we thrive', brand_font: 'lora', login_background_url: '/custom-background.png', login_background_style: 'cover' }
test.each([false, undefined, null, 'true', 1])('branding requires an explicit enabled entitlement: %s', flag => {
  const org = { ...custom, branding_enabled: flag }
  expect(hasAuthBranding(org)).toBe(false)
  const brand = getAuthBranding(org)
  expect(brand).toMatchObject({ enabled: false, name: 'LaunchSession', logo: '/logo.png', icon: '/logo.png', primary: '#3B82F6', secondary: '#6366F1', slogan: '', background: null, font: { key: 'default' } })
})
test('enabled branding includes identity, all colours, typography and background', () => {
  expect(getAuthBranding({ ...custom, branding_enabled: true })).toMatchObject({ enabled: true, name: custom.name, logo: custom.logo_url, icon: custom.icon_url, primary: custom.primary_color, secondary: custom.secondary_color, accent: custom.accent_color, slogan: custom.slogan, background: custom.login_background_url, font: { key: 'lora' } })
})
test.each(['#FFE300', '#4562BC', '#fff', '#000', '#3B82F6', '#777777'])('button text stays readable for primary %s', primary => {
  const brand = getAuthBranding({ ...custom, branding_enabled: true, primary_color: primary })
  expect(contrastRatio(brand.primary, brand.buttonText)).toBeGreaterThanOrEqual(4.5)
})
test('incomplete and invalid branding has safe usable defaults', () => {
  const brand = getAuthBranding({ branding_enabled: true, primary_color: 'red; background:url(bad)', secondary_color: 'garbage', brand_font: 'unknown' })
  expect(brand).toMatchObject({ name: 'Your organisation', logo: null, background: null, primary: '#3B82F6', secondary: '#3B82F6', font: { key: 'default' } })
})
test('tint background style does not load the saved image', () => {
  expect(getAuthBranding({ ...custom, branding_enabled: true, login_background_style: 'tint' }).background).toBeNull()
})
