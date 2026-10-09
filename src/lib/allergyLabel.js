// What a young person is allergic to, short enough for a flag on the register.
//
// The flag used to say only "Allergy", so at snack time a session lead had to
// open each flagged child to find out what to. A short entry is shown whole;
// a long one is cut, and the full text stays in the child's details and the
// flag's tooltip.
export function allergyLabel(allergies, max = 18) {
  const text = String(allergies || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
