// Which risk assessment fits a session, and which starter template a new one
// for it should begin from.
//
// Session planning used to list the whole library alphabetically, so the
// assessment for "Day trip to the coast" sat wherever B, D or T fell, and the
// quick "create" form saved hazards as a paragraph of text. Most assessments
// made that way stayed drafts forever. Ranking puts the likely one first, and
// starting from a template gives a new one real hazards to check rather than a
// blank page.

import { safetyStateOf, SAFETY, isArchived } from '../components/riskassessments/ra_safety'
import { RA_TEMPLATES } from '../components/riskassessments/ra_templates'

// Session types (from the wizard) -> the activity types an assessment for one
// would carry in the Risk Assessments library.
const ACTIVITY_FOR_SESSION = {
  trip: ['Day Trip', 'Transport'],
  theatre: ['Day Trip'],
  residential: ['Residential'],
  sports: ['Sports', 'Adventure Activity'],
  competition: ['Sports'],
  workshop: ['Workshop', 'Arts', 'Cooking'],
  training: ['Training', 'Workshop'],
  mentoring: ['Mentoring'],
  community: ['Community Event', 'Fundraising'],
  celebration: ['Community Event'],
  activity: ['General Activity', 'Holiday Club', 'Sports', 'Arts'],
  custom: ['General Activity', 'Other'],
}

const TEMPLATE_FOR_SESSION = {
  trip: 'trips', theatre: 'trips', residential: 'residential',
  sports: 'sports', competition: 'sports',
  workshop: 'arts', training: 'general', mentoring: 'general',
  community: 'general', celebration: 'general', activity: 'general', custom: 'general',
}

/** The starter template a new assessment for this kind of session begins from. */
export function templateForSession(sessionType) {
  const key = TEMPLATE_FOR_SESSION[sessionType] || 'general'
  return RA_TEMPLATES.find(t => t.key === key) || RA_TEMPLATES.find(t => t.key === 'general') || RA_TEMPLATES[0]
}

const STOP = new Set(['risk', 'assessment', 'session', 'sessions', 'with', 'from', 'trip', 'club', 'day', 'the', 'and', 'for'])
const words = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w))

/**
 * How well an assessment fits a session. Activity type, place and shared
 * words in the name all count; a ready assessment beats a draft of the same fit.
 */
export function matchScore(assessment, session) {
  if (!assessment || isArchived(assessment)) return -Infinity
  let score = 0
  const types = ACTIVITY_FOR_SESSION[session?.session_type] || []
  if (assessment.activity_type && types.includes(assessment.activity_type)) score += 3

  const place = words(session?.location)
  const theirPlace = words(assessment.location)
  if (place.some(w => theirPlace.includes(w))) score += 3

  const title = words(session?.title)
  const name = words(assessment.name)
  score += 2 * title.filter(w => name.includes(w)).length

  const state = safetyStateOf(assessment)
  score += state === SAFETY.READY ? 2 : state === SAFETY.REVIEW ? 1 : state === SAFETY.ACTION ? -1 : 0
  return score
}

/**
 * The library in the order someone planning this session should see it: best
 * fit first, archived ones gone, ties broken by the most recently updated.
 * `best` is the top one only when it genuinely fits (anything beyond its
 * readiness), so an unrelated assessment is never labelled "Best match".
 */
export function rankAssessments(assessments, session) {
  const ranked = (assessments || [])
    .filter(a => !isArchived(a))
    .map(a => ({ a, score: matchScore(a, session) }))
    .sort((x, y) => y.score - x.score || String(y.a.updated_at || y.a.created_at || '').localeCompare(String(x.a.updated_at || x.a.created_at || '')))
  const top = ranked[0]
  const readinessOnly = top ? (() => { const s = safetyStateOf(top.a); return s === SAFETY.READY ? 2 : s === SAFETY.REVIEW ? 1 : 0 })() : 0
  return {
    list: ranked.map(r => r.a),
    best: top && top.score > readinessOnly ? top.a : null,
  }
}

/** Plain words for an assessment's state, for planning and register screens. */
export function riskStateLabel(assessment, ctx = {}) {
  if (!assessment) return { state: 'none', label: 'No risk assessment', short: 'None' }
  const state = safetyStateOf(assessment, ctx)
  return {
    [SAFETY.READY]: { state, label: 'Ready to run', short: 'Ready' },
    [SAFETY.REVIEW]: { state, label: 'Needs review', short: 'Needs review' },
    [SAFETY.ACTION]: { state, label: 'Review overdue', short: 'Overdue' },
    [SAFETY.DRAFT]: { state, label: 'Still a draft', short: 'Draft' },
  }[state]
}
