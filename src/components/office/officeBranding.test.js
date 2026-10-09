import { getOfficeBranding } from './officeBranding'
import { contrastRatio } from '../../lib/brandColors'

const custom = { name: 'Community Club', logo_url: '/club.svg', primary_color: '#FFE300', secondary_color: '#DB2777', slogan: 'Together we thrive', brand_font: 'lora' }

test.each([false, undefined, null, 'true', 1])('saved branding cannot bypass the entitlement: %s', branding_enabled => {
  const brand = getOfficeBranding({ ...custom, branding_enabled })
  expect(brand).toMatchObject({ name: 'LaunchSession', logo: '/logo.png', slogan: '', font: { key: 'default' } })
  expect(brand.style['--office-primary']).toBe('#3B82F6')
  expect(brand.style['--font-display']).not.toContain('Lora')
})

test.each([false, true])('enabled branding is readable in dark mode %s', dark => {
  const brand = getOfficeBranding({ ...custom, branding_enabled: true }, dark)
  expect(brand).toMatchObject({ name: custom.name, logo: custom.logo_url, slogan: custom.slogan, font: { key: 'lora' } })
  expect(brand.style['--office-primary']).toBe(custom.primary_color)
  expect(contrastRatio(brand.style['--office-ink'], brand.style['--office-tint'])).toBeGreaterThanOrEqual(4.5)
})
