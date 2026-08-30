import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InjuryForm from './InjuryForm'

// jest hoists the mock factory above the imports, so anything it closes over
// has to be mock-prefixed to be allowed out of scope.
const mockInsert = jest.fn()
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
      insert: (rows) => { mockInsert(table, rows); return Promise.resolve({ error: null }) },
    }),
  },
}))

const org = { id: 'o1', name: 'Solidarity Sports', primary_color: '#6D5DF6' }
const people = [
  { id: 'c1', first_name: 'Ada', last_name: 'Lovelace', group_name: 'Tigers', active: true },
  { id: 'c2', first_name: 'Gone', last_name: 'Away', active: false },
]

const setup = (props = {}) => render(
  <InjuryForm org={org} people={people} userProfile={{ id: 'u1', full_name: 'Sophie Rogers' }}
    onClose={() => {}} {...props} />)

beforeEach(() => mockInsert.mockClear())

describe('the questions an insurer would ask', () => {
  it('asks what happened, the injury, the parent and the follow-up', () => {
    setup()
    for (const heading of ['Who and when', 'What happened', 'The injury', 'Parent or carer', 'Follow-up']) {
      expect(screen.getByText(heading)).toBeInTheDocument()
    }
  })

  it('offers a body map and a list, both writing the same field', () => {
    setup()
    expect(screen.getByLabelText(/body diagram/i)).toBeInTheDocument()
    // Two controls carry the same region: the shape on the diagram and the
    // chip in the list. The list is not decoration -- a diagram alone would be
    // unusable with a screen reader or a keyboard.
    const both = screen.getAllByRole('button', { name: 'Head or face' })
    expect(both.length).toBe(2)
    expect(both.some(el => el.tagName.toLowerCase() === 'circle')).toBe(true)
    expect(both.some(el => el.tagName.toLowerCase() === 'button')).toBe(true)
  })

  it('leaves out anyone no longer active', () => {
    setup()
    expect(screen.queryByText(/Gone Away/)).not.toBeInTheDocument()
  })
})

describe('what it refuses to save', () => {
  it('will not save without saying who it happened to', async () => {
    setup()
    fireEvent.click(screen.getByText('Save to accident book'))
    await waitFor(() => expect(screen.getByText(/Choose the young person/i)).toBeInTheDocument())
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('will not save without an account of what happened', async () => {
    setup({ initialChildId: 'c1' })
    fireEvent.click(screen.getByText('Save to accident book'))
    await waitFor(() => expect(screen.getByText('Describe what happened.')).toBeInTheDocument())
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('what it writes', () => {
  it('never sends org_id or reported_by from the client', async () => {
    // Both are defaulted by the database from the caller's own identity. A
    // value the client can choose is exactly what the policies exist to stop.
    setup({ initialChildId: 'c1' })
    fireEvent.change(screen.getByPlaceholderText(/In your own words/), { target: { value: 'Tripped on the step.' } })
    fireEvent.click(screen.getByText('Save to accident book'))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    const [table, rows] = mockInsert.mock.calls[0]
    expect(table).toBe('child_injuries')
    expect(rows[0]).not.toHaveProperty('org_id')
    expect(rows[0]).not.toHaveProperty('reported_by')
    expect(rows[0].what_happened).toBe('Tripped on the step.')
  })

  it('records that the parent has not been told, rather than leaving it blank', async () => {
    setup({ initialChildId: 'c1' })
    fireEvent.change(screen.getByPlaceholderText(/In your own words/), { target: { value: 'Bumped head.' } })
    fireEvent.click(screen.getByText('Save to accident book'))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    const row = mockInsert.mock.calls[0][1][0]
    expect(row.parent_notified).toBe(false)
    expect(row.parent_notified_at).toBeNull()
  })

  it('stamps the time and the person when the parent has been told', async () => {
    setup({ initialChildId: 'c1' })
    fireEvent.change(screen.getByPlaceholderText(/In your own words/), { target: { value: 'Grazed knee.' } })
    fireEvent.click(screen.getByText('They have been told'))
    fireEvent.click(screen.getByText('Save to accident book'))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    const row = mockInsert.mock.calls[0][1][0]
    expect(row.parent_notified).toBe(true)
    expect(row.parent_notified_at).toBeTruthy()
    expect(row.parent_notified_by).toBe('u1')
  })

  it('confirms afterwards whether the parent still needs telling', async () => {
    setup({ initialChildId: 'c1' })
    fireEvent.change(screen.getByPlaceholderText(/In your own words/), { target: { value: 'Nosebleed.' } })
    fireEvent.click(screen.getByText('Save to accident book'))
    await waitFor(() => expect(screen.getByText('Recorded in the accident book')).toBeInTheDocument())
    expect(screen.getByText(/has not been told yet/)).toBeInTheDocument()
  })
})
