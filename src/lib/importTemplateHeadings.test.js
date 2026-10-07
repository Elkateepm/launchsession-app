import { fieldForHeader } from './childImport'
import { AVAILABLE_FIELDS } from '../components/registers/TemplateCreator'

// The downloadable template and the on-screen table both use these labels as
// their headings, so every one must match back to its own field. A label that
// matched a neighbour would put, say, every parent's phone number in the
// parent name column without anyone noticing until it was needed.
test.each(AVAILABLE_FIELDS.map(f => [f.label, f.key]))('"%s" is read back as %s', (label, key) => {
  expect(fieldForHeader(label)).toBe(key)
})
