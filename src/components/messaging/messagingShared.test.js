import {
  audienceOf, buildTimeline, dayLabel, displayName, initials, isUnread,
  latestByThread, listTime, notificationTargets, FILTERS,
} from './messagingShared'

const at = (iso) => new Date(iso).toISOString()

describe('audiences', () => {
  it('labels a volunteer direct message as direct, not as all staff', () => {
    expect(audienceOf('dm:abc').key).toBe('direct')
    expect(audienceOf('all_staff').key).toBe('all_staff')
    expect(audienceOf('something_old').key).toBe('general')
  })

  it('notifies staff and only the volunteer a direct message belongs to', () => {
    expect(notificationTargets('dm:vol-1')).toEqual({ roles: ['admin', 'owner', 'staff'], extraIds: ['vol-1'] })
    expect(notificationTargets('volunteers').roles).toEqual(['volunteer'])
  })

  it('filters by audience family', () => {
    const f = (key) => FILTERS.find(x => x.key === key).test
    expect(f('events')('event_staff')).toBe(true)
    expect(f('direct')('dm:x')).toBe(true)
    expect(f('staff')('team')).toBe(true)
    expect(f('staff')('volunteers')).toBe(false)
  })
})

describe('names', () => {
  it('prefers a preferred name with the surname', () => {
    expect(displayName({ preferred_name: 'Sam', first_name: 'Samuel', last_name: 'Ali', full_name: 'Samuel Ali' })).toBe('Sam Ali')
    expect(displayName({ full_name: 'Jo Bloggs' })).toBe('Jo Bloggs')
    expect(displayName(null)).toBe('Someone')
  })
  it('makes initials from first and last word', () => {
    expect(initials('Mary Anne Smith')).toBe('MS')
    expect(initials('Cher')).toBe('C')
    expect(initials('')).toBe('?')
  })
})

describe('dates', () => {
  const now = new Date('2026-09-15T12:00:00')
  it('labels days relative to now', () => {
    expect(dayLabel(new Date('2026-09-15T08:00:00'), now)).toBe('Today')
    expect(dayLabel(new Date('2026-09-14T23:30:00'), now)).toBe('Yesterday')
    expect(dayLabel(new Date('2026-09-12T10:00:00'), now)).toBe('Saturday')
    expect(dayLabel(new Date('2026-08-01T10:00:00'), now)).toBe('1 Aug')
    expect(dayLabel(new Date('2025-08-01T10:00:00'), now)).toBe('1 Aug 2025')
  })
  it('keeps list stamps short', () => {
    expect(listTime(new Date('2026-09-15T09:05:00'), now)).toBe('09:05')
    expect(listTime(new Date('2026-09-11T09:05:00'), now)).toBe('Fri')
  })
})

describe('buildTimeline', () => {
  const msgs = [
    { id: 1, sender_id: 'a', created_at: at('2026-09-14T10:00:00') },
    { id: 2, sender_id: 'a', created_at: at('2026-09-14T10:03:00') },
    { id: 3, sender_id: 'a', created_at: at('2026-09-14T10:20:00') },
    { id: 4, sender_id: 'b', created_at: at('2026-09-14T10:21:00') },
    { id: 5, sender_id: 'b', created_at: at('2026-09-15T09:00:00') },
  ]
  it('groups runs from one sender and splits on gaps, senders and days', () => {
    const items = buildTimeline(msgs)
    expect(items.map(i => i.type === 'day' ? 'day' : i.messages.map(m => m.id).join('+'))).toEqual(['day', '1+2', '3', '4', 'day', '5'])
  })
})

describe('unread', () => {
  const thread = { id: 't' }
  it('is unread when someone else wrote after the last visit', () => {
    const last = { sender_id: 'other', created_at: at('2026-09-15T10:00:00') }
    expect(isUnread(thread, last, at('2026-09-15T09:00:00'), 'me')).toBe(true)
    expect(isUnread(thread, last, at('2026-09-15T11:00:00'), 'me')).toBe(false)
    expect(isUnread(thread, { ...last, sender_id: 'me' }, null, 'me')).toBe(false)
    expect(isUnread(thread, null, null, 'me')).toBe(false)
  })
  it('picks the newest message per thread from a newest-first list', () => {
    const got = latestByThread([{ id: 3, thread_id: 'x' }, { id: 2, thread_id: 'y' }, { id: 1, thread_id: 'x' }])
    expect(got.x.id).toBe(3)
    expect(got.y.id).toBe(2)
  })
})
