export function formIssues(form, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())) {
  const issues = []
  if (!form.name?.trim()) issues.push({ message: 'Give your form a name.', tab: 'build' })
  if (!form.fields.length) issues.push({ message: 'Add at least one question.', tab: 'build' })
  const labels = new Set()
  form.fields.forEach((field, index) => {
    const label = field.label?.trim()
    const add = message => issues.push({ message, tab: 'build', fieldId: field.id })
    if (!label) add(`Write a title for question ${index + 1}.`)
    // Public submissions are keyed by question text. Duplicate text would
    // silently overwrite an answer, even though the builder has distinct ids.
    else if (labels.has(label.toLowerCase())) add(`Give question ${index + 1} a unique title.`)
    labels.add(label?.toLowerCase())
    if (field.type === 'select') {
      const options = (field.options || []).map(option => option.trim())
      if (!options.length || options.some(option => !option)) add(`Finish the answer choices for question ${index + 1}.`)
      else if (new Set(options.map(option => option.toLowerCase())).size !== options.length) add(`Remove repeated choices from question ${index + 1}.`)
    }
  })
  if (form.closing_date && form.closing_date < today) issues.push({ message: 'Choose a closing date that has not passed.', tab: 'settings' })
  return issues
}

export function templateDraft(template, makeId) {
  return {
    name: template.name || template.title,
    description: template.desc || template.description || '',
    purpose: template.purpose || null,
    tag: template.categories?.includes('consent') ? 'Consent' : template.categories?.includes('feedback') ? 'Survey' : 'Other',
    fields: template.fields.map(field => ({ ...field, id: makeId(), description: field.description || field.help || '' })),
  }
}
