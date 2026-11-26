import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import { getReportMetrics, buildSpec } from '../../lib/reportDocs'
import { loadInsights } from '../../lib/insightsService'
import { DocShell, SpecSections } from './docShared'

// One renderer for every report in the library.
//
// Each report describes itself in reportDocs.js and this turns that description
// into the document. Nine components would have drifted apart the same way the
// nine reports did when they all shared one query.

export default function ReportDocument({ reportKey, title, org, range, onClose }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const [m, setM] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(range?.from || '')
  const [to, setTo] = useState(range?.to || '')

  const load = useCallback(async () => {
    if (!from || !to) return
    setLoading(true); setError('')
    try {
      // The delivery report is the snapshot of the period, so it also reads the
      // Insights aggregate for the comparison, the week-by-week shape and who
      // came. That part is optional: if it fails, the report is shorter, not
      // missing.
      const [metrics, snapshot] = await Promise.all([
        getReportMetrics(reportKey, { from, to }),
        reportKey === 'delivery' ? Promise.resolve().then(() => loadInsights({ from, to })).catch(() => null) : null,
      ])
      setM(snapshot ? { ...metrics, snapshot } : metrics)
    } catch (e) {
      // The safeguarding aggregate refuses a non-admin in the database as well
      // as in the UI, and that refusal should read as a refusal.
      setError(/not authorised/i.test(e.message || '')
        ? 'You do not have permission to run this report.'
        : (e.message || 'Could not build the report.'))
      setM(null)
    }
    setLoading(false)
  }, [reportKey, from, to])

  useEffect(() => { load() }, [load])

  const spec = useMemo(() => buildSpec(reportKey, m, terms), [reportKey, m, terms])

  return (
    <DocShell
      title={title || 'Report'}
      docTitle={spec?.docTitle || title || 'Report'}
      org={org} from={from} to={to} onFrom={setFrom} onTo={setTo}
      onClose={onClose} onPrint={() => window.print()}
      loading={loading} error={error} generatedAt={m?.generated_at}
      isMobile={isMobile}
    >
      <SpecSections sections={spec?.sections} isMobile={isMobile} org={org} />
    </DocShell>
  )
}
