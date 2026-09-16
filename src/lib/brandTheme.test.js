import { applyBrandTheme } from './brandTheme'
import { contrastRatio } from './brandColors'

test.each(['#ffff00', '#ffffff', '#000000', '#1b9aaa', '#ee5577'])('brand surfaces keep white text readable for %s', primary_color => {
  applyBrandTheme({ primary_color, secondary_color: primary_color })
  const root = document.documentElement.style
  for (const token of ['--org-sidebar', '--org-sidebar-end', '--org-nav-active', '--org-hero-start', '--org-hero-end']) {
    expect(contrastRatio(root.getPropertyValue(token), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  }
})

test('switching organisations replaces secondary and typography tokens', () => {
  applyBrandTheme({ primary_color: '#ee5577', secondary_color: '#123456', brand_font: 'lora' })
  expect(document.documentElement.style.getPropertyValue('--org-secondary')).toBe('#123456')
  expect(document.documentElement.style.getPropertyValue('--font-display')).toContain('Lora')
  applyBrandTheme(null)
  expect(document.documentElement.style.getPropertyValue('--org-secondary')).toBe('#1B9AAA')
  expect(document.documentElement.style.getPropertyValue('--font-display')).not.toContain('Lora')
})
