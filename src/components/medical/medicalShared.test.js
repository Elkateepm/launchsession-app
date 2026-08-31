import {
  flagsFor, hasMedicalNeed, tierOf, isReviewDue, compareForTriage,
  REVIEW_INTERVAL_DAYS, meaningfulText, allergyLooksSevere, noteLooksUrgent,
} from './medicalShared'

const kid = (over = {}) => ({
  id: 'c1', first_name: 'Ada', last_name: 'Lovelace',
  allergies: null, medical_notes: null, medication_details: null, behaviour_plan_notes: null,
  has_epipen: false, has_asthma: false, has_diabetes: false,
  takes_medication: false, has_medication: false, has_behaviour_plan: false, ...over,
})

describe('who counts as having a medical need', () => {
  it('lists a child whose only need is medication', () => {
    // The regression. flagsFor's predecessor read has_medication only, while
    // the chips read either -- so a child flagged through a form, which writes
    // takes_medication, was given a Medication chip on a page that never
    // listed them.
    expect(hasMedicalNeed(kid({ takes_medication: true }))).toBe(true)
    expect(hasMedicalNeed(kid({ has_medication: true }))).toBe(true)
  })

  it('lists nobody with nothing recorded', () => {
    expect(hasMedicalNeed(kid())).toBe(false)
    expect(flagsFor(kid())).toEqual([])
  })

  it('ignores an allergy field containing only whitespace', () => {
    expect(hasMedicalNeed(kid({ allergies: '   ' }))).toBe(false)
  })

  it('picks up every other flag on its own', () => {
    for (const over of [
      { allergies: 'Peanuts' }, { has_asthma: true }, { has_diabetes: true },
      { has_epipen: true }, { has_behaviour_plan: true }, { medical_notes: 'Wears hearing aids' },
    ]) {
      expect(hasMedicalNeed(kid(over))).toBe(true)
    }
  })
})

describe('ordering for attention', () => {
  it('puts anything with a rescue protocol first', () => {
    expect(tierOf(kid({ has_epipen: true }))).toBe(1)
    expect(tierOf(kid({ has_asthma: true }))).toBe(1)
    expect(tierOf(kid({ has_diabetes: true }))).toBe(1)
    expect(tierOf(kid({ takes_medication: true }))).toBe(2)
    expect(tierOf(kid({ medical_notes: 'Shy in groups' }))).toBe(3)
    expect(tierOf(kid({ has_behaviour_plan: true }))).toBe(3)
  })

  it('reads a severe allergy out of the free text', () => {
    // There is no anaphylaxis column, so the wording is the only signal, and a
    // nut allergy written as text should not sort below a behaviour plan.
    expect(tierOf(kid({ allergies: 'Severe nut allergy — anaphylaxis risk' }))).toBe(1)
    expect(tierOf(kid({ allergies: 'Carries an auto-injector' }))).toBe(1)
    expect(tierOf(kid({ allergies: 'Mild hayfever' }))).toBe(2)
  })

  it('does not double-count an EpiPen written in both places', () => {
    const flags = flagsFor(kid({ has_epipen: true, allergies: 'Anaphylaxis — carries EpiPen' }))
    expect(flags.filter(f => f.tier === 1).length).toBe(1)
    expect(flags[0].label).toBe('EpiPen')
  })

  it("takes a child's tier from their most urgent flag", () => {
    expect(tierOf(kid({ has_epipen: true, medical_notes: 'Shy' }))).toBe(1)
  })

  it('carries the text through, not just the label', () => {
    const [flag] = flagsFor(kid({ allergies: 'Dairy and eggs' }))
    expect(flag.detail).toBe('Dairy and eggs')
  })
})

describe('sorting the list', () => {
  const row = (over, needsReview = false) => ({
    child: kid(over), tier: tierOf(kid(over)), needsReview,
  })

  it('an EpiPen outranks a behaviour plan whatever the surname', () => {
    const epipen = row({ first_name: 'Zoe', last_name: 'Zhang', has_epipen: true })
    const plan = row({ first_name: 'Aaron', last_name: 'Abbott', has_behaviour_plan: true })
    expect([plan, epipen].sort(compareForTriage)[0]).toBe(epipen)
  })

  it('within a tier, the unreviewed come first', () => {
    const due = row({ first_name: 'Zoe', has_asthma: true }, true)
    const done = row({ first_name: 'Aaron', has_asthma: true }, false)
    expect([done, due].sort(compareForTriage)[0]).toBe(due)
  })

  it('falls back to name when tier and review status match', () => {
    const a = row({ first_name: 'Aaron', has_asthma: true })
    const z = row({ first_name: 'Zoe', has_asthma: true })
    expect([z, a].sort(compareForTriage)[0]).toBe(a)
  })
})

