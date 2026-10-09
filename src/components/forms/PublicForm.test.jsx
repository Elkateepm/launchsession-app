import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import PublicForm, { minutesFor } from './PublicForm'
import { supabase } from '../../lib/supabase'
import { REPORT_FORMS } from '../incidents/reportForms'

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }))

const concern = REPORT_FORMS.find(f => f.creates_record === 'concern')
const injury = REPORT_FORMS.find(f => f.creates_record === 'injury')

function openForm(form) {
  window.history.pushState({}, '', '/forms/riverside/f1')
  supabase.rpc.mockResolvedValue({ data: [{ id: 'f1', ...form, org_name: 'Riverside Youth Club', org_primary_color: '#0E7C86', org_secondary_color: '#F6B44B', multi_step: false }], error: null })
  render(<PublicForm />)
}

test('a safeguarding form says to call 999 before the first question', async () => {
  openForm(concern)
  expect(await screen.findByRole('heading', { name: 'Raise a safeguarding concern' })).toBeInTheDocument()
  expect(screen.getByRole('note')).toHaveTextContent('If a child is in immediate danger, call 999 now.')
  expect(screen.getByRole('link', { name: 'Call 999' })).toHaveAttribute('href', 'tel:999')
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  expect(await screen.findByRole('note')).toHaveTextContent('call 999 now')
})

test('an injury form has no 999 note, and gives an honest time', async () => {
  openForm(injury)
  expect(await screen.findByRole('heading', { name: 'Report an injury' })).toBeInTheDocument()
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  expect(screen.getByText('About 5 minutes')).toBeInTheDocument()
})

test('long written answers count for more than a tick box', () => {
  expect(minutesFor(injury.fields)).toBe(5)
  expect(minutesFor(concern.fields)).toBe(4)
  expect(minutesFor([{ type: 'checkbox' }])).toBe(1)
})
