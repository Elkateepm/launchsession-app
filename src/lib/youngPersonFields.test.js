import { yearGroupFor, tidyPostcode, buildChildRows, consentRowsFor, aboutLines, blankFamily, blankPerson } from './youngPersonFields'

test('school year follows the 1 September cut-off', () => {
  expect(yearGroupFor('2015-09-01', '2026-11-26')).toBe('Year 6')
  expect(yearGroupFor('2016-08-31', '2026-11-26')).toBe('Year 6')
  expect(yearGroupFor('2016-09-01', '2026-11-26')).toBe('Year 5')
  expect(yearGroupFor('2021-10-01', '2026-11-26')).toBe('Reception')
  expect(yearGroupFor('2022-10-01', '2026-11-26')).toBe('Nursery')
  expect(yearGroupFor('2024-01-01', '2026-11-26')).toBeNull()
  expect(yearGroupFor('2005-01-01', '2026-11-26')).toBe('Left school')
  // Before September the school year has not turned over yet.
  expect(yearGroupFor('2015-09-01', '2026-07-01')).toBe('Year 5')
  expect(yearGroupFor('', '2026-11-26')).toBeNull()
})

test('postcodes are tidied', () => {
  expect(tidyPostcode('sw1a1aa')).toBe('SW1A 1AA')
  expect(tidyPostcode(' e1 6an ')).toBe('E1 6AN')
  expect(tidyPostcode('abc')).toBe('ABC')
})

test('siblings share the family details and a family id; last names carry down', () => {
  const family = { ...blankFamily(), parent_name: ' Amina Khan ', parent_phone: '07700 900123', postcode: 'e16an' }
  const a = { ...blankPerson('Khan'), first_name: 'Sara', date_of_birth: '2015-02-01', gender: 'Female', consents: { photo: true } }
  const b = { ...blankPerson(), first_name: 'Omar', takes_medication: false, medication_details: 'ignored' }
  const blank = blankPerson()
  const rows = buildChildRows({ orgId: 'o1', family, people: [a, blank, b], familyId: 'f1' })
  expect(rows).toHaveLength(2)
  expect(rows.map(r => r.last_name)).toEqual(['Khan', 'Khan'])
  expect(rows.every(r => r.parent_name === 'Amina Khan' && r.postcode === 'E1 6AN' && r.family_id === 'f1' && r.org_id === 'o1')).toBe(true)
  expect(rows[0]).toMatchObject({ gender: 'Female', ethnicity: null, profile_incomplete: false })
  expect(rows[1]).toMatchObject({ medication_details: null, profile_incomplete: true })
})

test('consents: all four rows, granted only where ticked', () => {
  const rows = consentRowsFor({ orgId: 'o1', childId: 'c1', consents: { photo: true }, grantedBy: 'u1', now: 'T' })
  expect(rows).toHaveLength(4)
  expect(rows.find(r => r.consent_type === 'photo')).toMatchObject({ status: 'granted', granted_by: 'u1', granted_at: 'T' })
  expect(rows.find(r => r.consent_type === 'trip')).toMatchObject({ status: 'not_granted', granted_by: null })
})

test('profile lines leave out blanks', () => {
  expect(aboutLines({ gender: 'Male', free_school_meals: 'yes', postcode: 'E1 6AN' })).toEqual([
    ['Gender', 'Male'], ['Gets free school meals', 'Yes'], ['Address', 'E1 6AN'],
  ])
})
