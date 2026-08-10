import React, { useState, useEffect, useMemo } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  REPORT_LIBRARY, canAccessReport, getOverviewMetrics, saveReport,
} from '../../lib/reportingService'

// Sections offered per report type. Only sections the underlying data can
// actually populate are listed -- nothing here renders an empty promise.
const SECTIONS_BY_TYPE = {
  delivery:     ['summary', 'sessions', 'hours', 'locations', 'attendance'],
  programme:    ['summary', 'sessions', 'attendance', 'outcomes'],
  attendance:   ['summary', 'attendance', 'absences', 'trend'],
  young_people: ['summary', 'reached', 'attendance'],
  impact:       ['summary', 'outcomes', 'reached'],
  team:         ['summary', 'sessions', 'hours'],
  project:      ['summary', 'sessions', 'attendance', 'outcomes', 'locations'],
  funding:      ['summary', 'reached', 'sessions', 'hours', 'attendance', 'outcomes', 'locations'],
  safeguarding: ['summary', 'concerns'],
}

const SECTION_LABELS = {
  summary: 'Executive summary',
  reached: 'Young people reached',
  sessions: 'Sessions delivered',
  hours: 'Delivery hours',
  attendance: 'Attendance',
  trend: 'Attendance trend',
  absences: 'Absences',
  locations: 'Locations',
  outcomes: 'Outcomes',
  concerns: 'Safeguarding summary',
}

const fi = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#0F172A',
}
const lbl = { fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }

