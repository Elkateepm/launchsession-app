import { medicalFlag } from './medicalFlag'

test('the register flag names the most urgent medical need first', () => {
  expect(medicalFlag({ has_epipen: true, has_asthma: true })).toEqual({ label: 'EpiPen +1', detail: 'Medical: EpiPen, Asthma' })
  expect(medicalFlag({ has_asthma: true })).toEqual({ label: 'Asthma', detail: 'Medical: Asthma' })
  expect(medicalFlag({ takes_medication: true, medication_details: 'Inhaler' }).detail).toBe('Medical: Medication (Inhaler)')
  expect(medicalFlag({ medical_notes: 'Gets migraines' })).toEqual({ label: 'Medical note', detail: 'Medical: Medical note (Gets migraines)' })
})

test('allergies keep their own flag, and an empty note raises none', () => {
  expect(medicalFlag({ allergies: 'Peanuts' })).toBe(null)
  expect(medicalFlag({ medical_notes: 'None' })).toBe(null)
  expect(medicalFlag({})).toBe(null)
  expect(medicalFlag(null)).toBe(null)
})
