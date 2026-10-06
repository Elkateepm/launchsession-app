import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import OrgPageHero, { orgBrand } from './OrgPageHero'

const org = { name: 'Solidarity Sports', slogan: 'Every Child Deserves happiness', primary_color: '#4714ff', secondary_color: '#A4B896', accent_color: '#D6AD73', logo_url: 'https://example.test/logo.png' }

test('leads with the organisation: logo, name, title and strapline', () => {
  const { container } = render(<OrgPageHero org={org} title="Registers" subtitle="A clear view." label="Today's register" detail="Wednesday 7 October" />)
  expect(screen.getByRole('region', { name: 'Solidarity Sports Registers' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Registers' })).toBeInTheDocument()
  expect(screen.getByText('Solidarity Sports')).toBeInTheDocument()
  expect(screen.getByText('Every Child Deserves happiness')).toBeInTheDocument()
  expect(screen.queryByText('A clear view.')).toBeNull()
  expect(container.querySelector('[data-org-logo] img').getAttribute('src')).toBe('https://example.test/logo.png')
})

test('falls back to the page description when there is no strapline', () => {
  render(<OrgPageHero org={{ ...org, slogan: '' }} title="Registers" subtitle="A clear view." />)
  expect(screen.getByText('A clear view.')).toBeInTheDocument()
})

test('a missing or broken logo shows the organisation initials, not LaunchSession', () => {
  const { container, rerender } = render(<OrgPageHero org={{ ...org, logo_url: null }} title="Registers" />)
  expect(container.querySelector('[data-org-logo]').textContent).toBe('SS')
  rerender(<OrgPageHero org={org} title="Registers" />)
  fireEvent.error(container.querySelector('[data-org-logo] img'))
  expect(container.querySelector('[data-org-logo]').textContent).toBe('SS')
})

test('the brand uses all three organisation colours and ignores invalid ones', () => {
  expect(orgBrand(org).stripe).toBe('linear-gradient(90deg, #4714ff, #A4B896, #D6AD73)')
  expect(orgBrand({ primary_color: 'not-a-colour' }).primary).toBe('#1B9AAA')
  expect(orgBrand({ primary_color: '#4714ff' }).accent).toBe('#4714ff')
})