export default function ReportBuilder({ org, session, role, initialType, defaultRange, onClose, onSaved }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState(0)
  const [type, setType] = useState(initialType || 'delivery')
  const [from, setFrom] = useState(defaultRange?.from || '')
  const [to, setTo] = useState(defaultRange?.to || '')
  const [name, setName] = useState('')
  const [sections, setSections] = useState([])
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const available = useMemo(() => REPORT_LIBRARY.filter(r => canAccessReport(r, role)), [role])
  const meta = REPORT_LIBRARY.find(r => r.key === type)

  useEffect(() => {
    setSections(SECTIONS_BY_TYPE[type] || ['summary'])
    if (!name || REPORT_LIBRARY.some(r => r.name === name)) setName(meta?.name || 'Report')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const loadPreview = async () => {
    setLoadingPreview(true); setError('')
    try {
      setPreview(await getOverviewMetrics({ from, to }))
    } catch (e) {
      setError(e.message || 'Could not build the preview.')
      setPreview(null)
    }
    setLoadingPreview(false)
  }

  const next = async () => {
    if (step === 2) { await loadPreview() }
    setStep(s => Math.min(3, s + 1))
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await saveReport(org.id, session?.user?.id, {
        name: name.trim() || meta?.name || 'Report',
        report_type: type,
        date_from: from, date_to: to,
        filters: {},
        configuration: { sections },
      })
      onSaved && onSaved()
    } catch (e) {
      setError(e.message || 'Could not save the report.')
    }
    setSaving(false)
  }

  const STEPS = ['Report type', 'Scope', 'Content', 'Preview']
  const canNext = step === 0 ? !!type : step === 1 ? (from && to && to >= from) : true

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', zIndex: 10401, background: '#fff', display: 'flex', flexDirection: 'column',
        ...(isMobile ? { inset: 0 } : {
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(780px, 94vw)', maxHeight: '90vh', borderRadius: 18,
          boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
        }),
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>Create report</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 99, background: i <= step ? 'linear-gradient(90deg,#4F46E5,#3B82F6)' : '#E2E8F0' }} />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: i === step ? '#4F46E5' : '#94A3B8', marginTop: 5 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {step === 0 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>What do you want to report on?</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
                {available.map(r => (
                  <button key={r.key} onClick={() => setType(r.key)} style={{
                    textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer',
                    border: type === r.key ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                    background: type === r.key ? '#EEF2FF' : '#fff',
                  }}>
                    <div style={{ fontSize: 16, marginBottom: 6 }}>{r.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3, lineHeight: 1.45 }}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Choose scope</div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Report name</label>
                <input value={name} onChange={e => setName(e.target.value)} style={fi} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>From</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={fi} />
                </div>
                <div>
                  <label style={lbl}>To</label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)} style={fi} />
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: '#64748B', background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
                Programme and location filters aren't wired into the aggregate query yet — the report currently covers all
                delivery in the selected period. That's a documented gap rather than a silent one.
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Choose report content</div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>Only sections your data can fill are listed.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(SECTIONS_BY_TYPE[type] || []).map(s => (
                  <label key={s} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 10,
                    border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155',
                  }}>
                    <input type="checkbox" checked={sections.includes(s)}
                      onChange={e => setSections(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))} />
                    {SECTION_LABELS[s] || s}
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {loadingPreview ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Building preview…</div>
              ) : !preview ? (
                <div style={{ padding: 30, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Preview unavailable</div>
                  <div style={{ fontSize: 12.5, color: '#64748B' }}>{error || 'Try a different date range.'}</div>
                </div>
              ) : (
                <div id="ls-report-preview" style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: isMobile ? 18 : 26, background: '#fff' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: '#64748B', textTransform: 'uppercase' }}>{org?.name}</div>
                  <div style={{ fontSize: isMobile ? 19 : 23, fontWeight: 900, color: '#0F172A', marginTop: 6, letterSpacing: -0.5 }}>{name}</div>
                  <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
                    {new Date(`${from}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' – '}
                    {new Date(`${to}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>

                  <div style={{ height: 1, background: '#E2E8F0', margin: '18px 0' }} />

                  {sections.includes('summary') && (
                    <PreviewBlock title="Programme overview">
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 14 }}>
                        <Fig n={preview.reached} l="Young people reached" />
                        <Fig n={preview.delivered} l="Sessions delivered" />
                        <Fig n={preview.attendance_rate !== null ? `${preview.attendance_rate}%` : '—'} l="Attendance" />
                        <Fig n={`${preview.delivery_hours}h`} l="Delivery hours" />
                      </div>
                    </PreviewBlock>
                  )}
                  {sections.includes('sessions') && (
                    <PreviewBlock title="Delivery">
                      <Line k="Sessions in period" v={preview.sessions} />
                      <Line k="Sessions delivered" v={preview.delivered} />
                    </PreviewBlock>
                  )}
                  {sections.includes('hours') && (
                    <PreviewBlock title="Delivery hours">
                      <Line k="Total contact hours" v={`${preview.delivery_hours}h`} />
                    </PreviewBlock>
                  )}
                  {sections.includes('attendance') && (
                    <PreviewBlock title="Attendance">
                      <Line k="Attendance rate" v={preview.attendance_rate !== null ? `${preview.attendance_rate}%` : 'No register data'} />
                      <Line k="Attendances recorded" v={preview.attended} />
                      <Line k="Places marked" v={preview.marked} />
                    </PreviewBlock>
                  )}
                  {sections.includes('trend') && preview.prev_attendance_rate !== null && (
                    <PreviewBlock title="Attendance trend">
                      <Line k="Previous period" v={`${preview.prev_attendance_rate}%`} />
                      <Line k="Change" v={`${preview.attendance_rate - preview.prev_attendance_rate > 0 ? '+' : ''}${preview.attendance_rate - preview.prev_attendance_rate} points`} />
                    </PreviewBlock>
                  )}
                  {sections.includes('absences') && (
                    <PreviewBlock title="Absences">
                      <Line k="Recorded absences" v={preview.absences} />
                    </PreviewBlock>
                  )}
                  {sections.includes('reached') && (
                    <PreviewBlock title="Young people">
                      <Line k="Reached in period" v={preview.reached} />
                      <Line k="Active on roll" v={preview.young_people} />
                    </PreviewBlock>
                  )}
                  {sections.includes('locations') && (
                    <PreviewBlock title="Locations">
                      <Line k="Distinct locations used" v={preview.locations} />
                    </PreviewBlock>
                  )}
                  {sections.includes('outcomes') && (
                    <PreviewBlock title="Outcomes">
                      <Line k="Outcomes recorded" v={preview.outcomes} />
                    </PreviewBlock>
                  )}
                  {sections.includes('concerns') && (
                    <PreviewBlock title="Safeguarding">
                      <Line k="Open concerns" v={preview.open_concerns} />
                      <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 6 }}>
                        Aggregate only — no identifiable detail is included.
                      </div>
                    </PreviewBlock>
                  )}
                </div>
              )}

              {error && <div style={{ marginTop: 12, fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
            </>
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={btnGhost}>Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step === 3 && preview && (
            <button onClick={() => window.print()} style={btnGhost} title="Print or save as PDF via your browser">
              Print
            </button>
          )}
          {step < 3 ? (
            <button onClick={next} disabled={!canNext} style={{ ...btnPrimary, ...(canNext ? {} : { background: '#CBD5E1', cursor: 'default' }) }}>Continue</button>
          ) : (
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, ...(saving ? { background: '#CBD5E1', cursor: 'default' } : {}) }}>
              {saving ? 'Saving…' : 'Save report'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function PreviewBlock({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: '#4F46E5', textTransform: 'uppercase', marginBottom: 9 }}>{title}</div>
      {children}
    </div>
  )
}
function Fig({ n, l }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>{n}</div>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 2 }}>{l}</div>
    </div>
  )
}
function Line({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12.5 }}>
      <span style={{ color: '#64748B' }}>{k}</span>
      <span style={{ fontWeight: 800, color: '#0F172A' }}>{v}</span>
    </div>
  )
}

const btnPrimary = {
  padding: '11px 20px', borderRadius: 11, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
  background: 'linear-gradient(135deg,#4F46E5,#3B82F6)', cursor: 'pointer',
}
const btnGhost = {
  padding: '11px 18px', borderRadius: 11, border: '1px solid #E2E8F0', background: '#fff',
  color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
