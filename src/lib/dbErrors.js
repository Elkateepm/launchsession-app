// Turning a Postgres error into something a person should read.
//
// Several of this schema's guards raise `CODE: sentence` -- SIGNUP_RATE_LIMIT,
// ORG_NAME_TAKEN, CHILD_LIMIT_REACHED, ORG_BILLING_LOCKED. The code is there so
// the client can branch on it; the sentence is already written for the person.
// Showing both means users read "CHILD_LIMIT_REACHED:" in an alert box.

const PREFIXED = /^[A-Z][A-Z0-9_]{3,}:\s*/

/**
 * The human half of a database error, or the original message when it carries
 * no prefix. Never returns empty -- a blank alert is worse than a raw one.
 */
export function readableDbError(error, fallback = 'Something went wrong. Please try again.') {
  const raw = (typeof error === 'string' ? error : error?.message) || ''
  if (!raw) return fallback
  return raw.replace(PREFIXED, '').trim() || fallback
}

/** True when the error is the named guard, whatever the wording around it. */
export function isDbError(error, code) {
  const raw = (typeof error === 'string' ? error : error?.message) || ''
  return raw.includes(code)
}
