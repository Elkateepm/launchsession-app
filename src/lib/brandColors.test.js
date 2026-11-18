import { brandPalette, contrastRatio } from './brandColors'

// --org-solid / --org-on-solid fill buttons with ordinary-sized labels, so the
// pair must reach WCAG AA (4.5:1) whatever colour an organisation picks.
test.each(['#1B9AAA', '#E63946', '#FFD60A', '#2A9D8F', '#7B2CBF', '#F4A261', '#0B132B', '#FFFFFF', '#00FF00'])(
  'solid button colours for %s read at 4.5:1 in light and dark',
  (brand) => {
    for (const dark of [false, true]) {
      const p = brandPalette(brand, dark)
      expect(contrastRatio(p.solid, p.onSolid)).toBeGreaterThanOrEqual(4.5)
    }
  },
)

test('the LaunchSession teal is darkened only as far as it needs to be', () => {
  const p = brandPalette('#1B9AAA', false)
  expect(p.onSolid).toBe('#ffffff')
  expect(contrastRatio(p.solid, '#ffffff')).toBeLessThan(5.2)
})
