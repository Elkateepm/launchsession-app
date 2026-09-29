// Reading whatever spreadsheet an organisation already has.
//
// The importer used to require a header row spelling `first_name` and
// `last_name` exactly, and rejected the whole file if one row was short. Real
// registers arrive as "Surname", "Forename", "DOB", "Class", "Parent/Carer",
// "Mobile" — or as a single "Name" column — so the common case was a file that
// looked fine to the person holding it and produced an error on every row.
//
// Everything here is pure so it can be tested without a browser or a database.

// ─── PARSING ────────────────────────────────────────────────────────────────

/**
 * Split delimited text into rows of cells.
 *
 * Hand-rolled rather than regex: a quoted cell may contain the delimiter, a
 * newline, or an escaped quote (""), and the previous parser split on "\n"
 * first, so a medical note containing a line break silently became two broken
 * rows.
 */
export function parseDelimited(text, delimiter = null) {
  const src = String(text || '').replace(/^﻿/, '')
  if (!src.trim()) return []
  const delim = delimiter || detectDelimiter(src)

  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ }   // escaped quote
        else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === delim) { row.push(cell); cell = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    cell += ch
  }
  row.push(cell)
  rows.push(row)

  return rows
    .map(r => r.map(c => c.trim()))
    .filter(r => r.some(c => c !== ''))
}

