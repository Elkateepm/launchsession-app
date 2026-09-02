import { useMemo } from 'react'
import { useModuleAccess } from '../context/ModuleAccessContext'

// One place that decides what an HR viewer may do, mirroring the SQL helpers
// hr_can_view() / hr_can_edit() / hr_sensitive_can_view() exactly.
//
// Scattering `role === 'admin'` through thirty components is how a UI ends up
// disagreeing with its own database. These are the only checks HR components
// should make, and every one of them has a policy behind it -- hiding a button
// is presentation, not access control.

export const HR_ROLES_VIEW = ['owner', 'admin', 'manager']
export const HR_ROLES_ADMIN = ['owner', 'admin']

export function hrAccessFor(role, levels) {
  const lvl = (key) => (levels && levels[key]) || 'edit'
  const isAdmin = HR_ROLES_ADMIN.includes(role)
  const isManager = HR_ROLES_VIEW.includes(role)

  const hrLevel = lvl('hr')
  const canView = isManager && hrLevel !== 'none'
  const canEdit = isManager && hrLevel === 'edit'

  // Mirrors hr_sensitive_can_view(): admins hold it inherently, everyone else
  // needs an explicit 'hr_sensitive' grant. Not a purchasable module -- an org
  // without it would otherwise lose disciplinary access entirely.
  const sensitive = levels ? levels.hr_sensitive : undefined
  const sensitiveView = isAdmin || sensitive === 'view' || sensitive === 'edit'
  const sensitiveEdit = isAdmin || sensitive === 'edit'

  return {
    isAdmin,
    isManager,
    canView,
    canEdit,
    // Employment terms, leaving dates and line-manager changes are admin-only,
    // matching the hr_staff write policy.
    canEditEmployment: isAdmin && hrLevel === 'edit',
    sensitiveView,
    sensitiveEdit,
  }
}

export function useHrAccess(role) {
  const { levels, loading } = useModuleAccess()
  return useMemo(
    () => ({ ...hrAccessFor(role, levels), loading }),
    [role, levels, loading],
  )
}

// ── Shared vocabulary, so a label is defined once ──────────────────────────
export const EMPLOYMENT_TYPES = [
  { key: 'employee', label: 'Employee' },
  { key: 'sessional', label: 'Sessional' },
  { key: 'volunteer', label: 'Volunteer' },
  { key: 'contractor', label: 'Contractor' },
  { key: 'trustee', label: 'Trustee' },
]

export const EMPLOYMENT_STATUSES = [
  { key: 'active', label: 'Active', tone: '#04713C', bg: '#E7F8ED' },
  { key: 'suspended', label: 'Suspended', tone: '#93500A', bg: '#FEF6E7' },
  { key: 'on_leave', label: 'On leave', tone: '#3730A3', bg: '#EEF2FF' },
  { key: 'leaving', label: 'Leaving', tone: '#93500A', bg: '#FEF6E7' },
  { key: 'left', label: 'Left', tone: '#5A5772', bg: '#F3F2F7' },
]

export const CONTRACT_TYPES = ['Permanent', 'Fixed term', 'Sessional', 'Volunteer', 'Casual']

export const PROBATION_STATUSES = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'passed', label: 'Passed' },
  { key: 'extended', label: 'Extended' },
  { key: 'further_review', label: 'Further review' },
  { key: 'ended', label: 'Employment ended' },
]

export function statusChip(key) {
  return EMPLOYMENT_STATUSES.find(s => s.key === key) || EMPLOYMENT_STATUSES[0]
}

// Dates are formatted for the UK throughout. toISOString() would shift a date
// recorded late on a British Summer Time evening back a day.
export function ukDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d)) return null
  return d.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function todayLondon() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
}

// Days until a date, in London terms. Negative means it has already passed.
export function daysUntil(value) {
  if (!value) return null
  const today = new Date(todayLondon() + 'T00:00:00Z')
  const target = new Date(String(value).slice(0, 10) + 'T00:00:00Z')
  if (isNaN(target)) return null
  return Math.round((target - today) / 86400000)
}
