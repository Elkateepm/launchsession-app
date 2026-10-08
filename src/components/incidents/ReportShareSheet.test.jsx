import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReportShareSheet from './ReportShareSheet'
import ReportChips from './ReportChips'
import { REPORT_FORMS } from './reportForms'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../shared/QRShareSheet', () => ({ QRCard: ({ title, url }) => <div data-testid="qr">{title} {url}</div> }))
jest.mock('./InjuryForm', () => () => null)

const org = { id: 'o1', slug: 'riverside', primary_color: '#0E7C86' }
let rows
const insert = jest.fn()

beforeEach(() => {
  rows = []
  insert.mockImplementation(newRows => { rows = [...rows, ...newRows.map((r, i) => ({ id: `new-${i}`, name: r.name, creates_record: r.creates_record }))]; return Promise.resolve({ error: null }) })
  supabase.from.mockImplementation(() => {
    const q = { select: () => q, eq: () => q, in: () => q, order: () => Promise.resolve({ data: rows, error: null }), insert }
    return q
  })
})

test('shows a link and code for each public report form, one at a time', async () => {
  rows = [{ id: 'f1', name: 'Report an injury', creates_record: 'injury' }, { id: 'f2', name: 'Raise a safeguarding concern', creates_record: 'concern' }]
  render(<ReportShareSheet org={org} userProfile={{ role: 'staff' }} onClose={jest.fn()} />)
  expect(await screen.findByTestId('qr')).toHaveTextContent('Report an injury http://localhost/forms/riverside/f1')
  fireEvent.click(screen.getByRole('button', { name: /Safeguarding/ }))
  expect(screen.getByTestId('qr')).toHaveTextContent('Raise a safeguarding concern http://localhost/forms/riverside/f2')
})

test('an admin can set up both report forms in one go', async () => {
  render(<ReportShareSheet org={org} userProfile={{ role: 'admin' }} onClose={jest.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Set up the report forms' }))
  await waitFor(() => expect(insert).toHaveBeenCalled())
  const created = insert.mock.calls[0][0]
  expect(created.map(f => f.creates_record)).toEqual(['injury', 'concern'])
  expect(created.every(f => f.org_id === 'o1' && f.visibility === 'public' && f.status === 'active')).toBe(true)
  // Every question names what it fills in, and nobody is shown a list of children.
  expect(created.flatMap(f => f.fields).every(q => q.mapsTo === q.id)).toBe(true)
  expect(created[0].fields.find(q => q.id === 'child_name').type).toBe('text')
  expect(await screen.findByTestId('qr')).toHaveTextContent('Report an injury')
})

test('staff are told to ask an admin rather than shown a button that would fail', async () => {
  render(<ReportShareSheet org={org} userProfile={{ role: 'staff' }} onClose={jest.fn()} />)
  expect(await screen.findByText(/An admin needs to set up/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Set up the report forms' })).not.toBeInTheDocument()
})

test('Share sits beside the two report chips for staff, not volunteers', () => {
  const { unmount } = render(<ReportChips org={org} userProfile={{ role: 'staff' }} people={[]} onRaiseConcern={jest.fn()} />)
  expect(screen.getByRole('button', { name: /Raise a concern/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Log an injury/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Share/ })).toBeInTheDocument()
  unmount()
  render(<ReportChips org={org} userProfile={{ role: 'volunteer' }} people={[]} onRaiseConcern={jest.fn()} />)
  expect(screen.queryByRole('button', { name: /Share/ })).not.toBeInTheDocument()
})

test('the standard forms match what the database trigger reads', () => {
  const injuryKeys = ['child_name', 'occurred_at', 'location', 'what_happened', 'injury_type', 'body_part', 'first_aid_given', 'treated_by', 'witnesses', 'reported_name', 'reported_contact']
  const concernKeys = ['child_name', 'date_of_incident', 'location', 'description', 'witnesses', 'reported_name', 'submitter_role', 'reported_contact']
  expect(REPORT_FORMS[0].fields.map(f => f.mapsTo)).toEqual(injuryKeys)
  expect(REPORT_FORMS[1].fields.map(f => f.mapsTo)).toEqual(concernKeys)
})
