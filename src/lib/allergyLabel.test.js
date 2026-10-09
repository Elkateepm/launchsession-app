import { allergyLabel } from './allergyLabel'

test('the register flag names the allergy, and cuts long ones short', () => {
  expect(allergyLabel('Peanuts')).toBe('Peanuts')
  expect(allergyLabel('  Nuts,\n eggs ')).toBe('Nuts, eggs')
  expect(allergyLabel('Tree nuts, sesame and shellfish')).toBe('Tree nuts, sesame…')
  expect(allergyLabel(null)).toBe('')
})
