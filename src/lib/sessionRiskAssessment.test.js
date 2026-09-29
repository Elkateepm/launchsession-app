import { assessmentIdForSession, carryAssessmentToSession } from './sessionRiskAssessment'
import { supabase } from './supabase'

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }))

// A session's link to its assessment lives in risk_assessment_sessions, so
// every duplicate path that copied session COLUMNS carried the
// "risk assessment required" flag and left the assessment behind — producing
// copies that demanded work already done for the activity they came from.
function mockLink(assessmentId, { insertError = null } = {}) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: assessmentId ? { assessment_id: assessmentId } : null, error: null,
  })
  const limit = jest.fn(() => ({ maybeSingle }))
  const eq2 = jest.fn(() => ({ limit }))
  const eq1 = jest.fn(() => ({ eq: eq2 }))
  const select = jest.fn(() => ({ eq: eq1 }))
  const insert = jest.fn().mockResolvedValue({ error: insertError })
  supabase.from.mockReturnValue({ select, insert })
  return { insert, select }
}

beforeEach(() => jest.clearAllMocks())

describe('assessmentIdForSession', () => {
  it('returns the linked assessment', async () => {
    mockLink('ra-1')
    await expect(assessmentIdForSession('s-1', 'org-1')).resolves.toBe('ra-1')
  })

  it('returns null when the session has no assessment', async () => {
    mockLink(null)
    await expect(assessmentIdForSession('s-1', 'org-1')).resolves.toBeNull()
  })

  it('does not query without both ids', async () => {
    mockLink('ra-1')
    await expect(assessmentIdForSession(null, 'org-1')).resolves.toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('carryAssessmentToSession', () => {
  it('links the copy to the original assessment', async () => {
    const { insert } = mockLink('ra-1')
    await expect(carryAssessmentToSession('s-old', 's-new', 'org-1')).resolves.toBe('ra-1')
    expect(insert).toHaveBeenCalledWith({ assessment_id: 'ra-1', session_id: 's-new', org_id: 'org-1' })
  })

  it('does nothing when the original had no assessment', async () => {
    const { insert } = mockLink(null)
    await expect(carryAssessmentToSession('s-old', 's-new', 'org-1')).resolves.toBeNull()
    expect(insert).not.toHaveBeenCalled()
  })

  // The session already exists by the time this runs, so a failed link must not
  // take the duplicate down with it — the overview flags the gap either way.
  it('reports failure without throwing', async () => {
    mockLink('ra-1', { insertError: { message: 'denied' } })
    await expect(carryAssessmentToSession('s-old', 's-new', 'org-1')).resolves.toBeNull()
  })
})
