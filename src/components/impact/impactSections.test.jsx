import React from 'react'
import { render, screen } from '@testing-library/react'
import { buildImpact, buildGoals } from './distanceTravelled'
import { Headline, AreaMovement, GoalsPanel, NeedsAttention, GroupComparison, PeopleList } from './impactSections'

// These assert that each section survives the shapes it will really be handed --
// including the awkward ones: nobody measured, a person with no pair, an area
// filter matching nothing. A redesign that throws on an empty org is worse than
// the page it replaced.

const terms = { person: 'young person', people: 'young people', Person: 'Young Person', People: 'Young People' }
const s = (child, area, score, daysAgo) => ({
  child_id: child, area, score,
  recorded_at: new Date(Date.now() - daysAgo * 864e5).toISOString(),
})

const children = [
  { id: 'a', first_name: 'Ada', last_name: 'Lovelace', group_name: 'Tuesday Club' },
  { id: 'b', first_name: 'Blaise', last_name: 'Pascal', group_name: 'Tuesday Club' },
  { id: 'c', first_name: 'Cleo', last_name: 'Nunn', group_name: 'Friday Squad' },
  { id: 'd', first_name: 'Dev', last_name: 'Rao', group_name: 'Friday Squad' },
  { id: 'e', first_name: 'Unmeasured', last_name: 'Person', group_name: null },
]
const scores = [
  s('a', 'confidence', 3, 200), s('a', 'confidence', 8, 5),
  s('a', 'wellbeing', 4, 200), s('a', 'wellbeing', 7, 5),
  s('b', 'confidence', 5, 200), s('b', 'confidence', 5, 5),
  s('c', 'confidence', 7, 200), s('c', 'confidence', 3, 5),
  s('d', 'confidence', 2, 200), s('d', 'confidence', 8, 5),
  s('e', 'confidence', 6, 30),
]
const impact = buildImpact(scores, children, null)
const nameFor = (id) => {
  const c = children.find(x => x.id === id)
  return c ? `${c.first_name} ${c.last_name}` : 'Unknown'
}
const noop = () => {}

describe('Headline', () => {
  it('leads with how many improved out of how many were measured', () => {
    render(<Headline impact={impact} terms={terms} periodLabel="in the last 12 months" isMobile={false} />)
    // a and d improved, b held, c declined -> 2 of 4.
    expect(screen.getByText(/2 of 4/)).toBeInTheDocument()
  })

  it('says so plainly when nothing can be measured yet', () => {
    const empty = buildImpact([s('a', 'confidence', 5, 10)], children, null)
    render(<Headline impact={empty} terms={terms} periodLabel="in the last 12 months" isMobile={false} />)
    expect(screen.getByText(/Nothing has been measured yet/i)).toBeInTheDocument()
  })

  it('does not crash with no data at all', () => {
    const none = buildImpact([], [], null)
    expect(() => render(<Headline impact={none} terms={terms} periodLabel="all time" isMobile={false} />)).not.toThrow()
  })
})

describe('AreaMovement', () => {
  it('lists each measured area with its change', () => {
    render(<AreaMovement impact={impact} isMobile={false} activeArea={null} onSelectArea={noop} />)
    expect(screen.getByText('Confidence')).toBeInTheDocument()
    expect(screen.getByText('Wellbeing')).toBeInTheDocument()
  })

  it('renders nothing rather than an empty frame when no area has a pair', () => {
    const { container } = render(
      <AreaMovement impact={buildImpact([], [], null)} isMobile={false} activeArea={null} onSelectArea={noop} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('GoalsPanel', () => {
  it('shows completed, active and overdue counts', () => {
    const goals = buildGoals([
      { id: '1', title: 'Join a club', status: 'completed', completed_at: new Date().toISOString() },
      { id: '2', title: 'Attend weekly', status: 'active', target_date: '2020-01-01' },
    ], null)
    render(<GoalsPanel goals={goals} childName="young person" periodLabel="in the last 12 months" />)
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('past target date')).toBeInTheDocument()
    expect(screen.getByText('Join a club')).toBeInTheDocument()
  })

  it('handles an org with no goals', () => {
    expect(() => render(
      <GoalsPanel goals={buildGoals([], null)} childName="young person" periodLabel="all time" />)).not.toThrow()
  })
})

describe('NeedsAttention', () => {
  it('names whoever declined', () => {
    render(<NeedsAttention impact={impact} terms={terms} childName="young person" nameFor={nameFor} onOpenChild={noop} />)
    expect(screen.getByText('Cleo Nunn')).toBeInTheDocument()
  })

  it('stays hidden when there is nothing to flag', () => {
    const good = buildImpact([s('a', 'confidence', 2, 60), s('a', 'confidence', 9, 1)], children, null)
    const { container } = render(
      <NeedsAttention impact={good} terms={terms} childName="young person" nameFor={nameFor} onOpenChild={noop} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('GroupComparison', () => {
  it('compares groups that have at least two measured', () => {
    render(<GroupComparison impact={impact} children={children} isMobile={false} />)
    expect(screen.getByText('Tuesday Club')).toBeInTheDocument()
    expect(screen.getByText('Friday Squad')).toBeInTheDocument()
  })

  it('renders nothing when there is only one group to compare', () => {
    const single = children.map(c => ({ ...c, group_name: 'Only Group' }))
    const { container } = render(<GroupComparison impact={impact} children={single} isMobile={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PeopleList', () => {
  it('lists everyone on the register, measured or not', () => {
    render(<PeopleList impact={impact} children={children} terms={terms} primary="#1B9AAA"
      onOpenChild={noop} areaFilter={null} isMobile={false} />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Unmeasured Person')).toBeInTheDocument()
    expect(screen.getByText('not measured yet')).toBeInTheDocument()
  })

  it('narrows to an area when one is selected', () => {
    render(<PeopleList impact={impact} children={children} terms={terms} primary="#1B9AAA"
      onOpenChild={noop} areaFilter="wellbeing" isMobile={false} />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Blaise Pascal')).not.toBeInTheDocument()
  })
})
