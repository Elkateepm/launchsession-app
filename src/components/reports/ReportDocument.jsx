import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import { getReportMetrics, buildSpec } from '../../lib/reportDocs'
import {
  DocShell, Section, Figures, Distribution, RankedList, Table, Prose, Caveats,
} from './docShared'

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
      setM(await getReportMetrics(reportKey, { from, to }))
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
      {spec?.sections?.map((s, i) => (
        <Section key={`${s.title}-${i}`} title={s.title} hint={s.hint}>
          <Prose lines={s.prose} />
          {(s.prose || []).filter(Boolean).length > 0 && (s.figures || []).filter(Boolean).length > 0 && (
            <div style={{ height: 18 }} />
          )}
          <Figures items={s.figures} isMobile={isMobile} />
          {(s.figures || []).filter(Boolean).length > 0 && s.distribution && <div style={{ height: 20 }} />}
          {s.distribution && <Distribution rows={s.distribution.rows} total={s.distribution.total} suffix={s.distribution.suffix} />}
          {s.ranked && <RankedList rows={s.ranked.rows} unit={s.ranked.unit} />}
          {s.table && (
            <>
              {((s.distribution?.rows) || []).length > 0 && <div style={{ height: 20 }} />}
              <Table columns={s.table.columns} rows={s.table.rows} />
            </>
          )}
          <Caveats items={s.caveats} />
        </Section>
      ))}
    </DocShell>
  )
}
