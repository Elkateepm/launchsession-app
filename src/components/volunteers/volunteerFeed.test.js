import { feedText } from './volunteerFeed'

test('shows a broadcast as words, not markup or merge fields', () => {
  expect(feedText('Hi {{FirstName}}, just a reminder<br/>see you there!')).toBe('Hi [first name], just a reminder see you there!')
  expect(feedText('<p>Thanks &amp; well done {{ first_name }}</p>')).toBe('Thanks & well done [first name]')
  expect(feedText('Session at {{Venue}}')).toBe('Session at …')
})

test('copes with nothing', () => {
  expect(feedText(null)).toBe('')
  expect(feedText('')).toBe('')
})
