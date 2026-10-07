// The register import template, as a spreadsheet someone can fill in.
//
// It used to be a CSV whose headings were database column names (`first_name`,
// `has_epipen`) with one invented child in the first data row. That child was
// imported along with everyone else whenever it was not deleted first, and the
// headings told nobody what to type.
//
// Now: friendly headings the importer reads back, an empty Register sheet,
// dropdowns where an answer is a choice, and the example and instructions on a
// separate sheet that the importer never reads. The importer only takes the
// first sheet, so Register must stay first.

export const TEMPLATE_ROWS = 1000

const xmlEscape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The community build of SheetJS writes no data validation, so the dropdowns
// are added to the finished file's sheet XML. Spreadsheet apps that do not
// support them simply show a plain column.
function addValidations(XLSX, written, rules) {
  const bytes = new Uint8Array(written)
  if (!rules.length) return bytes
  const zip = XLSX.CFB.read(bytes, { type: 'array' })
  const entry = XLSX.CFB.find(zip, '/xl/worksheets/sheet1.xml')
  if (!entry) return bytes
  const xml = new TextDecoder().decode(Uint8Array.from(entry.content))
  const block = `<dataValidations count="${rules.length}">${rules.join('')}</dataValidations>`
  // Schema order puts dataValidations after sheetData and mergeCells and
  // before hyperlinks and the page settings.
  const anchor = xml.search(/<(hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|drawing|legacyDrawing|tableParts|extLst)\b/)
  const next = anchor === -1 ? xml.replace('</worksheet>', `${block}</worksheet>`) : xml.slice(0, anchor) + block + xml.slice(anchor)
  entry.content = new TextEncoder().encode(next)
  return new Uint8Array(XLSX.CFB.write(zip, { fileType: 'zip', type: 'array' }))
}

/**
 * Build the template. `fields` are AVAILABLE_FIELDS entries, in column order.
 * Returns the .xlsx file's bytes.
 */
export function buildTemplateWorkbook(XLSX, { fields, groups = [], orgName = '', person = 'young person', people = 'young people', sample = {} }) {
  const headers = fields.map(f => f.label)
  const wb = XLSX.utils.book_new()

  const register = XLSX.utils.aoa_to_sheet([headers])
  register['!cols'] = fields.map(f => ({ wch: Math.max(14, f.label.length + 3) }))
  XLSX.utils.book_append_sheet(wb, register, 'Register')

  const groupNames = [...new Set(groups.map(g => String(g?.label || g?.name || g || '').trim()).filter(Boolean))]
  const hasBool = fields.some(f => f.bool)
  const hasGroup = fields.some(f => f.key === 'group_name')
  const help = [
    [`${orgName || 'Your organisation'}: register template`],
    [],
    ['How to fill this in'],
    [`1. Put one ${person} on each row of the Register sheet. Leave the headings in row 1 as they are.`],
    ['2. First Name and Last Name are needed on every row. Everything else is optional.'],
    ['3. Type dates of birth as DD/MM/YYYY, for example 14/06/2015.'],
    ...(hasBool ? [['4. Yes/No columns have a dropdown. A blank counts as No.']] : []),
    ...(hasGroup ? [[groupNames.length
      ? `${hasBool ? 5 : 4}. Group has a dropdown of your groups. You can also type a new one.`
      : `${hasBool ? 5 : 4}. Group is the group or class they belong to, if you use groups.`]] : []),
    [`When you are done, save the file and upload it in Registers → Import register. You will see every row before any ${people} are added.`],
    [],
    ['Example (for reference only, do not copy it onto the Register sheet)'],
    headers,
    fields.map(f => sample[f.key] ?? ''),
  ]
  const helpSheet = XLSX.utils.aoa_to_sheet(help)
  helpSheet['!cols'] = fields.map((f, i) => ({ wch: i === 0 ? 24 : Math.max(14, f.label.length + 3) }))
  XLSX.utils.book_append_sheet(wb, helpSheet, 'How to fill this in')

  let groupRange = null
  if (hasGroup && groupNames.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Groups'], ...groupNames.map(n => [n])]), 'Groups')
    groupRange = `Groups!$A$2:$A$${groupNames.length + 1}`
  }

  const rules = []
  fields.forEach((f, i) => {
    const col = XLSX.utils.encode_col(i)
    const sqref = `${col}2:${col}${TEMPLATE_ROWS + 1}`
    if (f.bool) {
      rules.push(`<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Yes or No" error="Choose Yes or No, or leave it blank." sqref="${sqref}"><formula1>"Yes,No"</formula1></dataValidation>`)
    } else if (f.key === 'group_name' && groupRange) {
      // A suggestion, not a rule: a new group is a legitimate answer.
      rules.push(`<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${sqref}"><formula1>${xmlEscape(groupRange)}</formula1></dataValidation>`)
    }
  })

  return addValidations(XLSX, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), rules)
}
