import { readableDbError, isDbError } from './dbErrors'

describe('readableDbError', () => {
  it('drops the machine prefix the database guards raise', () => {
    expect(readableDbError({ message: 'CHILD_LIMIT_REACHED: This organisation’s plan includes up to 100 young people.' }))
      .toBe('This organisation’s plan includes up to 100 young people.')
    expect(readableDbError({ message: 'ORG_BILLING_LOCKED: This organisation is read-only.' }))
      .toBe('This organisation is read-only.')
  })

  it('leaves an unprefixed message alone', () => {
    expect(readableDbError({ message: 'duplicate key value violates unique constraint' }))
      .toBe('duplicate key value violates unique constraint')
  })

  // A colon is not enough -- "Error: something" would otherwise lose its first
  // word, and a timestamp like "12:30" must survive untouched.
  it('only strips a SHOUTING_CODE prefix', () => {
    expect(readableDbError({ message: 'Error: something failed' })).toBe('Error: something failed')
    expect(readableDbError({ message: 'Session starts at 12:30 and cannot be moved' }))
      .toBe('Session starts at 12:30 and cannot be moved')
  })

  it('accepts a bare string as well as an error', () => {
    expect(readableDbError('CHILD_LIMIT_REACHED: full')).toBe('full')
  })

  // A blank alert box is worse than a raw one.
  it('falls back rather than returning nothing', () => {
    expect(readableDbError(null, 'Could not save.')).toBe('Could not save.')
    expect(readableDbError({ message: '' }, 'Could not save.')).toBe('Could not save.')
    expect(readableDbError({ message: 'CHILD_LIMIT_REACHED:' }, 'Could not save.')).toBe('Could not save.')
  })
})

describe('isDbError', () => {
  it('identifies the guard regardless of surrounding wording', () => {
    expect(isDbError({ message: 'CHILD_LIMIT_REACHED: full' }, 'CHILD_LIMIT_REACHED')).toBe(true)
    expect(isDbError({ message: 'something else' }, 'CHILD_LIMIT_REACHED')).toBe(false)
    expect(isDbError(null, 'CHILD_LIMIT_REACHED')).toBe(false)
  })
})
