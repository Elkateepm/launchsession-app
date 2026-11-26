import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AddYoungPeopleModal from './AddYoungPeopleModal'

const inserts = {}
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: t => ({ insert: rows => { inserts[t] = rows; return Promise.resolve({ error: null }) } }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'staff1' } } }) },
  },
}))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const org = { id: 'o1' }
const typeIn = (label, value, i = 0) => fireEvent.change(screen.getAllByLabelText(label)[i], { target: { value } })

test('adds two siblings in one go with shared family details and their own consents', async () => {
  const onAdded = jest.fn()
  render(<AddYoungPeopleModal org={org} groups={['Juniors']} onClose={jest.fn()} onAdded={onAdded} />)
  typeIn('Name', 'Amina Khan')
  typeIn('Phone', '07700 900123')
  typeIn('First name *', 'Sara')
  typeIn('Last name', 'Khan')
  typeIn('Date of birth', '2015-02-01')
  expect(screen.getByLabelText('School year')).toHaveValue('Year 7')
  fireEvent.change(screen.getByLabelText('Ethnicity'), { target: { value: 'Pakistani' } })
  fireEvent.click(screen.getByRole('switch', { name: 'Photos' }))

  fireEvent.click(screen.getByRole('button', { name: /Add a brother or sister/ }))
  // The new card opens with the surname already filled in.
  expect(screen.getByLabelText('Last name')).toHaveValue('Khan')
  typeIn('First name *', 'Omar')
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 young people' }))

  await waitFor(() => expect(onAdded).toHaveBeenCalled())
  const kids = inserts.children
  expect(kids.map(k => k.first_name)).toEqual(['Sara', 'Omar'])
  expect(kids[0].family_id).toBeTruthy()
  expect(kids[0].family_id).toBe(kids[1].family_id)
  expect(kids.every(k => k.parent_phone === '07700 900123')).toBe(true)
  expect(kids[0]).toMatchObject({ ethnicity: 'Pakistani', year_group: 'Year 7' })
  const photo = inserts.child_consents.filter(c => c.consent_type === 'photo')
  expect(photo.map(c => c.status)).toEqual(['granted', 'not_granted'])
  expect(photo[0].child_id).toBe(kids[0].id)
})

test('one young person gets no family id, and needs a first name to save', () => {
  render(<AddYoungPeopleModal org={org} onClose={jest.fn()} onAdded={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Add young person' })).toBeDisabled()
})
