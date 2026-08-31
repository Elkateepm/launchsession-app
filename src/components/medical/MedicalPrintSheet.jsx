import React from 'react'
import { format } from 'date-fns'
import { TIERS } from './medicalShared'

// ─── PRINTED MEDICATION LIST ─────────────────────────────────
// The one place this information is needed most is the one place the app cannot
// reach it: a trip, a field, a hall with no signal. Staff print a med list and
// put it in the first aid bag, and until now that meant screenshotting a page
// that hid the detail behind a tap.
//
// Black on white, no chips, no avatars, the text spelled out in full, and a
// footer that dates it -- a printout with no date on it is one nobody can tell
// is out of date.

const PRINT_CSS = `
@media print {
  body > * { display: none !important; }
  body > #ls-med-print-root { display: block !important; }
  #ls-med-print-root { position: static !important; inset: auto !important;
    background: #fff !important; overflow: visible !important; }
  #ls-med-print-toolbar { display: none !important; }
  #ls-med-paper { box-shadow: none !important; margin: 0 !important;
    padding: 0 !important; max-width: none !important; }
  .ls-med-row { break-inside: avoid; page-break-inside: avoid; }
}
@page { margin: 14mm 12mm; }
`

export default function MedicalPrintSheet({ org, rows, scopeLabel, todaySessions, onClose }) {
  const ctl = {
    padding: '9px 13px', borderRadius: 9, border: '1.5px solid #E2E8F0',
    fontSize: 13, fontWeight: 800, fontFamily: 'inherit', minHeight: 40,
    background: '#fff', color: '#111827', cursor: 'pointer',
  }

  return (
    <div id="ls-med-print-root" style={{ position: 'fixed', inset: 0, zIndex: 10800, background: '#F1F5F9', overflowY: 'auto' }}>
      <style>{PRINT_CSS}</style>

      <div id="ls-med-print-toolbar" style={{
        position: 'sticky', top: 0, zIndex: 2, background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <button onClick={onClose} style={{ ...ctl, border: 'none', background: '#F1F5F9' }}>← Back</button>
        <div style={{ fontSize: 13.5, fontWeight: 900, color: '#111827', marginRight: 'auto' }}>
          Medication list — {scopeLabel}
        </div>
        <button onClick={() => window.print()} style={{ ...ctl, border: 'none', background: '#111827', color: '#fff' }}>
          Print or save as PDF
        </button>
      </div>

      <div id="ls-med-paper" style={{
        maxWidth: 820, margin: '22px auto', background: '#fff', padding: '40px 46px',
        borderRadius: 4, boxShadow: '0 10px 40px rgba(15,23,42,0.10)', color: '#111827', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: '#6B7280', textTransform: 'uppercase' }}>{org?.name}</div>
        <h1 style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 900, letterSpacing: -0.6 }}>Medication and allergy list</h1>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 6 }}>
          {scopeLabel}
          {todaySessions?.length > 0 && ` · ${todaySessions.map(s => s.title).join(', ')}`}
        </div>

        <div style={{
          marginTop: 16, padding: '10px 13px', border: '1.5px solid #FECACA',
          background: '#FEF2F2', borderRadius: 8, fontSize: 12, color: '#7F1D1D', lineHeight: 1.55,
        }}>
          Confidential. This sheet holds medical information about {rows.length === 1 ? 'a child' : 'children'} in
          your care. Keep it with the first aid kit, do not leave it unattended, and destroy it when the session ends.
        </div>

        <div style={{ height: 1, background: '#E5E7EB', margin: '20px 0 4px' }} />

        {rows.length === 0 ? (
          <div style={{ padding: '30px 0', fontSize: 13, color: '#6B7280' }}>Nobody in this list.</div>
        ) : rows.map(({ child, flags, tier }) => (
          <div className="ls-med-row" key={child.id} style={{
            padding: '14px 0', borderBottom: '1px solid #F3F4F6',
            borderLeft: tier === 1 ? '3px solid #B91C1C' : 'none',
            paddingLeft: tier === 1 ? 11 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15.5, fontWeight: 900 }}>{child.first_name} {child.last_name}</span>
              {child.group_name && <span style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 700 }}>{child.group_name}</span>}
              {tier === 1 && (
                <span style={{ fontSize: 10, fontWeight: 900, color: '#B91C1C', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {TIERS[1].label}
                </span>
              )}
            </div>

            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {flags.map((f, i) => (
                <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 800 }}>{f.label}:</span>{' '}
                  <span style={{ color: f.detail ? '#374151' : '#9CA3AF' }}>
                    {f.detail || 'no further detail recorded'}
                  </span>
                </div>
              ))}
            </div>

            {(child.emergency_contact_name || child.emergency_contact_phone) && (
              <div style={{ marginTop: 6, fontSize: 12.5 }}>
                <span style={{ fontWeight: 800 }}>Emergency contact:</span>{' '}
                {child.emergency_contact_name || 'not named'}
                {child.emergency_contact_phone ? ` · ${child.emergency_contact_phone}` : ''}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 26, paddingTop: 12, borderTop: '1px solid #E5E7EB', fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
          Printed {format(new Date(), 'd MMMM yyyy, HH:mm')} · {rows.length} {rows.length === 1 ? 'person' : 'people'}.
          {' '}Information is only as current as the records it came from — check the app if anything here looks wrong.
        </div>
      </div>
    </div>
  )
}
