import fs from 'fs'
import path from 'path'
import { withAlpha } from './withAlpha'

describe('withAlpha', () => {
  it('leaves literal hex byte-identical to the old concatenation', () => {
    expect(withAlpha('#DC2626', 'CC')).toBe('#DC2626CC')
    expect(withAlpha('#abc', '22')).toBe('#abc22')
  })

  it('turns a theme token into valid CSS instead of a dropped declaration', () => {
    expect(withAlpha('var(--danger-text)', 'CC')).toBe('color-mix(in srgb, var(--danger-text) 80%, transparent)')
    expect(withAlpha('var(--info-text)', '12')).toBe('color-mix(in srgb, var(--info-text) 7%, transparent)')
  })

  it('never produces a var() with a suffix stuck on the end', () => {
    for (const c of ['var(--x)', 'rgb(1 2 3)', 'hsl(1 2% 3%)', 'currentColor', '#fff']) {
      expect(withAlpha(c, '40')).not.toMatch(/\)[0-9A-Fa-f]{2}$/)
    }
  })

  it('passes through anything that is not a string', () => {
    expect(withAlpha(undefined, '22')).toBe(undefined)
    expect(withAlpha(null, '22')).toBe(null)
  })
})

// A colour tinted by appending two hex digits -- `${c}22` -- is only valid while
// c is a hex literal. Migrating colours to theme tokens turned dozens of these
// into `var(--danger-text)22`, which CSS discards silently: the element keeps
// its layout and its text and loses its background, so a gradient button
// renders a white label on nothing. Nothing throws and no test fails, which is
// why it shipped and why this guard is a repo-wide grep rather than a render.
describe('no hand-rolled alpha suffixes in source', () => {
  const walk = (dir, out = []) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      if (fs.statSync(p).isDirectory()) walk(p, out)
      else if (/\.jsx?$/.test(p) && !/\.test\.jsx?$/.test(p)) out.push(p)
    }
    return out
  }

  // Comments are allowed to show the broken form -- several explain it.
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it('every ${...} alpha tint goes through withAlpha', () => {
    const offenders = []
    for (const file of walk(path.join(__dirname, '..'))) {
      const src = stripComments(fs.readFileSync(file, 'utf8'))
      const re = /\$\{(?!withAlpha\()([^{}]{1,80}?)\}[0-9A-Fa-f]{2}(?![0-9A-Za-z])/g
      let m
      while ((m = re.exec(src))) {
        offenders.push(`${path.relative(path.join(__dirname, '..'), file)}: \${${m[1].trim()}}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
