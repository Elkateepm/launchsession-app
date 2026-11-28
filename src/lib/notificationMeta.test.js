import { groupNotifications, notifDestination } from './notificationMeta'

test('repeats on the same day collapse into one row that carries them', () => {
  const now = new Date().toISOString()
  const a = { id: '1', category: 'reflections', title: 'Reflection due', body: 'Football', created_at: now }
  const b = { ...a, id: '2' }
  const c = { id: '3', category: 'sessions', title: 'Session updated', body: 'Art', created_at: now }
  const [today] = groupNotifications([a, b, c])
  expect(today.label).toBe('Today')
  expect(today.items).toHaveLength(2)
  expect(today.items[0].dupes.map(d => d.id)).toEqual(['1', '2'])
})

test('a notification opens the exact thing it is about', () => {
  expect(notifDestination({ target_url: '/?tab=registers&session=s1' })).toEqual({ tab: 'registers', payload: { sessionId: 's1' } })
  expect(notifDestination({ target_url: '/?tab=messaging&thread=t9' })).toEqual({ tab: 'messaging', payload: { initialThreadId: 't9' } })
  expect(notifDestination({ target_url: '/?tab=children&sub=requests' })).toEqual({ tab: 'children', payload: { openRegistrationRequests: true } })
  expect(notifDestination({ target_url: '/?tab=safeguarding' })).toEqual({ tab: 'safeguarding', payload: undefined })
  expect(notifDestination({ target_url: null })).toBeNull()
})
