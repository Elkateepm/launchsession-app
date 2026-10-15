import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import FormBuilder from './FormBuilder'
import { supabase } from '../../lib/supabase'
import { formIssues, templateDraft } from './formBuilderUtils'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
const org = { id: 'org-one', name: 'Test organisation', primary_color: '#275D5A' }
const valid = { id: 'form-one', name: 'Feedback', fields: [{ id: 'q-one', label: 'Your thoughts', type: 'text', required: true }] }
let writes, fail, filters
beforeEach(() => {
  writes = []; filters = []; fail = false
  window.innerWidth = 1440
  supabase.from.mockImplementation(table => {
    const query = {
      select: () => query, order: () => query, not: () => query, limit: () => query,
      eq: (key, value) => { filters.push([table, key, value]); return query },
      insert: payload => { writes.push({ table, payload, insert: true }); return query },
      update: payload => { writes.push({ table, payload }); return query },
      single: async () => { if (fail) throw new Error('Offline'); return { data: { id: 'form-one' }, error: null } },
      then: resolve => resolve({ data: [], error: null }),
    }
    return query
  })
})

test('review blocks empty forms and offers a route back to missing questions', () => {
  render(<FormBuilder org={org} />)
  fireEvent.click(screen.getByRole('button', { name: 'Review form' }))
  expect(screen.getByRole('button', { name: 'Publish form' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add at least one question.' }))
  expect(screen.getByText('A good form starts here.')).toBeInTheDocument()
})

test('questions with duplicate titles or incomplete choices cannot be published', () => {
  const issues = formIssues({ name: 'Example', fields: [{ id: '1', type: 'text', label: 'Name' }, { id: '2', type: 'select', label: ' name ', options: ['One', ''] }], closing_date: '2025-01-01' }, '2026-10-15')
  expect(issues.map(i => i.message)).toEqual(['Give question 2 a unique title.', 'Finish the answer choices for question 2.', 'Choose a closing date that has not passed.'])
})

test('template helper text, choices and record mappings survive starting a form', () => {
  const result = templateDraft({ title: 'Example', fields: [{ type: 'select', label: 'Group', options: ['A'], help: 'Choose your group', mapsTo: 'group_name' }] }, () => 'new-id')
  expect(result.fields[0]).toMatchObject({ id: 'new-id', description: 'Choose your group', mapsTo: 'group_name', options: ['A'] })
})

test('a failed save keeps the builder open with a recoverable warning', async () => {
  const onCancel = jest.fn()
  fail = true
  render(<FormBuilder org={org} initial={valid} onCancel={onCancel} />)
  fireEvent.change(screen.getByLabelText('Form name'), { target: { value: 'Updated feedback' } })
  fireEvent.click(screen.getByRole('button', { name: 'All forms' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your latest changes have not been saved.')
  expect(onCancel).not.toHaveBeenCalled()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'All forms' }))
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
  expect(filters).toContainEqual(['org_forms', 'org_id', org.id])
})

test('a failed publish does not mark the draft active and can be retried', async () => {
  const onSave = jest.fn()
  fail = true
  render(<FormBuilder org={org} initial={valid} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Review form' }))
  fireEvent.click(screen.getByRole('button', { name: 'Publish form' }))
  expect(await screen.findByText("Couldn't save")).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByText('Draft', { exact: true })).toBeInTheDocument()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Publish form' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  expect(onSave.mock.calls[0][0]).toMatchObject({ status: 'active', id: 'form-one' })
})

test('recipients establish a new draft id once before reading its org-scoped recipients', async () => {
  render(<FormBuilder org={org} />)
  fireEvent.change(screen.getByLabelText('Form name'), { target: { value: 'New form' } })
  fireEvent.click(screen.getByRole('button', { name: /2 Recipients/ }))
  await screen.findByText('Who is this for?')
  expect(writes.filter(w => w.insert)).toHaveLength(1)
  expect(filters).toContainEqual(['form_recipients', 'org_id', org.id])
})

test('mobile editing has a labelled dialog and can be completed without hover', () => {
  window.innerWidth = 390
  render(<FormBuilder org={org} />)
  fireEvent.click(screen.getByRole('button', { name: /Start from scratch/ }))
  const dialog = screen.getByRole('dialog', { name: 'Edit question' })
  fireEvent.change(within(dialog).getByLabelText('QUESTION'), { target: { value: 'Your name' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit question 1: Your name' })).toBeInTheDocument()
})

test('preview uses the actual consent wording and never writes a submission', async () => {
  render(<FormBuilder org={org} initial={{ ...valid, fields: [{ id: 'consent', label: 'I agree to attend', type: 'checkbox', required: true }] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Review form' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to attend *' }))
  await act(async () => fireEvent.submit(screen.getByRole('button', { name: /Test submission/ }).closest('form')))
  expect(screen.getByRole('heading', { name: 'Thank you!' })).toBeInTheDocument()
  expect(writes).toHaveLength(0)
  expect(supabase.rpc).not.toHaveBeenCalled()
})

test('unfinished changes to a live form do not overwrite the published version', async () => {
  const onCancel = jest.fn()
  render(<FormBuilder org={org} initial={{ ...valid, status: 'active' }} onCancel={onCancel} />)
  fireEvent.click(screen.getByRole('button', { name: 'Short answer', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'All forms' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your latest changes have not been saved.')
  expect(writes).toHaveLength(0)
  expect(onCancel).not.toHaveBeenCalled()
})
