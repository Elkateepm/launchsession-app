import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BrandNudge, { shouldShowBrandNudge } from './BrandNudge'

const mockUpdate = jest.fn()
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: p => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
    from: () => ({ update: v => { mockUpdate(v); const q = { eq: () => q, select: () => Promise.resolve({ data: [{ id: 'o1' }], error: null }) }; return q } }),
  },
}))
jest.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
jest.mock('../../../lib/brandImage', () => ({ BRAND_IMAGE_TYPES: ['image/png'], extensionFor: () => 'png', prepareBrandImage: f => Promise.resolve(f) }))
jest.mock('./logoColours', () => ({ extractDominantColors: () => Promise.resolve(['#D4C21A', '#1F2A44']) }))
jest.mock('../../../lib/brandColors', () => ({ applyBrandPalette: jest.fn(), contrastRatio: (c) => (c === '#1F2A44' ? 14 : 1.4) }))
jest.mock('../../../lib/brandTheme', () => ({ applyBrandTheme: jest.fn() }))
jest.mock('./brandingModel', () => ({ ASSETS: [{ key: 'logo_url', options: {} }], readableInk: () => '#10131A' }))

const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v } } }
const org = { id: 'o1', name: 'Solidarity Sports', branding_enabled: true, primary_color: '#1B9AAA' }

beforeEach(() => {
  window.localStorage.clear(); window.sessionStorage.clear()
  mockUpdate.mockReset()
  Object.defineProperty(window, 'crypto', { value: { randomUUID: () => 'uuid' }, configurable: true })
  global.URL.createObjectURL = () => 'blob:logo'
  global.URL.revokeObjectURL = () => {}
})

test('who sees it', () => {
  const base = { org, role: 'admin', userId: 'u1', local: mem(), session: mem() }
  expect(shouldShowBrandNudge(base)).toBe(true)
  expect(shouldShowBrandNudge({ ...base, role: 'staff' })).toBe(false)
  expect(shouldShowBrandNudge({ ...base, org: { ...org, logo_url: 'x' } })).toBe(false)
  expect(shouldShowBrandNudge({ ...base, org: { ...org, branding_enabled: false } })).toBe(false)
  const local = mem(); local.setItem('ls_brand_nudge_o1_u1', String(Date.now() + 1000))
  expect(shouldShowBrandNudge({ ...base, local })).toBe(false)
  local.setItem('ls_brand_nudge_o1_u1', String(Date.now() - 1000))
  expect(shouldShowBrandNudge({ ...base, local })).toBe(true)
  local.setItem('ls_brand_nudge_o1_u1', 'never')
  expect(shouldShowBrandNudge({ ...base, local })).toBe(false)
  const session = mem(); session.setItem('ls_brand_nudge_seen_o1', '1')
  expect(shouldShowBrandNudge({ ...base, session })).toBe(false)
})

test('upload a logo, pick a colour from it, save both', async () => {
  const onSaved = jest.fn()
  render(<BrandNudge org={org} role="owner" userId="u1" onSaved={onSaved} />)
  expect(screen.getByRole('heading', { name: 'Make LaunchSession look like Solidarity Sports' })).toBeInTheDocument()
  const file = new File(['x'], 'logo.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Choose your logo'), { target: { files: [file] } })
  // The dark navy holds white text, so it comes first, over the pale yellow.
  expect(await screen.findByRole('radio', { name: '#1F2A44' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(screen.getByRole('radio', { name: '#D4C21A' }))
  fireEvent.click(screen.getByRole('radio', { name: '#1F2A44' }))
  fireEvent.click(screen.getByRole('button', { name: 'Use my logo and colour' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(mockUpdate).toHaveBeenCalledWith({ logo_url: 'https://cdn/o1/logo-uuid.png', primary_color: '#1F2A44' })
  expect(screen.getByRole('heading', { name: 'Looking good' })).toBeInTheDocument()
})

test('Later snoozes it and it only shows once per sign-in', () => {
  const { unmount } = render(<BrandNudge org={org} role="admin" userId="u1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(Number(window.localStorage.getItem('ls_brand_nudge_o1_u1'))).toBeGreaterThan(Date.now())
  unmount()
  window.localStorage.clear()
  render(<BrandNudge org={org} role="admin" userId="u1" />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