/** Comma, tab or semicolon — whichever is most consistent across the header. */
export function detectDelimiter(text) {
  const firstLine = String(text).split(/\r?\n/)[0] || ''
  const counts = [',', '\t', ';'].map(d => [d, (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length])
  const [best, n] = counts.sort((a, b) => b[1] - a[1])[0]
  return n > 0 ? best : ','
}

// ─── COLUMN DETECTION ───────────────────────────────────────────────────────

export const normaliseHeader = (h) => String(h || '')
  .toLowerCase()
  .replace(/[_\-./\\]+/g, ' ')
  .replace(/[^a-z0-9 ]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

// `full_name` is not a column on `children`; it is a shape a file arrives in,
// and is split into first and last during the build.
export const FIELD_SYNONYMS = {
  full_name: ['name', 'full name', 'child name', 'childs name', 'child', 'pupil', 'pupil name', 'student', 'student name', 'young person', 'young persons name', 'participant', 'participant name', 'member', 'member name'],
  first_name: ['first name', 'firstname', 'first', 'forename', 'forenames', 'given name', 'given names', 'christian name', 'childs first name', 'pupil first name'],
  last_name: ['last name', 'lastname', 'last', 'surname', 'family name', 'second name', 'childs last name', 'pupil surname'],
  date_of_birth: ['date of birth', 'dob', 'd o b', 'birth date', 'birthday', 'born', 'date born'],
  group_name: ['group', 'group name', 'class', 'team', 'bubble', 'cohort', 'squad', 'year group', 'session group'],
  school: ['school', 'school name', 'education setting', 'setting'],
  parent_name: ['parent name', 'parent', 'carer', 'carer name', 'guardian', 'guardian name', 'parent carer', 'parent carer name', 'parent or carer', 'mother', 'father', 'mum', 'dad', 'next of kin'],
  parent_phone: ['parent phone', 'parent mobile', 'parent number', 'parent contact number', 'parent tel', 'carer phone', 'carer mobile', 'guardian phone', 'contact number', 'contact phone', 'phone', 'telephone', 'mobile', 'mobile number', 'tel', 'phone number'],
  parent_email: ['parent email', 'carer email', 'guardian email', 'email', 'email address', 'e mail', 'contact email'],
  emergency_contact_name: ['emergency contact', 'emergency contact name', 'emergency name', 'in case of emergency', 'ice', 'ice name'],
  emergency_contact_phone: ['emergency contact phone', 'emergency phone', 'emergency number', 'emergency contact number', 'emergency tel', 'ice number', 'ice phone'],
  allergies: ['allergies', 'allergy', 'allergens', 'allergen'],
  medical_notes: ['medical notes', 'medical', 'medical info', 'medical information', 'medical conditions', 'conditions', 'health', 'health notes'],
  medication_details: ['medication details', 'medication', 'medicines', 'medicine', 'meds'],
  sen: ['sen', 'send', 'additional needs', 'special needs', 'ehcp', 'learning needs', 'sen send'],
  notes: ['notes', 'other notes', 'comments', 'additional information', 'additional info', 'other'],
  has_asthma: ['asthma', 'has asthma', 'asthmatic'],
  has_diabetes: ['diabetes', 'has diabetes', 'diabetic'],
  has_epipen: ['epipen', 'epi pen', 'carries an epipen', 'has epipen'],
  takes_medication: ['takes medication', 'on medication', 'medication required'],
  has_behaviour_plan: ['behaviour plan', 'support plan', 'has a support plan', 'behavior plan', 'iep'],
  behaviour_plan_notes: ['behaviour plan notes', 'support plan notes'],
  travel_consent: ['travel consent', 'can travel home alone', 'travels home alone', 'home alone', 'walks home', 'self release'],
}

export const BOOLEAN_FIELDS = new Set(['has_asthma', 'has_diabetes', 'has_epipen', 'takes_medication', 'has_behaviour_plan', 'travel_consent'])

// Longest synonym first, so "emergency contact phone" is decided before
// "phone" and "parent name" before "name" can claim it.
const SYNONYM_INDEX = Object.entries(FIELD_SYNONYMS)
  .flatMap(([field, list]) => list.map(syn => ({ field, syn: normaliseHeader(syn) })))
  .sort((a, b) => b.syn.length - a.syn.length)

/** The field a single header names, or null. */
export function fieldForHeader(header) {
  const h = normaliseHeader(header)
  if (!h) return null
  const exact = SYNONYM_INDEX.find(e => e.syn === h)
  if (exact) return exact.field
  // Only then a containment match, longest synonym first, so
  // "Child's First Name (legal)" still resolves.
  const partial = SYNONYM_INDEX.find(e => e.syn.length >= 4 && h.includes(e.syn))
  return partial ? partial.field : null
}

/**
 * headers -> { [columnIndex]: field }. A field is claimed once: if two columns
 * both look like "Surname" the second is left unmapped rather than silently
 * overwriting the first.
 */
export function detectMapping(headers = []) {
  const mapping = {}
  const taken = new Set()
  headers.forEach((h, i) => {
    const field = fieldForHeader(h)
    if (field && !taken.has(field)) { mapping[i] = field; taken.add(field) }
  })
  return mapping
}

// ─── VALUE NORMALISATION ────────────────────────────────────────────────────

/** "Smith, Jane" and "Jane Smith" both give Jane / Smith. */
export function splitFullName(value) {
  const v = String(value || '').trim().replace(/\s+/g, ' ')
  if (!v) return { first_name: '', last_name: '' }
  if (v.includes(',')) {
    const [last, first] = v.split(',').map(s => s.trim())
    return { first_name: first || '', last_name: last || '' }
  }
  const parts = v.split(' ')
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts[parts.length - 1] }
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const pad = n => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

/**
 * A date of birth as YYYY-MM-DD, or null.
 *
 * Ambiguous numeric dates are read day-first. This is a UK product — the app
 * formats every date en-GB — and the previous importer passed the raw string
 * straight to a Postgres `date` column, so "14/05/2012" either failed the whole
 * insert or, worse, landed as a different day.
 */
export function normaliseDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !isNaN(value)) return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())

  const raw = String(value).trim()
  if (!raw) return null

  // Excel serial number
  if (/^\d{1,6}(\.\d+)?$/.test(raw)) {
    const n = Number(raw)
    if (n > 1000 && n < 80000) {
      const d = new Date(EXCEL_EPOCH + Math.round(n) * 86400000)
      return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    }
    return null
  }

  let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)   // ISO-ish
  if (m) {
    // Year first is normally Y-M-D, but a middle value over 12 can only be a
    // day, so the remaining pair is unambiguous.
    if (+m[2] > 12 && +m[3] <= 12) return valid(+m[1], +m[3], +m[2])
    return valid(+m[1], +m[2], +m[3])
  }

  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)     // d/m/y
  if (m) {
    let [, a, b, y] = m
    let year = +y
    if (year < 100) year += year > 30 ? 1900 : 2000
    // A value over 12 in the first position can only be a day; over 12 in the
    // second can only be a month, which is the one case that overrides
    // day-first order.
    if (+a > 12 && +b <= 12) return valid(year, +b, +a)
    if (+b > 12 && +a <= 12) return valid(year, +a, +b)
    return valid(year, +b, +a)
  }

  // Written-out dates only, and only when a month name, a day and a four-digit
  // year are all present. Handing the whole string to `new Date` accepted
  // "sometime in 2012" and returned 1 January -- a date of birth invented from
  // nothing is worse than an empty field, because it looks answered.
  if (/[a-z]{3}/i.test(raw) && /\b\d{4}\b/.test(raw) && /\b\d{1,2}\b/.test(raw)) {
    const parsed = new Date(raw.replace(/(\d+)(st|nd|rd|th)/gi, '$1'))
    if (!isNaN(parsed)) return iso(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
  }
  return null
}

