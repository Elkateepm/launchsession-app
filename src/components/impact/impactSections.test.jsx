import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { buildWorklist } from './distanceTravelled'
import { ToDo, ReportsLink, PeopleToRecord } from './impactSections'

// The recording page has to survive the shapes it is really handed: nothing
// due, nobody measured, a list longer than it shows.

const terms = { person: 'young person', people: 'young people', Person: 'Young Person', People: 'Young People' }
const s = (child, area, score, daysAgo) => ({ child_id: child, area, score, recorded_at: new Date(Date.now() - daysAgo * 864e5).toISOString() })
const children = [
  { id: 'a', first_name: 'Ada', last_name: 'Lovelace' },
  { id: 'b', first_name: 'Blaise', last_name: 'Pascal' },
  { id: 'c', first_name: 'Cleo', last_name: 'Nunn' },
  { id: 'e', first_name: 'Unmeasured', last_name: 'Person' },
]
const scores = [
  s('a', 'confidence', 3, 200), s('a', 'confidence', 8, 5),
  s('b', 'wellbeing', 4, 60),
  s('c', 'confidence', 7, 200), s('c', 'confidence', 3, 5),
]
const goals = [{ id: 'g1', child_id: 'a', title: 'Lead a warm-up', target_date: '2000-01-01', status: 'active' }]
const work = buildWorklist(scores, children, goals)
const nameFor = id => { const c = children.find(x => x.id === id); return c ? `${c.first_name} ${c.last_name}` : 'Unknown' }

describe('ToDo', () => {
  it('groups who needs what, with a record button for each person', () => {
    const onRecord = jest.fn()
    render(<ToDo work={work} nameFor={nameFor} onOpenChild={jest.fn()} onRecord={onRecord} terms={terms} primary="#0E7C86" />)
    const fell = screen.getByRole('region', { name: 'Scores fell' })
    expect(within(fell).getByText('Cleo Nunn')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Due a follow-up reading' })).toHaveTextContent('Blaise Pascal')
    fireEvent.click(within(fell).getByRole('button', { name: 'Record' }))
    expect(onRecord).toHaveBeenCalledWith('c')
  })

  it('opens an overdue goal on the person’s Goals tab', () => {
    const onOpenChild = jest.fn()
    render(<ToDo work={work} nameFor={nameFor} onOpenChild={onOpenChild} onRecord={jest.fn()} terms={terms} primary="#0E7C86" />)
    const g = screen.getByRole('region', { name: 'Goals past their target date' })
    expect(within(g).queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
    fireEvent.click(within(g).getByText('Ada Lovelace'))
    expect(onOpenChild).toHaveBeenCalledWith('a', 'goals')
  })

  it('has no record buttons for someone who cannot record', () => {
    render(<ToDo work={work} nameFor={nameFor} onOpenChild={jest.fn()} onRecord={null} terms={terms} primary="#0E7C86" />)
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
  })

  it('says so when nothing is due', () => {
    render(<ToDo work={buildWorklist([], children, [])} nameFor={nameFor} onOpenChild={jest.fn()} terms={terms} primary="#0E7C86" />)
    expect(screen.getByText('Nothing due')).toBeInTheDocument()
  })

  it('shows four and offers the rest', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: 'p' + i, first_name: 'P' + i, last_name: 'Q' }))
    const w = buildWorklist(many.map(c => s(c.id, 'confidence', 5, 60)), many, [])
    render(<ToDo work={w} nameFor={id => id} onOpenChild={jest.fn()} terms={terms} primary="#0E7C86" />)
    expect(screen.getAllByText(/^p\d$/)).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7' }))
    expect(screen.getAllByText(/^p\d$/)).toHaveLength(7)
  })
})

describe('ReportsLink', () => {
  it('sums up and opens the impact report', () => {
    const onOpenReport = jest.fn()
    render(<ReportsLink totals={work.totals} terms={terms} onOpenReport={onOpenReport} onOpenReports={jest.fn()} />)
    expect(screen.getByText(/2 young people measured twice or more · 1 improved · 1 goal in progress/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open the impact report' }))
    expect(onOpenReport).toHaveBeenCalled()
  })

  it('offers no buttons to someone without Reports', () => {
    render(<ReportsLink totals={work.totals} terms={terms} onOpenReport={null} onOpenReports={null} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('PeopleToRecord', () => {
  const props = { children, work, terms, primary: '#0E7C86', onOpenChild: jest.fn(), onRecord: jest.fn() }

  it('lists everyone on the register, measured or not', () => {
    render(<PeopleToRecord {...props} />)
    for (const c of children) expect(screen.getByText(`${c.first_name} ${c.last_name}`)).toBeInTheDocument()
    expect(screen.getByText('No readings yet')).toBeInTheDocument()
  })

  it('filters to the people with something to do', () => {
    render(<PeopleToRecord {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^To do/ }))
    expect(screen.getByText('Blaise Pascal')).toBeInTheDocument()
    expect(screen.getByText('Cleo Nunn')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Not measured yet/ }))
    expect(screen.getByText('Unmeasured Person')).toBeInTheDocument()
    expect(screen.queryByText('Cleo Nunn')).not.toBeInTheDocument()
  })

  it('searches by name', () => {
    render(<PeopleToRecord {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search young people' }), { target: { value: 'ada' } })
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Blaise Pascal')).not.toBeInTheDocument()
  })
})
