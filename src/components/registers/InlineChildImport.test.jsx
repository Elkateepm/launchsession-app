import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { InlineChildImport } from './Registers'
import { supabase } from '../../lib/supabase'

// Importing Registers.jsx pulls in modules that touch supabase at load time,
// so the mock has to be complete enough to import, not just to call.
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(),
    storage: { from: jest.fn(() => ({ createSignedUrl: jest.fn().mockResolvedValue({ data: null }) })) },
    channel: jest.fn(() => ({ on() { return this }, subscribe() { return this }, unsubscribe: jest.fn() })),
    removeChannel: jest.fn(),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const org = { id: 'org-1', name: 'Solidarity Sports', primary_color: '#4714ff' }
const groups = [{ label: 'Tigers' }, { label: 'bears' }]
const existingChildren = [{ id: 'c1', first_name: 'Jane', last_name: 'Smith' }]

// The shape a register actually arrives in: a school's column names, a UK date,
// a group whose capitalisation drifted, a child already on the register, a row
// with no surname, and a group that does not exist yet.
const MESSY = [
  'Surname,Forename,DOB,Class,Allergies',
  'Smith,Jane,14/05/2012,Tigers,Peanuts',
  'Chen,River,02/09/2013,tigers,',
  'Osman,Jineen,21/11/2014,Pandas,',
  ',Noor,03/03/2015,Tigers,',
].join('\n')

beforeEach(() => {
  // CRA sets resetMocks: true, which strips the implementations given in the
  // jest.mock factory above, so they are re-applied here rather than there.
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ inserted: 2 }) })
  const order = jest.fn().mockResolvedValue({ data: [], error: null })
  const eq2 = jest.fn(() => ({ order }))
  const eq1 = jest.fn(() => ({ eq: eq2 }))
  supabase.from.mockReturnValue({ select: jest.fn(() => ({ eq: eq1 })) })
})

const paste = (text) => {
  const box = screen.getByPlaceholderText(/paste rows straight from a spreadsheet/i)
  fireEvent.change(box, { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /Check/i }))
}

describe('InlineChildImport', () => {
  it('reads a school export without being told what the columns mean', async () => {
    render(<InlineChildImport org={org} groups={groups} existingChildren={existingChildren} onImported={() => {}} />)
    paste(MESSY)

    await screen.findByText(/Check the columns/i)
    const selects = screen.getAllByRole('combobox')
    expect(selects.map(s => s.value)).toEqual(['last_name', 'first_name', 'date_of_birth', 'group_name', 'allergies'])
  })

  it('separates what will import, what is already there, and what it cannot use', async () => {
    render(<InlineChildImport org={org} groups={groups} existingChildren={existingChildren} onImported={() => {}} />)
    paste(MESSY)

    // Jane Smith is already on the register; the last row has no surname.
    expect(await screen.findByText('2 ready to import')).toBeInTheDocument()
    expect(screen.getByText('1 already on the register')).toBeInTheDocument()
    expect(screen.getByText('1 cannot be imported')).toBeInTheDocument()
    expect(screen.getByText(/Row 5/)).toBeInTheDocument()
    expect(screen.getByText('No surname')).toBeInTheDocument()
  })

  it('names the group that does not exist yet', async () => {
    render(<InlineChildImport org={org} groups={groups} existingChildren={existingChildren} onImported={() => {}} />)
    paste(MESSY)
    expect(await screen.findByText('1 new group')).toBeInTheDocument()
    expect(screen.getByText('Pandas')).toBeInTheDocument()
  })

  it('posts normalised records: UK dates as ISO, the group matched to the existing one', async () => {
    render(<InlineChildImport org={org} groups={groups} existingChildren={existingChildren} onImported={() => {}} />)
    paste(MESSY)

    fireEvent.click(await screen.findByRole('button', { name: /Import 2 children/i }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.org_id).toBe('org-1')
    expect(body.records).toEqual([
      expect.objectContaining({ first_name: 'River', last_name: 'Chen', date_of_birth: '2013-09-02', group_name: 'Tigers', active: true }),
      expect.objectContaining({ first_name: 'Jineen', last_name: 'Osman', date_of_birth: '2014-11-21', group_name: 'Pandas' }),
    ])
  })

  it('will add a duplicate only when asked', async () => {
    render(<InlineChildImport org={org} groups={groups} existingChildren={existingChildren} onImported={() => {}} />)
    paste(MESSY)

    await screen.findByText('2 ready to import')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Import 3 children/i }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    const names = JSON.parse(global.fetch.mock.calls[0][1].body).records.map(r => r.first_name)
    expect(names).toContain('Jane')
  })

  it('refuses to import until a name column is chosen', async () => {
    render(<InlineChildImport org={org} groups={groups} existingChildren={[]} onImported={() => {}} />)
    paste('Reference,Class\nABC123,Tigers')

    await screen.findByText(/Check the columns/i)
    expect(screen.getByText(/Point one column at/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nothing to import|Import/i })).toBeDisabled()
  })

  it('lets you correct a column the detector got wrong', async () => {
    render(<InlineChildImport org={org} groups={groups} existingChildren={[]} onImported={() => {}} />)
    paste('Reference,Class\nSmith Jane,Tigers')

    await screen.findByText(/Check the columns/i)
    const [refSelect] = screen.getAllByRole('combobox')
    fireEvent.change(refSelect, { target: { value: 'full_name' } })

    expect(await screen.findByText('1 ready to import')).toBeInTheDocument()
  })

  it('splits a single Name column and reports the total it added', async () => {
    const onImported = jest.fn()
    render(<InlineChildImport org={org} groups={groups} existingChildren={[]} onImported={onImported} />)
    paste('Name,Class\n"Baptiste, Aaliyah",Tigers')

    fireEvent.click(await screen.findByRole('button', { name: /Import 1 child/i }))
    await waitFor(() => expect(onImported).toHaveBeenCalled())

    const [record] = JSON.parse(global.fetch.mock.calls[0][1].body).records
    expect(record).toMatchObject({ first_name: 'Aaliyah', last_name: 'Baptiste' })
    expect(onImported.mock.calls[0][1]).toBe(1)
  })
})