function valid(y, mo, d) {
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null
  return iso(y, mo, d)
}

const TRUTHY = new Set(['yes', 'y', 'true', '1', 'x', 'yes ', 'tick', 'ticked'])
export const isTruthy = v => TRUTHY.has(String(v || '').trim().toLowerCase())

export const normalisePhone = v => String(v || '').replace(/[^0-9+]/g, '').slice(0, 24) || null

/** Match a group to one the organisation already has, case and spacing aside. */
export function matchGroup(value, groups = []) {
  const v = normaliseHeader(value)
  if (!v) return null
  const hit = groups.find(g => normaliseHeader(g.label || g) === v)
  return hit ? (hit.label || hit) : String(value).trim()
}

export const personKey = (first, last) => `${normaliseHeader(first)}|${normaliseHeader(last)}`

// ─── BUILD ──────────────────────────────────────────────────────────────────

/**
 * Turn parsed rows into records ready for /api/import-children.
 *
 * Rows that cannot be imported are returned with a reason rather than failing
 * the file: a register of eighty children with two missing surnames should
 * import seventy-eight and tell you about the two.
 */
export function buildImport({ rows = [], mapping = {}, groups = [], existing = [] } = {}) {
  const existingKeys = new Map()
  existing.forEach(c => existingKeys.set(personKey(c.first_name, c.last_name), c))

  const ready = []
  const duplicates = []
  const skipped = []
  const seenInFile = new Map()
  const groupsSeen = new Set()

  rows.forEach((cells, index) => {
    const rowNumber = index + 2          // +1 for the header, +1 for 1-based
    const record = {}
    let full = ''

    Object.entries(mapping).forEach(([col, field]) => {
      const raw = cells[Number(col)]
      if (raw === undefined || String(raw).trim() === '') return
      const value = String(raw).trim()
      if (field === 'full_name') { full = value; return }
      if (field === 'date_of_birth') {
        const d = normaliseDate(raw)
        if (d) record.date_of_birth = d
        else skipped.push({ rowNumber, reason: `Could not read the date of birth "${value}"`, soft: true })
        return
      }
      if (field === 'group_name') { record.group_name = matchGroup(value, groups); groupsSeen.add(record.group_name); return }
      if (BOOLEAN_FIELDS.has(field)) { record[field] = isTruthy(value); return }
      if (field === 'parent_phone' || field === 'emergency_contact_phone') { record[field] = normalisePhone(value); return }
      record[field] = value
    })

    if (full && (!record.first_name || !record.last_name)) {
      const split = splitFullName(full)
      record.first_name = record.first_name || split.first_name
      record.last_name = record.last_name || split.last_name
    }

    const name = `${record.first_name || ''} ${record.last_name || ''}`.trim()
    if (!record.first_name && !record.last_name) {
      skipped.push({ rowNumber, reason: 'No name in this row', name: '' }); return
    }
    if (!record.first_name || !record.last_name) {
      skipped.push({ rowNumber, reason: record.first_name ? 'No surname' : 'No first name', name }); return
    }

    const key = personKey(record.first_name, record.last_name)
    if (seenInFile.has(key)) { duplicates.push({ rowNumber, name, record, reason: 'Appears twice in this file' }); return }
    seenInFile.set(key, true)

    if (existingKeys.has(key)) {
      duplicates.push({ rowNumber, name, record, existing: existingKeys.get(key), reason: 'Already on your register' })
      return
    }

    record.active = true
    ready.push(record)
  })

  const known = new Set(groups.map(g => normaliseHeader(g.label || g)))
  const newGroups = [...groupsSeen].filter(g => g && !known.has(normaliseHeader(g)))

  return { ready, duplicates, skipped, newGroups }
}
