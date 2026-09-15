import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AddPersonModal, OnboardingBoard, PeopleDirectory, PeopleOverview } from './PeopleHRPanels'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/storageUrl', () => ({ signOne: jest.fn() }))

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))

const people = [
  { id: 'alex', full_name: 'Alex Morgan', employment_type: 'employee', employment_status: 'active', is_active: true, job_title: 'Youth worker' },
  { id: 'sam', full_name: 'Sam Taylor', employment_type: 'volunteer', employment_status: 'active', is_active: true },
]
const data = { people, checks: [], onboarding: [], attention: [], leave: [], pending: 0, errors: {}, reload: jest.fn() }
const primary = '#6048C8'

test('an attention action opens the appropriate record without exposing disciplinary detail', () => {
  const onOpen = jest.fn()
  const item = { staff_id: 'alex', full_name: 'Alex Morgan', entity_type: 'disciplinary', entity_id: 'private-case', severity: 2, title: 'Private allegation text', detail: 'Private case notes' }
  render(<PeopleOverview data={{ ...data, attention: [item] }} primary={primary} onOpen={onOpen} onTab={() => {}} />)
  expect(screen.queryByText('Private allegation text')).not.toBeInTheDocument()
  expect(screen.queryByText('Private case notes')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Confidential HR follow-up/ }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ hr_staff_id: 'alex' }), 'disciplinary')
})

test('failed actions never report a cleared queue', () => {
  render(<PeopleOverview data={{ ...data, attention: null, errors: { attention: 'offline' } }} primary={primary} onOpen={() => {}} onTab={() => {}} />)
  expect(screen.getByText('The action list is unavailable.')).toBeInTheDocument()
  expect(screen.queryByText('No actions in this queue')).not.toBeInTheDocument()
})

test('the summary tiles navigate to their underlying workflows', () => {
  const onTab = jest.fn()
  render(<PeopleOverview data={data} primary={primary} onOpen={() => {}} onTab={onTab} />)
  fireEvent.click(screen.getByRole('button', { name: /Active team/ }))
  expect(onTab).toHaveBeenLastCalledWith('people', 'active')
  fireEvent.click(screen.getByRole('button', { name: /Checks to review/ }))
  expect(onTab).toHaveBeenLastCalledWith('compliance')
})

test('search and employment filters combine, then the person opens by stable HR ID', () => {
  const onOpen = jest.fn()
  render(<PeopleDirectory data={data} primary={primary} onOpen={onOpen} />)
  fireEvent.change(screen.getByLabelText('Filter people'), { target: { value: 'volunteer' } })
  expect(screen.queryByText('Alex Morgan')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'sam' } })
  fireEvent.click(screen.getByRole('button', { name: /Sam Taylor/ }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ hr_staff_id: 'sam', id: null }))
})

test('people without checklists appear in onboarding and open the checklist', () => {
  const onOpen = jest.fn()
  render(<OnboardingBoard data={data} primary={primary} onOpen={onOpen} onApprovals={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Sam Taylor/ }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ hr_staff_id: 'sam' }), 'onboarding')
})

test('read-only viewers cannot submit an add-person request', () => {
  render(<AddPersonModal org={{ id: 'org-a' }} primary={primary} canEdit={false} onClose={() => {}} onSaved={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: 'Add a person' })
  fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: 'New person' } })
  fireEvent.submit(within(dialog).getByRole('form', { name: 'Add person details' }))
  expect(within(dialog).getByRole('button', { name: /Save & open record/ })).toBeDisabled()
  expect(supabase.from).not.toHaveBeenCalled()
})
