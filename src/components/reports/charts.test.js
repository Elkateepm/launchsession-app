import { niceMax, niceMaxInt } from './charts'
import { balancedColumns } from './InsightsHome'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))

describe('axis maxima', () => {
  test('round up to clean values', () => {
    expect(niceMax(77)).toBe(100)
    expect(niceMax(18)).toBe(20)
    expect(niceMax(0)).toBe(1)
  })

  test('counts keep a whole-number midpoint', () => {
    expect(niceMaxInt(1)).toBe(2)
    expect(niceMaxInt(3)).toBe(4)
    expect(niceMaxInt(5)).toBe(6)
    expect(niceMaxInt(9)).toBe(10)
    expect(niceMaxInt(23)).toBe(50)
    expect(niceMaxInt(120)).toBe(200)
    ;[1, 3, 5, 9, 23, 120, 777].forEach(v => expect(Number.isInteger(niceMaxInt(v) / 2)).toBe(true))
  })
})

describe('balancedColumns', () => {
  test('never leaves one tile alone on the last row', () => {
    expect(balancedColumns(7, 6)).toBe(4)
    expect(balancedColumns(6, 6)).toBe(6)
    expect(balancedColumns(5, 6)).toBe(5)
    expect(balancedColumns(7, 3)).toBe(3)
    expect(balancedColumns(4, 6)).toBe(4)
    expect(balancedColumns(3, 2)).toBe(2)
  })
})
