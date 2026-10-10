import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import RAOverview from './RAOverview'

jest.mock('../../context/OrgContext', () => ({ useTerms: () => ({ Session: 'Activity', sessions: 'activities' }) }))
const ready = { id: 'a1', name: 'Football plan', status: 'active', approval_required: false, next_review_date: '2027-01-01', risk_rating: 'low' }
const session = { id: 's1', title: 'Teens october half term — Day 1', session_date: '2026-10-26', start_time: '12:00', risk_assessment_required: true }
const props = () => ({ assessments: [ready], sessions: [session], onOpen: jest.fn(), onCreateForSession: jest.fn(), onReuseForSession: jest.fn(), onSafetyFilter: jest.fn(), onSearch: jest.fn(), onBrowse: jest.fn(), canEdit: true, canApprove: true })
beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-10T12:00:00Z')))
afterEach(() => jest.useRealTimers())

test('future missing assessments offer creation and reuse with the exact activity', () => {
  const p = props(); render(<RAOverview {...p} />)
  const coming = within(screen.getByRole('region', { name: 'Upcoming activity checks' }))
  expect(coming.getByText(session.title)).toBeInTheDocument()
  fireEvent.click(coming.getByRole('button', { name: 'Create' }))
  expect(p.onCreateForSession).toHaveBeenCalledWith(session)
  fireEvent.click(coming.getByRole('button', { name: 'Use previous' }))
  expect(p.onReuseForSession).toHaveBeenCalledWith(session)
})

test('status shortcuts and recent assessments open the corresponding work', () => {
  const p = props(); render(<RAOverview {...p} />)
  fireEvent.click(screen.getByRole('button', { name: 'Up to date: 1. View assessments' }))
  expect(p.onSafetyFilter).toHaveBeenCalledWith('ready')
  fireEvent.click(screen.getByRole('button', { name: /Football plan/ }))
  expect(p.onOpen).toHaveBeenCalledWith(ready)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search recent assessments' }), { target: { value: 'Football' } })
  expect(p.onSearch).toHaveBeenCalledWith('Football')
  fireEvent.click(screen.getByRole('button', { name: 'View all assessments' }))
  expect(p.onBrowse).toHaveBeenCalled()
})

test('partial data never produces ready counts or invented missing links', () => {
  render(<RAOverview {...props()} unavailable={['assessment links', 'controls']} />)
  expect(screen.getByRole('button', { name: 'Up to date: unavailable. View assessments' })).toBeDisabled()
  expect(screen.getByText('Checks are incomplete')).toBeInTheDocument()
  expect(screen.queryByText('No immediate follow-ups found')).not.toBeInTheDocument()
  expect(screen.queryByText('Assessment to add')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
})

test('viewers get view actions without creation or approval promises', () => {
  const assessment = { ...ready, id: 'needs-approval', approval_required: true }
  render(<RAOverview {...props()} assessments={[assessment]} canEdit={false} canApprove={false} />)
  expect(screen.queryByRole('button', { name: /Create|Use previous|Approve/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View assessment' })).toBeInTheDocument()
})

test('uncovered near-term activities are only shown once and extra actions can be revealed', () => {
  const sessions = Array.from({ length: 8 }, (_, i) => ({ ...session, id: `s${i}`, title: `Day ${i}`, session_date: '2026-10-11' }))
  render(<RAOverview {...props()} sessions={sessions} />)
  expect(screen.getAllByRole('button', { name: 'Create Assessment' })).toHaveLength(5)
  fireEvent.click(screen.getByRole('button', { name: 'Show all 8 follow-ups' }))
  expect(screen.getAllByRole('button', { name: 'Create Assessment' })).toHaveLength(8)
  expect(screen.getAllByText('Day 0')).toHaveLength(1)
})
