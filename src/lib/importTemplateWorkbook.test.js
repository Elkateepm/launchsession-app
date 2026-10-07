import * as XLSX from 'xlsx'
import { TextEncoder, TextDecoder } from 'util'
import { buildTemplateWorkbook, TEMPLATE_ROWS } from './importTemplateWorkbook'
import { detectMapping } from './childImport'
import { AVAILABLE_FIELDS, SAMPLE_ROW } from '../components/registers/TemplateCreator'

global.TextEncoder = global.TextEncoder || TextEncoder
global.TextDecoder = global.TextDecoder || TextDecoder

const groups = [{ label: 'Tigers' }, { label: 'Year 6 & up' }]
const build = (opts = {}) => buildTemplateWorkbook(XLSX, { fields: AVAILABLE_FIELDS, groups, orgName: 'Tye Dye Drama', sample: SAMPLE_ROW, ...opts })
const sheetXml = bytes => new TextDecoder().decode(Uint8Array.from(XLSX.CFB.find(XLSX.CFB.read(bytes, { type: 'array' }), '/xl/worksheets/sheet1.xml').content))

test('the register sheet comes first, holds only headings, and every heading reads back as its field', () => {
  const wb = XLSX.read(build(), { type: 'array' })
  expect(wb.SheetNames).toEqual(['Register', 'How to fill this in', 'Groups'])
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Register, { header: 1, blankrows: false })
  expect(rows).toHaveLength(1)
  const mapping = detectMapping(rows[0])
  expect(AVAILABLE_FIELDS.map((f, i) => mapping[i])).toEqual(AVAILABLE_FIELDS.map(f => f.key))
})

test('the example lives on the help sheet, never on the sheet that is imported', () => {
  const wb = XLSX.read(build(), { type: 'array' })
  const help = XLSX.utils.sheet_to_json(wb.Sheets['How to fill this in'], { header: 1, blankrows: false })
  expect(help.flat()).toContain('Sarah')
  expect(JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets.Register, { header: 1 }))).not.toContain('Sarah')
})

test('yes/no columns get a strict dropdown and Group suggests the organisation\'s groups', () => {
  const xml = sheetXml(build())
  const boolCount = AVAILABLE_FIELDS.filter(f => f.bool).length
  expect(xml.match(/<formula1>"Yes,No"<\/formula1>/g)).toHaveLength(boolCount)
  expect(xml).toContain('<formula1>Groups!$A$2:$A$3</formula1>')
  expect(xml).toContain(`D2:D${TEMPLATE_ROWS + 1}`)
  expect(xml.indexOf('<dataValidations')).toBeGreaterThan(xml.indexOf('</sheetData>'))
  const wb = XLSX.read(build(), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(wb.Sheets.Groups, { header: 1 }).flat()).toEqual(['Groups', 'Tigers', 'Year 6 & up'])
})

test('with no groups there is no Groups sheet and no group dropdown', () => {
  const bytes = build({ groups: [] })
  expect(XLSX.read(bytes, { type: 'array' }).SheetNames).toEqual(['Register', 'How to fill this in'])
  expect(sheetXml(bytes)).not.toContain('Groups!')
})

test('a template with only some fields keeps their order', () => {
  const fields = ['last_name', 'first_name', 'has_epipen'].map(k => AVAILABLE_FIELDS.find(f => f.key === k))
  const wb = XLSX.read(build({ fields }), { type: 'array' })
  expect(XLSX.utils.sheet_to_json(wb.Sheets.Register, { header: 1 })[0]).toEqual(['Last Name', 'First Name', 'Carries an EpiPen'])
  expect(sheetXml(build({ fields }))).toContain('C2:C1001')
})
