import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import BrandingCentre from './BrandingCentre'
import { supabase } from '../../../lib/supabase'
import { prepareBrandImage } from '../../../lib/brandImage'
import { brandGuide, draftFromOrg, validateBrand } from './brandingModel'

jest.mock('../../../lib/supabase', () => ({ supabase: { from: jest.fn(), storage: { from: jest.fn() } } }))
jest.mock('../../../lib/brandImage', () => ({ BRAND_IMAGE_TYPES: ['image/png'], prepareBrandImage: jest.fn(), extensionFor: () => 'png' }))
jest.mock('./logoColours', () => ({ extractDominantColors: () => Promise.resolve([]) }))
const org = { id: 'org-a', name: 'Community Club', primary_color: '#315B46', branding_enabled: true }
let update, eq, select, upload
beforeEach(() => {
  update = jest.fn(); eq = jest.fn(); select = jest.fn().mockResolvedValue({ data: [{ id: org.id }], error: null })
  update.mockReturnValue({ eq }); eq.mockReturnValue({ select }); supabase.from.mockReturnValue({ update })
  upload = jest.fn().mockResolvedValue({ error: null })
  supabase.storage.from.mockReturnValue({ upload, getPublicUrl: path => ({ data: { publicUrl: `https://assets.example/${path}` } }) })
  URL.createObjectURL = jest.fn(() => 'blob:draft-logo'); URL.revokeObjectURL = jest.fn()
  if (!global.crypto) global.crypto = {}
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => 'unique-version' })
  jest.clearAllMocks()
})
const openIdentity = () => fireEvent.click(screen.getByRole('button', { name: 'Identity', exact: true }))
const orgNameField = () => screen.getByRole('textbox', { name: /Organisation name/ })
const editName = () => { openIdentity(); fireEvent.change(orgNameField(), { target: { value: 'New Club' } }) }
test('drafts update previews without writing, and comparison restores published values', () => {
  render(<BrandingCentre org={org} />); editName()
  expect(within(screen.getByTestId('brand-preview')).getByText('New Club')).toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Compare with published' }))
  expect(within(screen.getByTestId('brand-preview')).getByText(org.name)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm discard' }))
  expect(orgNameField()).toHaveValue(org.name)
})
test('publishing is scoped to the current organisation and updates the published snapshot', async () => {
  const refreshOrg = jest.fn().mockResolvedValue()
  render(<BrandingCentre org={org} refreshOrg={refreshOrg} />); editName()
  fireEvent.click(screen.getByRole('button', { name: 'Publish brand' }))
  await screen.findByText(/Your brand is published/)
  expect(supabase.from).toHaveBeenCalledWith('organisations')
  expect(eq).toHaveBeenCalledWith('id', 'org-a')
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Club', logo_url: null }))
  expect(refreshOrg).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Publish brand' })).toBeDisabled()
})
test.each([
  [{ data: [], error: null }, /not saved/],
  [{ data: null, error: { message: 'Permission denied' } }, /Permission denied/],
])('failed writes preserve the draft and do not report success', async (result, message) => {
  select.mockResolvedValue(result)
  render(<BrandingCentre org={org} />); editName()
  fireEvent.click(screen.getByRole('button', { name: 'Publish brand' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(orgNameField()).toHaveValue('New Club')
  expect(screen.queryByText(/Your brand is published/)).not.toBeInTheDocument()
})
test('a rejected network request exits saving and permits retry', async () => {
  select.mockRejectedValueOnce(new Error('Network unavailable'))
  render(<BrandingCentre org={org} />); editName()
  fireEvent.click(screen.getByRole('button', { name: 'Publish brand' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
  expect(screen.getByRole('button', { name: 'Publish brand' })).toBeEnabled()
})
test('a failed organisation refresh does not misreport a successful publication', async () => {
  render(<BrandingCentre org={org} refreshOrg={() => Promise.reject(new Error('Offline'))} />); editName()
  fireEvent.click(screen.getByRole('button', { name: 'Publish brand' }))
  await screen.findByText(/Refresh the app to load/)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
test('new image uploads use versioned org paths and stop the database update on failure', async () => {
  const image = new File(['png'], 'logo.png', { type: 'image/png' })
  prepareBrandImage.mockResolvedValue(image); upload.mockResolvedValue({ error: { message: 'Upload refused' } })
  render(<BrandingCentre org={{ ...org, logo_url: 'https://assets.example/old.png' }} />); openIdentity()
  fireEvent.change(screen.getByLabelText('Upload primary logo'), { target: { files: [image] } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish brand' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Publish brand' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload refused')
  expect(upload).toHaveBeenCalledWith('org-a/logo-unique-version.png', image, { contentType: 'image/png', upsert: false })
  expect(update).not.toHaveBeenCalled()
})
test('presets update draft colours and typography; reset includes all brand fields', () => {
  render(<BrandingCentre org={{ ...org, brand_font: 'lora', email_sender_name: 'Custom sender' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Colours', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: /Studio/ }))
  expect(screen.getByLabelText('Primary hex colour')).toHaveValue('#5947A8')
  fireEvent.click(screen.getByRole('button', { name: 'Defaults' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }))
  expect(screen.getByLabelText('Primary hex colour')).toHaveValue('#1B9AAA')
  expect(update).not.toHaveBeenCalled()
})
test('invalid colours cannot be published', async () => {
  render(<BrandingCentre org={org} />)
  fireEvent.click(screen.getByRole('button', { name: 'Colours', exact: true }))
  fireEvent.change(screen.getByLabelText('Primary hex colour'), { target: { value: '#ZZZZZZ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Publish brand' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('six-digit hex')
  expect(update).not.toHaveBeenCalled()
})
test('brand kit uses published data even when there are draft edits', () => {
  render(<BrandingCentre org={org} />); editName()
  fireEvent.click(screen.getByRole('button', { name: 'Brand kit', pressed: false }))
  expect(screen.getByRole('textbox', { name: 'Published brand details' }).value).toContain('Community Club')
  expect(screen.getByRole('textbox', { name: 'Published brand details' }).value).not.toContain('New Club')
})
test('downloadable guide escapes organisation text and rejects executable asset links', () => {
  const guide = brandGuide(draftFromOrg({ ...org, name: '<script>alert(1)</script>', logo_url: 'javascript:alert(1)' }))
  expect(guide).not.toContain('<script>'); expect(guide).not.toContain('javascript:')
  expect(guide).toContain('&lt;script&gt;')
  expect(validateBrand(draftFromOrg({ ...org, primary_color: '#12345z' }))).toMatch(/six-digit/)
})
