import { flagsFor } from '../components/medical/medicalShared'

// What the Medical flag on a register row should say.
//
// It used to say only "Medical", so an EpiPen looked the same as a note and a
// session lead had to open the child to know what to keep nearby. This reads
// the same flags as the Medical page, most urgent first; "+1" says there is
// more, and the full list is in the flag's tooltip and accessible name.
// Allergies have their own flag on the row, and a behaviour plan never raised
// this one, so both are left out.
const OWN_FLAG = new Set(['Allergy', 'Severe allergy', 'Behaviour plan'])

export function medicalFlag(child) {
  if (!child) return null
  const flags = flagsFor(child).filter(f => !OWN_FLAG.has(f.label))
  if (!flags.length) return null
  const label = flags[0].label + (flags.length > 1 ? ` +${flags.length - 1}` : '')
  const detail = `Medical: ${flags.map(f => (f.detail ? `${f.label} (${f.detail})` : f.label)).join(', ')}`
  return { label, detail }
}
