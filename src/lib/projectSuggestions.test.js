import { holidaySuggestions, holidayTitle, holidayWeekdays, BANK_HOLIDAYS } from './projectSuggestions'
import { computeProjectDates } from '../components/projects/ProjectWizard'

test('offers the next school holidays from today, named the way people say them', () => {
  const s = holidaySuggestions('2026-11-26')
  expect(s.map(x => x.title)).toEqual(['Christmas holidays 2026', 'February half term 2027', 'Easter holidays 2027', 'May half term 2027'])
  expect(s[0]).toMatchObject({ name: 'Christmas holiday club 2026', start_date: '2026-12-21', end_date: '2027-01-01', when: '21 Dec – 1 Jan' })
  expect(s[1].name).toBe('February half term holiday club 2027')
})

test('leaves bank holidays out, so Christmas is 7 days, not 10', () => {
  const [xmas] = holidaySuggestions('2026-11-26')
  expect(xmas.excluded).toEqual(['2026-12-25', '2026-12-28', '2027-01-01'])
  expect(xmas.dayCount).toBe(7)
  // The wizard's own date maths agrees with the suggestion.
  expect(computeProjectDates({ start_date: xmas.start_date, end_date: xmas.end_date, weekdays: xmas.weekdays, excluded: xmas.excluded })).toHaveLength(7)
})

test('a holiday already under way is still offered, and marked as started', () => {
  const [oct] = holidaySuggestions('2026-10-28')
  expect(oct.title).toBe('October half term 2026')
  expect(oct.started).toBe(true)
})

test('names half terms by season', () => {
  expect(holidayTitle({ start: '2027-05-31', end: '2027-06-04', label: 'Half term' })).toBe('May half term 2027')
  expect(holidayTitle({ start: '2027-07-22', end: '2027-09-01', label: 'Summer holidays' })).toBe('Summer holidays 2027')
})

test('Easter skips Good Friday and Easter Monday', () => {
  expect(holidayWeekdays('2026-03-30', '2026-04-10')).not.toContain('2026-04-03')
  expect(holidayWeekdays('2026-03-30', '2026-04-10')).not.toContain('2026-04-06')
  expect(holidayWeekdays('2026-03-30', '2026-04-10')).toHaveLength(8)
  expect(BANK_HOLIDAYS).toContain('2027-03-26')
})

test('runs out quietly past the end of the list', () => {
  expect(holidaySuggestions('2030-01-01')).toEqual([])
})
