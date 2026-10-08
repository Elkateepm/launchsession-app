// The two public report forms, set up in one tap from Share on Home. Ported
// from the Solidarity Sports hub's forms of the same name.
//
// Question ids are fixed and `mapsTo` names what each answer fills in: that is
// how handle_form_creates_record (20261009_public_reports.sql) turns a
// submission into an accident book entry or a safeguarding concern. Anything
// without a mapping stays on the submission, which the record links to.
//
// The young person is a typed name. Someone with no account must never be
// shown a list of the organisation's children.
const q = (id, label, type, required, extra = {}) => ({ id, label, type, required, mapsTo: id, ...extra })

export const REPORT_FORMS = [
  {
    creates_record: 'injury',
    name: 'Report an injury',
    description: 'Report an accident or injury to a young person. You do not need an account.',
    confirmation_message: 'Thank you. Your report is in the accident book and the team will follow it up.',
    fields: [
      q('child_name', "Young person's name", 'text', true),
      q('occurred_at', 'Date of the injury', 'date', true),
      q('location', 'Where did it happen?', 'text', true),
      q('what_happened', 'What happened?', 'textarea', true, { description: 'Include the time, what you saw, and anything that still needs doing.' }),
      q('injury_type', 'Type of injury', 'select', true, { options: ['Cut or graze', 'Bruise', 'Bump to the head', 'Sprain or strain', 'Break or suspected break', 'Burn or scald', 'Bite or sting', 'Nosebleed', 'Existing condition', 'Other'] }),
      q('body_part', 'Where on the body?', 'text', true),
      q('first_aid_given', 'First aid or treatment given', 'textarea', true, { description: 'Write "None" if no first aid was given. Include any medical help sought.' }),
      q('treated_by', 'Who gave first aid or treatment?', 'text', false),
      q('witnesses', 'Who else saw what happened?', 'text', false),
      q('reported_name', 'Your name', 'text', true),
      q('reported_contact', 'Your phone number or email', 'text', true),
    ],
  },
  {
    creates_record: 'concern',
    name: 'Raise a safeguarding concern',
    description: 'Tell us about a worry for the safety or wellbeing of a young person. You do not need an account.',
    confirmation_message: 'Thank you. Your concern has gone to the safeguarding lead. If a child is in immediate danger, call 999.',
    fields: [
      q('child_name', 'Name of the young person or people involved', 'text', true, { description: 'If you do not know a name, describe who is involved.' }),
      q('date_of_incident', 'Date of the incident', 'date', true),
      q('location', 'Where did it happen?', 'text', true),
      q('description', 'What happened or was said?', 'textarea', true, { description: 'Use their words where you can. Include the time and anything already done.' }),
      q('witnesses', 'Who else was present?', 'text', false),
      q('reported_name', 'Your name', 'text', false),
      q('submitter_role', 'Your role or relationship to the young person', 'text', false),
      q('reported_contact', 'Your phone number or email', 'text', true, { description: 'So the safeguarding lead can reach you.' }),
    ],
  },
]

export const RECORD_LABELS = {
  injury: { short: 'Accident book', icon: '🩹', verb: 'an accident book entry' },
  concern: { short: 'Safeguarding', icon: '🛡', verb: 'a safeguarding concern' },
}
