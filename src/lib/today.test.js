import { todayInLondon, dayInLondon, londonDayOffset } from './today'

describe('todayInLondon', () => {
  it('returns a real YYYY-MM-DD', () => {
    expect(todayInLondon()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // The whole point: in BST the UTC slice is a day behind in the small hours.
  it('is the London day, not the UTC day, at 00:30 BST', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T23:30:00Z'))
    try {
      expect(new Date().toISOString().slice(0, 10)).toBe('2026-07-14')  // the old behaviour
      expect(todayInLondon()).toBe('2026-07-15')                        // 00:30 on the 15th in London
    } finally { jest.useRealTimers() }
  })

  it('agrees with UTC in winter, when London is on GMT', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-14T23:30:00Z'))
    try {
      expect(todayInLondon()).toBe('2026-01-14')
    } finally { jest.useRealTimers() }
  })
})

describe('dayInLondon', () => {
  it('maps a stored timestamp to the day it happened in London', () => {
    expect(dayInLondon('2026-07-14T23:30:00Z')).toBe('2026-07-15')
    expect(dayInLondon('2026-01-14T23:30:00Z')).toBe('2026-01-14')
  })

  it('returns null rather than a wrong date', () => {
    expect(dayInLondon(null)).toBeNull()
    expect(dayInLondon('not a date')).toBeNull()
  })
})

describe('londonDayOffset', () => {
  it('steps whole days from today', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00Z'))
    try {
      expect(londonDayOffset(0)).toBe('2026-07-15')
      expect(londonDayOffset(-1)).toBe('2026-07-14')
      expect(londonDayOffset(7)).toBe('2026-07-22')
    } finally { jest.useRealTimers() }
  })
})

// This pattern reads correctly and is wrong for eight months of the year, which
// is why it survived 31 times. A grep is the only thing that keeps it out.
describe('no UTC date derivations in source', () => {
  const fs = require('fs')
  const path = require('path')
  const walk = (dir, out = []) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      if (fs.statSync(p).isDirectory()) walk(p, out)
      else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p)
    }
    return out
  }
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('nothing derives today from toISOString()', () => {
    const offenders = []
    const src = path.join(__dirname, '..')
    for (const file of walk(src)) {
      const text = stripComments(fs.readFileSync(file, 'utf8'))
      if (/new Date\(\)\s*\.toISOString\(\)\s*\.(slice\(0,\s*10\)|split\('T'\)\[0\])/.test(text)) {
        offenders.push(path.relative(src, file))
      }
    }
    expect(offenders).toEqual([])
  })
})
