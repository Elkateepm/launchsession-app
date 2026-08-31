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

// Text that means "nothing recorded". Staff type these into a required-looking
// box to get past it, and the page was rendering "Medical note: None" as an
// alert -- a note saying there is no note.
const EMPTY_TEXT = /^(n\/?a|none|nil|no|nothing|-{1,3}|\.)$/i

export function meaningfulText(value) {
  const t = (value || '').trim()
  if (!t || EMPTY_TEXT.test(t)) return null
  return t
}

// What the structured fields cannot express.
//
// The booleans already carry asthma, diabetes and EpiPen, so the text matching
// below deliberately does NOT repeat them: promoting every note that mentions
// an inhaler put 18 of this org's 34 flagged children into the top tier, and a
// page where half the list is urgent has stopped triaging anything.
//
// What the booleans miss is real, though. has_epipen is false for every child
// in this database and not one record says anaphylaxis -- so without reading
// the allergy text, a recorded peanut allergy ranked level with a strawberry
// one. And there is no column for epilepsy at all.
//
// So: allergens that carry an anaphylaxis risk, and seizure conditions. Keyword
// matching standing in for fields that do not exist, tuned to over-flag rather
// than under-flag, because here a false positive costs a second look and a
// false negative costs considerably more. The real fix is capturing severity at
// the point of entry.
const ANAPHYLAXIS = '(anaphyla|epipen|epi-?pen|adrenaline|auto-?injector)'

// Allergens that are treated as potentially anaphylactic by default in a youth
// setting. Not a clinical judgement about any individual: a nut allergy that
// turns out to be mild costs somebody a second look at a card.
const RISK_ALLERGENS = '(peanut|tree ?nut|\\bnuts?\\b|shellfish|sesame|bee sting|wasp sting|insect sting)'

const ALLERGY_RISK = new RegExp(`${ANAPHYLAXIS}|${RISK_ALLERGENS}`, 'i')
// Notes get the anaphylaxis wording plus seizures, which have no column.
const NOTE_RISK = new RegExp(`${ANAPHYLAXIS}|(epilep|seizure)`, 'i')

export const allergyLooksSevere = (text) => {
  const t = meaningfulText(text)
  return !!t && ALLERGY_RISK.test(t)
}

export const noteLooksUrgent = (text) => {
  const t = meaningfulText(text)
  return !!t && NOTE_RISK.test(t)
}

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
  const allergies = meaningfulText(child.allergies)
  const notes = meaningfulText(child.medical_notes)
  const medDetail = meaningfulText(child.medication_details)
  const planNotes = meaningfulText(child.behaviour_plan_notes)
  const onMedication = !!(child.takes_medication || child.has_medication)

  if (child.has_epipen) out.push({ tier: 1, label: 'EpiPen', detail: medDetail })
  if (allergies) {
    const severe = !child.has_epipen && allergyLooksSevere(allergies)
    out.push({
      tier: severe ? 1 : 2,
      label: severe ? 'Severe allergy' : 'Allergy',
      detail: allergies,
    })
  }
  if (child.has_diabetes) out.push({ tier: 1, label: 'Diabetes', detail: null })
  if (child.has_asthma) out.push({ tier: 1, label: 'Asthma', detail: null })
  if (onMedication) out.push({ tier: 2, label: 'Medication', detail: medDetail })
  if (child.has_behaviour_plan) out.push({ tier: 3, label: 'Behaviour plan', detail: planNotes })
  if (notes) {
    // A note naming a condition with an emergency protocol is not a footnote.
    // "Epilepsy -- emergency plan with staff" belongs at the top of the page,
    // whether or not anybody ticked a box elsewhere.
    const severe = noteLooksUrgent(notes)
    out.push({
      tier: severe ? 1 : 3,
      label: severe ? 'Medical condition' : 'Medical note',
      detail: notes,
    })
  }

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
