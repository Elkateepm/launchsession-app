import { supabase } from './supabase'
import { fromLegacy, normalizeInsights, previousPeriod } from './insights'
import { getReportMetrics } from './reportDocs'

// Data for Reports & Insights and the report studio. Every call here is an
// org-scoped aggregate: the database resolves the organisation from the
// signed-in user and never returns a row about an individual.

// PostgREST answers PGRST202 when a function is not in its schema cache, and
// Postgres 42883 when it does not exist at all.
export function isMissingFunction(error) {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883' ||
    /could not find the function|function .* does not exist/i.test(error.message || '')
}

const notAuthorised = (e) => /not authorised/i.test(e?.message || '')

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

// Some figures are owners-and-admins only and the database says so by
// refusing. That refusal is an answer -- "you cannot see this" -- not a
// failure of the whole page.
async function optional(promise) {
  try { return await promise } catch (e) { if (notAuthorised(e)) return null; throw e }
}

let insightsAvailable = null // learned once per page load

/**
 * The Insights model for a period, optionally narrowed to projects and groups.
 *
 * Uses report_insights_metrics when the database has it. Until that migration
 * is applied, falls back to the per-report aggregates that are already live,
 * which cover the same ground without filters, weekly points or volunteer
 * hours -- the model's `capabilities` tell the screens which.
 */
export async function loadInsights({ from, to, projects = [], groups = [] }) {
  if (insightsAvailable !== false) {
    try {
      const data = await rpc('report_insights_metrics', {
        p_from: from, p_to: to,
        p_project_ids: projects.length ? projects : null,
        p_groups: groups.length ? groups : null,
      })
      insightsAvailable = true
      return normalizeInsights(data)
    } catch (e) {
      if (!isMissingFunction(e)) throw e
      insightsAvailable = false
    }
  }
  const prev = previousPeriod({ from, to })
  const range = { from, to }
  const [delivery, attendance, young, projectsM, safeguarding, pDelivery, pYoung, pSafeguarding] = await Promise.all([
    getReportMetrics('delivery', range),
    getReportMetrics('attendance', range),
    getReportMetrics('young_people', range),
    getReportMetrics('project', range),
    optional(getReportMetrics('safeguarding', range)),
    getReportMetrics('delivery', prev),
    getReportMetrics('young_people', prev),
    optional(getReportMetrics('safeguarding', prev)),
  ])
  return fromLegacy({
    from, to,
    cur: { delivery, attendance, young, projects: projectsM, safeguarding },
    prev: { delivery: pDelivery, young: pYoung, safeguarding: pSafeguarding },
  })
}

/** The single-report aggregates a studio report's in-depth sections need. */
export async function loadDocs(keys, range) {
  const pairs = await Promise.all(keys.map(async k => {
    try { return [k, await getReportMetrics(k, range)] } catch (e) {
      if (notAuthorised(e)) return [k, null]
      throw e
    }
  }))
  return Object.fromEntries(pairs)
}

// ─────────────────────────────────────────────────────────── saved reports

export async function insertReportDefinition(orgId, userId, row) {
  const { data, error } = await supabase.from('reports')
    .insert({ ...row, org_id: orgId, created_by: userId })
    .select().single()
  if (error) throw error
  return data
}

export async function updateReportDefinition(id, row) {
  const { data, error } = await supabase.from('reports')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function markReportRun(id) {
  await supabase.from('reports').update({ last_run_at: new Date().toISOString() }).eq('id', id)
}

/** Readable words for a refused save, which RLS reports as a bare policy error. */
export function saveErrorMessage(e) {
  const m = e?.message || ''
  if (/row-level security|permission denied|violates.*policy/i.test(m)) {
    return 'Your login cannot save reports. Owners, admins and staff can; you can still print or download this one.'
  }
  if (/report_type_check/i.test(m)) return 'This kind of report cannot be saved yet.'
  return m || 'Could not save the report.'
}

// ─────────────────────────────────────────────────────────── files

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
