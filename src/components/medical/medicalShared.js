// What a medical alert means, in one place.
//
// The page this serves is opened in two very different moments: a quiet one,
// working through sign-offs, and a loud one, where somebody needs to know right
// now whether the child in front of them carries an EpiPen. The second is the
// one it is named for, so ordering and emphasis are built around it.

// Ordering for attention, not a clinical grading -- this is not the place to
// invent a severity scale for conditions. The line drawn is a practical one:
// tier 1 is everything with a rescue medication or an immediate response
// protocol behind it, and those are the entries that must not be four screens
// down an alphabetical list.
export const TIERS = {
  1: { key: 'immediate', label: 'Immediate response', colour: '#B91C1C', bg: '#FEE2E2' },
  2: { key: 'ongoing', label: 'Ongoing need', colour: '#B45309', bg: '#FEF3C7' },
  3: { key: 'context', label: 'Worth knowing', colour: '#334155', bg: '#F1F5F9' },
}

// Wording staff actually use when an allergy is the dangerous kind. Matched on
// the free text because there is no separate anaphylaxis field, and a nut
// allergy recorded only as text should not sort below a behaviour plan.
const ANAPHYLAXIS = /(anaphyla|epipen|epi-pen|adrenaline|auto-?injector)/i

/**
 * Every flag on a child, tiered.
 *
 * `takes_medication` and `has_medication` are both read. Two columns mean the
 * same thing here -- forms write the first, older records carry the second --
 * and the page previously listed children using only the second, so a child
 * whose sole medical need was medication did not appear on the medical alerts
 * page at all.
 */
export function flagsFor(child) {
  const out = []
  const allergies = (child.allergies || '').trim()
  const onMedication = !!(child.takes_medication || child.has_medication)

  if (child.has_epipen) out.push({ tier: 1, label: 'EpiPen', detail: child.medication_details || null })
  if (allergies && ANAPHYLAXIS.test(allergies)) {
    if (!child.has_epipen) out.push({ tier: 1, label: 'Severe allergy', detail: allergies })
  } else if (allergies) {
    out.push({ tier: 2, label: 'Allergy', detail: allergies })
  }
  if (child.has_diabetes) out.push({ tier: 1, label: 'Diabetes', detail: null })
  if (child.has_asthma) out.push({ tier: 1, label: 'Asthma', detail: null })
  if (onMedication) out.push({ tier: 2, label: 'Medication', detail: child.medication_details || null })
  if (child.has_behaviour_plan) out.push({ tier: 3, label: 'Behaviour plan', detail: child.behaviour_plan_notes || null })
  if (child.medical_notes) out.push({ tier: 3, label: 'Medical note', detail: child.medical_notes })

  return out.sort((a, b) => a.tier - b.tier)
}

export const hasMedicalNeed = (child) => flagsFor(child).length > 0

/** A child's tier is their most urgent flag. */
export const tierOf = (child) => {
  const flags = flagsFor(child)
  return flags.length ? flags[0].tier : null
}

export const REVIEW_INTERVAL_DAYS = 180

export function isReviewDue(review) {
  if (!review) return true
  return new Date(review.reviewed_at).getTime() < Date.now() - REVIEW_INTERVAL_DAYS * 864e5
}

/**
 * Sort for the list: most urgent first, then whoever has gone longest without a
 * review, then by name. Alphabetical alone put an EpiPen behind a behaviour
 * plan because of a surname.
 */
export function compareForTriage(a, b) {
  const t = (a.tier || 9) - (b.tier || 9)
  if (t) return t
  if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1
  return `${a.child.first_name} ${a.child.last_name}`
    .localeCompare(`${b.child.first_name} ${b.child.last_name}`)
}
