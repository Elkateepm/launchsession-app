// Built-in starter templates: each pre-populates a set of common hazards for an
// activity type so staff aren't starting from a blank page. These are seeds only —
// every hazard is fully editable once the assessment is created.

export const RA_TEMPLATES = [
  {
    key: 'sports', name: 'Sports Activity', activity_type: 'Sports', icon: '⚽',
    summary: 'Risk assessment for a regular sports training or match session.',
    hazards: [
      { hazard: 'Slips, trips and falls on playing surface', who_at_risk: 'Young people, staff', likelihood: 3, severity: 2, control_measures: 'Inspect surface before use; appropriate footwear; clear away obstacles.', residual_likelihood: 2, residual_severity: 2 },
      { hazard: 'Collisions between participants', who_at_risk: 'Young people', likelihood: 3, severity: 3, control_measures: 'Clear rules; adequate spacing; qualified coaching; group by age/ability.', residual_likelihood: 2, residual_severity: 2 },
      { hazard: 'Sprains, strains and impact injuries', who_at_risk: 'Young people', likelihood: 3, severity: 2, control_measures: 'Warm-up/cool-down; first aider on site; appropriate equipment.', residual_likelihood: 2, residual_severity: 2 },
      { hazard: 'Dehydration / overheating', who_at_risk: 'Young people', likelihood: 2, severity: 2, control_measures: 'Water breaks; shade available; monitor in hot weather.', residual_likelihood: 1, residual_severity: 2 },
      { hazard: 'Faulty or unsafe equipment', who_at_risk: 'Young people, staff', likelihood: 2, severity: 3, control_measures: 'Pre-use equipment checks; remove damaged items from use.', residual_likelihood: 1, residual_severity: 3 },
    ],
  },
  {
    key: 'trips', name: 'Trip / Visit', activity_type: 'Day Trip', icon: '🚌',
    summary: 'Risk assessment for an off-site day trip or visit.',
    hazards: [
      { hazard: 'Child becoming separated from group', who_at_risk: 'Young people', likelihood: 3, severity: 4, control_measures: 'Headcounts at each stage; buddy system; agreed meeting point; staff:child ratios.', residual_likelihood: 2, residual_severity: 4 },
      { hazard: 'Road traffic / crossing roads', who_at_risk: 'Young people, staff', likelihood: 2, severity: 4, control_measures: 'Planned routes; designated crossing points; high-vis where appropriate.', residual_likelihood: 1, residual_severity: 4 },
      { hazard: 'Transport incident', who_at_risk: 'All', likelihood: 2, severity: 5, control_measures: 'Licensed/insured transport; seatbelts; vetted drivers; contingency plan.', residual_likelihood: 1, residual_severity: 5 },
      { hazard: 'Medical emergency away from base', who_at_risk: 'Young people, staff', likelihood: 2, severity: 4, control_measures: 'First aid kit; medical info carried; nearest A&E identified; emergency contacts.', residual_likelihood: 1, residual_severity: 4 },
      { hazard: 'Adverse weather', who_at_risk: 'All', likelihood: 3, severity: 2, control_measures: 'Check forecast; suitable clothing; contingency/indoor alternative.', residual_likelihood: 2, residual_severity: 2 },
    ],
  },
  {
    key: 'water', name: 'Water Activity', activity_type: 'Water Activity', icon: '🛶',
    summary: 'Risk assessment for water-based activities (kayaking, swimming, watersports).',
    hazards: [
      { hazard: 'Drowning', who_at_risk: 'Young people', likelihood: 2, severity: 5, control_measures: 'Qualified instructors; buoyancy aids/life jackets; lifeguard cover; swim ability checked.', residual_likelihood: 1, residual_severity: 5 },
      { hazard: 'Cold water shock / hypothermia', who_at_risk: 'Young people', likelihood: 2, severity: 4, control_measures: 'Appropriate wetsuits; limit exposure time; warm change facilities.', residual_likelihood: 1, residual_severity: 4 },
      { hazard: 'Capsize / entrapment', who_at_risk: 'Young people', likelihood: 2, severity: 4, control_measures: 'Capsize drill briefing; supervision ratios; rescue craft available.', residual_likelihood: 1, residual_severity: 4 },
      { hazard: 'Water-borne illness', who_at_risk: 'Young people', likelihood: 2, severity: 2, control_measures: 'Cover cuts; avoid swallowing water; wash after activity.', residual_likelihood: 1, residual_severity: 2 },
    ],
  },
  {
    key: 'residential', name: 'Residential', activity_type: 'Residential', icon: '⛰️',
    summary: 'Risk assessment for an overnight residential trip.',
    hazards: [
      { hazard: 'Night-time safeguarding / supervision', who_at_risk: 'Young people', likelihood: 2, severity: 4, control_measures: 'Waking night cover; clear sleeping arrangements; DBS-checked staff; room allocation policy.', residual_likelihood: 1, residual_severity: 4 },
      { hazard: 'Unfamiliar environment / getting lost', who_at_risk: 'Young people', likelihood: 3, severity: 3, control_measures: 'Site orientation on arrival; boundaries agreed; regular headcounts.', residual_likelihood: 2, residual_severity: 3 },
      { hazard: 'Medical needs over multiple days', who_at_risk: 'Young people', likelihood: 3, severity: 3, control_measures: 'Medication plan; first aider present; medical forms; nearest A&E identified.', residual_likelihood: 2, residual_severity: 3 },
      { hazard: 'Fire / evacuation', who_at_risk: 'All', likelihood: 1, severity: 5, control_measures: 'Fire drill on arrival; know exits; accommodation fire-safety checked.', residual_likelihood: 1, residual_severity: 5 },
      { hazard: 'Homesickness / emotional distress', who_at_risk: 'Young people', likelihood: 3, severity: 2, control_measures: 'Key worker available; contact-home policy; wellbeing check-ins.', residual_likelihood: 2, residual_severity: 2 },
    ],
  },
  {
    key: 'arts', name: 'Arts & Crafts', activity_type: 'Arts', icon: '🎨',
    summary: 'Risk assessment for arts, crafts and creative activities.',
    hazards: [
      { hazard: 'Cuts from scissors/craft tools', who_at_risk: 'Young people', likelihood: 3, severity: 2, control_measures: 'Age-appropriate tools; supervision; safe storage.', residual_likelihood: 2, residual_severity: 2 },
      { hazard: 'Allergic reaction to materials', who_at_risk: 'Young people', likelihood: 2, severity: 3, control_measures: 'Check allergy info; non-toxic materials; first aid available.', residual_likelihood: 1, residual_severity: 3 },
      { hazard: 'Slips from spilled materials/water', who_at_risk: 'All', likelihood: 2, severity: 2, control_measures: 'Clean spills promptly; cover surfaces; aprons.', residual_likelihood: 1, residual_severity: 2 },
    ],
  },
  {
    key: 'general', name: 'General Activity', activity_type: 'General Activity', icon: '📋',
    summary: 'Generic risk assessment for a standard indoor youth session.',
    hazards: [
      { hazard: 'Slips, trips and falls', who_at_risk: 'All', likelihood: 2, severity: 2, control_measures: 'Keep area tidy; clear walkways; clean spills.', residual_likelihood: 1, residual_severity: 2 },
      { hazard: 'Fire / evacuation', who_at_risk: 'All', likelihood: 1, severity: 4, control_measures: 'Know exits and assembly point; extinguishers checked; drill run.', residual_likelihood: 1, residual_severity: 4 },
      { hazard: 'Medical emergency', who_at_risk: 'All', likelihood: 2, severity: 3, control_measures: 'First aider present; kit stocked; medical info to hand.', residual_likelihood: 1, residual_severity: 3 },
      { hazard: 'Safeguarding concern', who_at_risk: 'Young people', likelihood: 2, severity: 4, control_measures: 'DBS-checked staff; DSL available; clear reporting procedures.', residual_likelihood: 1, residual_severity: 4 },
    ],
  },
]
