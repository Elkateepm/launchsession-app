import {
  parseDelimited, detectDelimiter, fieldForHeader, detectMapping,
  splitFullName, normaliseDate, matchGroup, buildImport, normalisePhone,
} from './childImport'

describe('parseDelimited', () => {
  it('keeps a quoted comma inside its cell', () => {
    expect(parseDelimited('a,b\n"Smith, Jane",Tigers')).toEqual([['a', 'b'], ['Smith, Jane', 'Tigers']])
  })

  // The old parser split on "\n" before looking at quotes, so a medical note
  // with a line break in it became two broken rows.
  it('keeps a quoted newline inside its cell', () => {
    const rows = parseDelimited('name,notes\nJane,"Asthma.\nInhaler with staff."')
    expect(rows).toHaveLength(2)
    expect(rows[1][1]).toBe('Asthma.\nInhaler with staff.')
  })

  it('unescapes doubled quotes', () => {
    expect(parseDelimited('a\n"He said ""hi"""')[1][0]).toBe('He said "hi"')
  })

  it('handles CRLF and a trailing newline without inventing a row', () => {
    expect(parseDelimited('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('reads tab-separated text, which is what pasting from Excel gives you', () => {
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
    expect(parseDelimited('first\tlast\nJane\tSmith')).toEqual([['first', 'last'], ['Jane', 'Smith']])
  })

  it('strips a BOM so the first header still matches', () => {
    expect(parseDelimited('﻿Surname,Forename')[0][0]).toBe('Surname')
  })
})

describe('fieldForHeader', () => {
  it.each([
    ['Surname', 'last_name'],
    ['Forename', 'first_name'],
    ['First Name', 'first_name'],
    ['DOB', 'date_of_birth'],
    ['Date of Birth', 'date_of_birth'],
    ['Class', 'group_name'],
    ['Team', 'group_name'],
    ['Allergies', 'allergies'],
    ['SEN/SEND', 'sen'],
    ['Parent / Carer Name', 'parent_name'],
    ['Emergency Contact Phone', 'emergency_contact_phone'],
    ['EpiPen', 'has_epipen'],
    ["Child's First Name", 'first_name'],
  ])('reads %s as %s', (header, field) => {
    expect(fieldForHeader(header)).toBe(field)
  })

  it('prefers the more specific column when both could match', () => {
    expect(fieldForHeader('Emergency Contact Name')).toBe('emergency_contact_name')
    expect(fieldForHeader('Parent Name')).toBe('parent_name')
    expect(fieldForHeader('Name')).toBe('full_name')
  })

  it('returns null for a column it does not recognise', () => {
    expect(fieldForHeader('Gift Aid Reference')).toBeNull()
  })
})

describe('detectMapping', () => {
  it('maps a typical school export', () => {
    expect(detectMapping(['Surname', 'Forename', 'DOB', 'Class', 'Allergies'])).toEqual({
      0: 'last_name', 1: 'first_name', 2: 'date_of_birth', 3: 'group_name', 4: 'allergies',
    })
  })

  it('claims each field once, leaving the second column for the user to map', () => {
    const m = detectMapping(['Surname', 'Family Name'])
    expect(m).toEqual({ 0: 'last_name' })
  })
})

describe('splitFullName', () => {
  it.each([
    ['Jane Smith', 'Jane', 'Smith'],
    ['Smith, Jane', 'Jane', 'Smith'],
    ['Mary Jane Smith', 'Mary Jane', 'Smith'],
    ['Cher', 'Cher', ''],
    ['  Jane   Smith  ', 'Jane', 'Smith'],
  ])('splits %s', (input, first, last) => {
    expect(splitFullName(input)).toEqual({ first_name: first, last_name: last })
  })
})

describe('normaliseDate', () => {
  // The old importer sent the raw string to a Postgres date column.
  it('reads UK day-first dates', () => {
    expect(normaliseDate('14/05/2012')).toBe('2012-05-14')
    expect(normaliseDate('01/02/2013')).toBe('2013-02-01')
  })

  it('overrides day-first only when the numbers leave no choice', () => {
    expect(normaliseDate('2012/14/05')).toBe('2012-05-14')
    expect(normaliseDate('05/14/2012')).toBe('2012-05-14')
  })

  it.each([
    ['2012-05-14', '2012-05-14'],
    ['14-05-2012', '2012-05-14'],
    ['14.05.2012', '2012-05-14'],
    ['14 May 2012', '2012-05-14'],
  ])('reads %s', (input, expected) => expect(normaliseDate(input)).toBe(expected))

  it('converts an Excel serial number', () => {
    expect(normaliseDate(41043)).toBe('2012-05-14')
  })

  it('expands a two-digit year either side of the century', () => {
    expect(normaliseDate('14/05/12')).toBe('2012-05-14')
    expect(normaliseDate('14/05/98')).toBe('1998-05-14')
  })

  it('returns null rather than a wrong date', () => {
    expect(normaliseDate('31/02/2012')).toBeNull()
    expect(normaliseDate('not a date')).toBeNull()
    expect(normaliseDate('')).toBeNull()
  })
})

describe('matchGroup', () => {
  const groups = [{ label: 'Tigers' }, { label: 'bears' }, { label: 'Cubs' }]

  it('matches an existing group regardless of case or spacing', () => {
    expect(matchGroup('TIGERS', groups)).toBe('Tigers')
    expect(matchGroup(' Bears ', groups)).toBe('bears')
  })

  it('keeps an unknown group as typed, so it can be reported as new', () => {
    expect(matchGroup('Pandas', groups)).toBe('Pandas')
  })
})

describe('buildImport', () => {
  const mapping = { 0: 'last_name', 1: 'first_name', 2: 'date_of_birth', 3: 'group_name' }
  const groups = [{ label: 'Tigers' }]

  it('imports the good rows and reports the rest, rather than failing the file', () => {
    const { ready, skipped } = buildImport({
      rows: [
        ['Smith', 'Jane', '14/05/2012', 'Tigers'],
        ['', '', '', 'Tigers'],
        ['Jones', '', '', 'Tigers'],
        ['Chen', 'River', '02/09/2013', 'tigers'],
      ],
      mapping, groups,
    })
    expect(ready.map(r => `${r.first_name} ${r.last_name}`)).toEqual(['Jane Smith', 'River Chen'])
    expect(skipped.map(s => [s.rowNumber, s.reason])).toEqual([
      [3, 'No name in this row'],
      [4, 'No first name'],
    ])
  })

  it('normalises the date and matches the group to the one you already have', () => {
    const { ready } = buildImport({ rows: [['Smith', 'Jane', '14/05/2012', 'tigers']], mapping, groups })
    expect(ready[0]).toMatchObject({ date_of_birth: '2012-05-14', group_name: 'Tigers', active: true })
  })

  it('holds back children already on the register instead of creating a second copy', () => {
    const { ready, duplicates } = buildImport({
      rows: [['Smith', 'Jane', '', ''], ['Chen', 'River', '', '']],
      mapping, groups,
      existing: [{ id: 'c1', first_name: 'jane', last_name: 'SMITH' }],
    })
    expect(ready.map(r => r.first_name)).toEqual(['River'])
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]).toMatchObject({ name: 'Jane Smith', reason: 'Already on your register' })
    expect(duplicates[0].existing.id).toBe('c1')
  })

  it('catches a child listed twice within the same file', () => {
    const { ready, duplicates } = buildImport({
      rows: [['Smith', 'Jane', '', ''], ['Smith', 'Jane', '', '']],
      mapping, groups,
    })
    expect(ready).toHaveLength(1)
    expect(duplicates[0].reason).toBe('Appears twice in this file')
  })

  it('names groups that do not exist yet, so nobody lands in a group nobody made', () => {
    const { newGroups } = buildImport({
      rows: [['Smith', 'Jane', '', 'Pandas'], ['Chen', 'River', '', 'Tigers']],
      mapping, groups,
    })
    expect(newGroups).toEqual(['Pandas'])
  })

  it('splits a single Name column', () => {
    const { ready } = buildImport({ rows: [['Jane Smith', 'Tigers']], mapping: { 0: 'full_name', 1: 'group_name' }, groups })
    expect(ready[0]).toMatchObject({ first_name: 'Jane', last_name: 'Smith' })
  })

  it('reads ticks as booleans and strips punctuation from phone numbers', () => {
    const { ready } = buildImport({
      rows: [['Smith', 'Jane', 'Yes', '(07700) 900-123']],
      mapping: { 0: 'last_name', 1: 'first_name', 2: 'has_epipen', 3: 'emergency_contact_phone' },
    })
    expect(ready[0]).toMatchObject({ has_epipen: true, emergency_contact_phone: '07700900123' })
  })

  it('keeps the row when only the date is unreadable, and says so', () => {
    const { ready, skipped } = buildImport({ rows: [['Smith', 'Jane', 'sometime in 2012', '']], mapping, groups })
    expect(ready).toHaveLength(1)
    expect(ready[0].date_of_birth).toBeUndefined()
    expect(skipped[0]).toMatchObject({ rowNumber: 2, soft: true })
  })
})

describe('normalisePhone', () => {
  it('keeps digits and a leading plus', () => {
    expect(normalisePhone('+44 7700 900123')).toBe('+447700900123')
    expect(normalisePhone('n/a')).toBeNull()
  })
})
