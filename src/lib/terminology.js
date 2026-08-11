// Per-organisation-type terminology.
//
// A youth charity says "young people". A football academy says "players". A
// school says "students". Using one word everywhere makes the product feel
// like it was built for someone else -- which, for a B2B2C tool a club is
// choosing between competitors, matters.
//
// SCOPE, deliberately narrow:
//
// This covers the handful of nouns that appear constantly in the UI and carry
// no legal weight. It does NOT touch safeguarding language. "Child protection",
// "cause for concern", "designated safeguarding lead" and the wording inside
// concern forms are terms of art in UK safeguarding practice -- a football club
// still files a concern about a "child", not a "player", because that is the
// language the LADO, the local authority and Ofsted expect. Renaming those
// would be actively harmful, so those strings stay fixed everywhere.
//
// Anything not listed for a type falls back to the default, so a partial entry
// is safe and adding a new org type needs no other change.

const DEFAULTS = {
  // Singular / plural of the people being served
  person: 'young person',
  people: 'young people',
  Person: 'Young Person',
  People: 'Young People',
  // What a delivery occasion is called
  session: 'session',
  sessions: 'sessions',
  Session: 'Session',
  Sessions: 'Sessions',
  // Who delivers it
  Staff: 'Staff',
  // Grouping of people
  group: 'group',
  Group: 'Group',
  Groups: 'Groups',
}

const BY_TYPE = {
  sports_club: {
    person: 'player', people: 'players', Person: 'Player', People: 'Players',
    session: 'training session', sessions: 'training sessions',
    Session: 'Training Session', Sessions: 'Training',
    Staff: 'Coaches', group: 'squad', Group: 'Squad', Groups: 'Squads',
  },
  education: {
    person: 'student', people: 'students', Person: 'Student', People: 'Students',
    session: 'class', sessions: 'classes', Session: 'Class', Sessions: 'Classes',
    Staff: 'Teachers', group: 'class', Group: 'Class', Groups: 'Classes',
  },
  mentoring: {
    person: 'mentee', people: 'mentees', Person: 'Mentee', People: 'Mentees',
    Staff: 'Mentors',
  },
  after_school: {
    person: 'child', people: 'children', Person: 'Child', People: 'Children',
    session: 'club session', sessions: 'club sessions',
    Session: 'Club Session', Sessions: 'Club Sessions',
  },
  holiday_club: {
    person: 'child', people: 'children', Person: 'Child', People: 'Children',
    session: 'camp day', sessions: 'camp days',
    Session: 'Camp Day', Sessions: 'Camp Days',
  },
  youth_club: {
    session: 'youth session', sessions: 'youth sessions',
    Session: 'Youth Session', Sessions: 'Youth Sessions',
  },
  faith_community: {
    person: 'member', people: 'members', Person: 'Member', People: 'Members',
    session: 'gathering', sessions: 'gatherings',
    Session: 'Gathering', Sessions: 'Gatherings',
    Staff: 'Leaders',
  },
  community_centre: {
    person: 'participant', people: 'participants',
    Person: 'Participant', People: 'Participants',
    session: 'activity', sessions: 'activities',
    Session: 'Activity', Sessions: 'Activities',
  },
  local_authority: {
    person: 'service user', people: 'service users',
    Person: 'Service User', People: 'Service Users',
  },
  social_enterprise: {
    person: 'participant', people: 'participants',
    Person: 'Participant', People: 'Participants',
  },
  // charity and other intentionally use the defaults.
}

/**
 * Terminology for an organisation type. Unknown or missing types fall back to
 * the defaults rather than throwing, since organisations.type is free text.
 */
export function getTerms(orgType) {
  const overrides = BY_TYPE[String(orgType || '').toLowerCase()] || {}
  return { ...DEFAULTS, ...overrides }
}

export default getTerms
