import { charityNumberError, discountedPence, guessRegulator, hasCharityDiscount, normaliseCharityNumber } from './charityDiscount'

test('the 20% lands on the prices the plans are sold at', () => {
  expect(discountedPence(4999)).toBe(3999)
  expect(discountedPence(5999)).toBe(4799)
  expect(discountedPence(6999)).toBe(5599)
  expect(discountedPence(3999)).toBe(3199)
  expect(discountedPence(null)).toBe(null)
})

test('numbers are accepted as each register prints them', () => {
  expect(charityNumberError('1123456', 'ccew')).toBe('')
  expect(charityNumberError('202918', 'ccew')).toBe('')
  expect(charityNumberError('1123456-1', 'ccew')).toBe('')
  expect(charityNumberError('sc 012345', 'oscr')).toBe('')
  expect(charityNumberError('NIC100002', 'ccni')).toBe('')
  expect(charityNumberError('100002', 'ccni')).toBe('')
})

test('a number that cannot be on the register says what one looks like', () => {
  expect(charityNumberError('', 'ccew')).toMatch(/Enter your registered charity number/)
  expect(charityNumberError('12345', 'ccew')).toMatch(/look like 1123456/)
  expect(charityNumberError('SC012345', 'ccew')).toMatch(/England & Wales/)
  expect(charityNumberError('1123456', 'nowhere')).toMatch(/Choose where/)
})

test('typing is tidied, and the prefix points at the regulator', () => {
  expect(normaliseCharityNumber(' sc01 2345 ', 'oscr')).toBe('SC012345')
  expect(normaliseCharityNumber('100002', 'ccni')).toBe('NIC100002')
  expect(guessRegulator('sc012345')).toBe('oscr')
  expect(guessRegulator('NIC100002')).toBe('ccni')
  expect(guessRegulator('1123456')).toBe(null)
})

test('a claim counts while it is checked; a rejected one does not', () => {
  expect(hasCharityDiscount({ charity_number: '1123456', charity_status: 'claimed' })).toBe(true)
  expect(hasCharityDiscount({ charity_number: '1123456', charity_status: 'verified' })).toBe(true)
  expect(hasCharityDiscount({ charity_number: '1123456', charity_status: 'rejected' })).toBe(false)
  expect(hasCharityDiscount({ charity_status: 'claimed' })).toBe(false)
  expect(hasCharityDiscount(null)).toBe(false)
})
