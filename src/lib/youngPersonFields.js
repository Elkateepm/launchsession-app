// The questions on the Add young person form, and how a family's answers turn
// into rows. Pure, so the form, the profile and the tests agree.

export const GENDERS = ['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say']

// ONS 2021 Census categories (England & Wales), grouped as on the census.
export const ETHNICITY_GROUPS = [
  ['Asian or Asian British', ['Bangladeshi', 'Chinese', 'Indian', 'Pakistani', 'Any other Asian background']],
  ['Black, Black British, Caribbean or African', ['African', 'Caribbean', 'Any other Black, Black British or Caribbean background']],
  ['Mixed or multiple ethnic groups', ['White and Asian', 'White and Black African', 'White and Black Caribbean', 'Any other Mixed or multiple ethnic background']],
  ['White', ['English, Welsh, Scottish, Northern Irish or British', 'Irish', 'Gypsy or Irish Traveller', 'Roma', 'Any other White background']],
  ['Other ethnic group', ['Arab', 'Any other ethnic group']],
]

export const RELIGIONS = ['No religion', 'Buddhist', 'Christian', 'Hindu', 'Jewish', 'Muslim', 'Sikh', 'Any other religion', 'Prefer not to say']

export const LANGUAGES = ['English', 'Arabic', 'Bengali', 'French', 'Gujarati', 'Panjabi', 'Polish', 'Portuguese', 'Romanian', 'Somali', 'Spanish', 'Tamil', 'Turkish', 'Ukrainian', 'Urdu', 'British Sign Language']

export const YEAR_GROUPS = ['Nursery', 'Reception', ...Array.from({ length: 13 }, (_, i) => `Year ${i + 1}`), 'Left school', 'Not in education']

/** yes / no / not sure answers, stored as text. */
export const ANSWERS = [['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure / rather not say']]
export const answerLabel = v => (ANSWERS.find(([k]) => k === v) || [])[1] || null

export const CIRCUMSTANCES = [
  ['disability', 'Disability or long-term condition'],
  ['free_school_meals', 'Gets free school meals'],
  ['young_carer', 'Young carer'],
  ['looked_after', 'In care / looked-after'],
]

export const CONSENTS = [
  ['photo', 'Photos'],
  ['trip', 'Trips off site'],
  ['medical', 'Emergency first aid'],
  ['data_sharing', 'Sharing with partners'],
]

/**
 * School year in England & Wales from a date of birth, counting from the
 * 1 September cut-off. Only a suggestion: Scotland and Northern Ireland
 * differ, and children are sometimes held back.
 */
export function yearGroupFor(dob, today) {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null
  const [y, m] = dob.split('-').map(Number)
  const [ty, tm] = today.split('-').map(Number)
  const birthYear = m >= 9 ? y : y - 1
  const thisYear = tm >= 9 ? ty : ty - 1
  const n = thisYear - (birthYear + 5)
  if (n < -1) return null
  if (n === -1) return 'Nursery'
  if (n === 0) return 'Reception'
  if (n <= 13) return `Year ${n}`
  return 'Left school'
}

/** UK postcode, tidied: upper case with one space before the last three. */
export function tidyPostcode(raw) {
  const s = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s.length < 5 || s.length > 7) return (raw || '').trim().toUpperCase() || null
  return `${s.slice(0, -3)} ${s.slice(-3)}`
}

export const blankFamily = () => ({
  parent_name: '', parent_phone: '', parent_email: '', address: '', postcode: '',
  emergency_contact_name: '', emergency_contact_phone: '',
})

let seq = 0
export const blankPerson = (lastName = '') => ({
  key: `p${++seq}`,
  first_name: '', last_name: lastName, date_of_birth: '', group_name: '', school: '', year_group: '',
  gender: '', pronouns: '', ethnicity: '', first_language: '', religion: '',
  disability: '', free_school_meals: '', young_carer: '', looked_after: '',
  allergies: '', medical_notes: '', has_asthma: false, has_diabetes: false, has_epipen: false,
  takes_medication: false, medication_details: '', sen: '', has_behaviour_plan: false, behaviour_plan_notes: '',
  travel_consent: false, consents: {},
  notes: '',
})

const t = v => (typeof v === 'string' ? v.trim() : v) || null

/**
 * One insert row per young person. The family's contact details go on every
 * child; siblings share a family_id. A blank last name takes the one before
 * it, so "Add a sibling" only needs a first name.
 */
export function buildChildRows({ orgId, family, people, familyId }) {
  const shared = {
    parent_name: t(family.parent_name), parent_phone: t(family.parent_phone), parent_email: t(family.parent_email),
    address: t(family.address), postcode: family.postcode ? tidyPostcode(family.postcode) : null,
    emergency_contact_name: t(family.emergency_contact_name), emergency_contact_phone: t(family.emergency_contact_phone),
  }
  let lastName = ''
  return people.filter(p => p.first_name.trim()).map(p => {
    lastName = p.last_name.trim() || lastName
    const takesMedication = !!p.takes_medication
    return {
      org_id: orgId,
      ...shared,
      first_name: p.first_name.trim(), last_name: lastName,
      date_of_birth: p.date_of_birth || null, group_name: t(p.group_name), school: t(p.school), year_group: t(p.year_group),
      gender: t(p.gender), pronouns: t(p.pronouns), ethnicity: t(p.ethnicity), first_language: t(p.first_language), religion: t(p.religion),
      disability: t(p.disability), free_school_meals: t(p.free_school_meals), young_carer: t(p.young_carer), looked_after: t(p.looked_after),
      allergies: t(p.allergies), medical_notes: t(p.medical_notes),
      has_asthma: !!p.has_asthma, has_diabetes: !!p.has_diabetes, has_epipen: !!p.has_epipen,
      takes_medication: takesMedication, has_medication: takesMedication,
      medication_details: takesMedication ? t(p.medication_details) : null,
      sen: t(p.sen), has_behaviour_plan: !!p.has_behaviour_plan,
      behaviour_plan_notes: p.has_behaviour_plan ? t(p.behaviour_plan_notes) : null,
      travel_consent: !!p.travel_consent, notes: t(p.notes),
      family_id: familyId || null,
      active: true,
      profile_incomplete: !p.date_of_birth || !shared.parent_phone,
    }
  })
}

/** Consent rows for a saved child: all four, granted only where ticked. */
export function consentRowsFor({ orgId, childId, consents, grantedBy, now }) {
  return CONSENTS.map(([type]) => {
    const granted = !!consents?.[type]
    return {
      org_id: orgId, child_id: childId, consent_type: type, status: granted ? 'granted' : 'not_granted',
      granted_by: granted ? grantedBy || null : null, granted_at: granted ? now : null,
    }
  })
}

/** "About" lines for the profile, in reading order, blanks left out. */
export function aboutLines(child) {
  const lines = [
    ['Gender', child.gender], ['Pronouns', child.pronouns], ['School year', child.year_group],
    ['First language', child.first_language], ['Ethnicity', child.ethnicity], ['Religion', child.religion],
    ...CIRCUMSTANCES.map(([k, l]) => [l, answerLabel(child[k])]),
    ['Address', [child.address, child.postcode].filter(Boolean).join(', ')],
  ]
  return lines.filter(([, v]) => v)
}