describe('text that means nothing recorded', () => {
  // Live data carries allergies of "NA" and a medical note of "None". Both were
  // rendering as alerts -- a note saying there is no note.
  it.each(['None', 'none', 'N/A', 'NA', 'nil', 'no', '-', '--', '.', '   '])
    ('treats %p as nothing', (value) => {
      expect(meaningfulText(value)).toBeNull()
    })

  it('keeps anything that says something', () => {
    expect(meaningfulText(' Nut allergy ')).toBe('Nut allergy')
    expect(meaningfulText('None of the usual triggers')).toBe('None of the usual triggers')
  })

  it('does not list a child whose only entry is a placeholder', () => {
    expect(hasMedicalNeed(kid({ allergies: 'NA', medical_notes: 'None' }))).toBe(false)
  })

  it('does not print "Medical note: None" on the card', () => {
    const flags = flagsFor(kid({ has_asthma: true, medical_notes: 'None' }))
    expect(flags.some(f => f.label === 'Medical note')).toBe(false)
    expect(flags.some(f => f.label === 'Asthma')).toBe(true)
  })
})

describe('recognising an emergency in free text', () => {
  // The structured fields are not being filled in: has_epipen is false for
  // every child in this database and no record contains the word anaphylaxis.
  // Without reading the text, a nut allergy ranked level with a strawberry one.
  it.each(['Nut allergy', 'Peanut allergy', 'Tree nut allergy', 'Nuts', 'Shellfish allergy', 'Sesame allergy'])
    ('treats %p as needing an immediate response', (allergies) => {
      expect(tierOf(kid({ allergies }))).toBe(1)
    })

  it.each(['Strawberry allergy', 'Gluten intolerance', 'Latex allergy', 'Mild hayfever'])
    ('leaves %p as an ongoing need', (allergies) => {
      expect(tierOf(kid({ allergies }))).toBe(2)
    })

  it('lifts a seizure condition, which has no column of its own', () => {
    expect(tierOf(kid({ medical_notes: 'Epilepsy — emergency plan with staff' }))).toBe(1)
    expect(tierOf(kid({ medical_notes: 'Had a seizure in 2025' }))).toBe(1)
  })

  it('does not re-promote what the booleans already carry', () => {
    // Promoting every note mentioning an inhaler put 18 of this org's 34
    // flagged children in the top tier. A page where half the list is urgent
    // has stopped triaging anything.
    expect(tierOf(kid({ medical_notes: 'Asthma — inhaler in bag' }))).toBe(3)
    expect(tierOf(kid({ medical_notes: 'Diabetes type 1 — glucose kit in bag' }))).toBe(3)
    // The boolean is what puts them at the top, and it still does.
    expect(tierOf(kid({ has_asthma: true, medical_notes: 'Asthma — inhaler in bag' }))).toBe(1)
  })

  it('leaves a note that is genuinely context alone', () => {
    expect(tierOf(kid({ medical_notes: 'Hearing aid — right ear' }))).toBe(3)
    expect(tierOf(kid({ medical_notes: 'Wears glasses' }))).toBe(3)
  })

  it('relabels a lifted note so the card does not call it a footnote', () => {
    const [flag] = flagsFor(kid({ medical_notes: 'Epilepsy — emergency plan with staff' }))
    expect(flag.label).toBe('Medical condition')
  })

  it('ignores a placeholder rather than matching on it', () => {
    expect(allergyLooksSevere('none')).toBe(false)
    expect(noteLooksUrgent('')).toBe(false)
  })
})

describe('review window', () => {
  const daysAgo = (n) => ({ reviewed_at: new Date(Date.now() - n * 864e5).toISOString() })

  it('treats a child never reviewed as due', () => {
    expect(isReviewDue(null)).toBe(true)
  })

  it('is due once the interval has passed', () => {
    expect(isReviewDue(daysAgo(REVIEW_INTERVAL_DAYS + 1))).toBe(true)
    expect(isReviewDue(daysAgo(REVIEW_INTERVAL_DAYS - 1))).toBe(false)
  })
})
