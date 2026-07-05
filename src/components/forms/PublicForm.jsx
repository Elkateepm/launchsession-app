import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PARTS = window.location.pathname.split('/forms/')[1]?.split('/').filter(Boolean) || []
const ORG_SLUG = PARTS[0]
const FORM_ID = PARTS[1]

function FieldInput({ field, value, onChange }) {
  const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }
  switch (field.type) {
    case 'textarea':
      return <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
          <span>{field.label}{field.required && <span style={{ color: '#DC2626' }}> *</span>}</span>
        </label>
      )
    case 'select':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} style={inp}>
          <option value="">Select an option...</option>
          {(field.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      )
    case 'date':
      return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} style={inp} />
    case 'number':
      return <input type="number" value={value || ''} onChange={e => onChange(e.target.value)} style={inp} />
    case 'email':
      return <input type="email" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="name@example.com" style={inp} />
    case 'phone':
      return <input type="tel" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="07123 456789" style={inp} />
    default:
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} style={inp} />
  }
}

export default function PublicForm() {
  const [org, setOrg] = useState(null)
  const [form, setForm] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'notfound' | 'submitting' | 'done'
  const [data, setData] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ORG_SLUG || !FORM_ID) { setStatus('notfound'); return }
    let cancelled = false
    ;(async () => {
      const { data: orgRow } = await supabase.from('organisations').select('id, name, slug, logo_url, primary_color').eq('slug', ORG_SLUG).maybeSingle()
      if (cancelled) return
      if (!orgRow) { setStatus('notfound'); return }
      setOrg(orgRow)

      const { data: formRow } = await supabase.from('org_forms').select('*').eq('id', FORM_ID).eq('org_id', orgRow.id).eq('is_active', true).maybeSingle()
      if (cancelled) return
      if (!formRow) { setStatus('notfound'); return }
      setForm(formRow)
      setStatus('ready')
    })()
    return () => { cancelled = true }
  }, [])

  const primary = org?.primary_color || '#1B9AAA'

  const setField = (label, value) => setData(d => ({ ...d, [label]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const missing = (form.fields || []).find(f => f.required && !data[f.label] && f.type !== 'checkbox')
    const missingCheckbox = (form.fields || []).find(f => f.required && f.type === 'checkbox' && !data[f.label])
    if (missing || missingCheckbox) { setError('Please fill in all required fields before submitting.'); return }
    setError('')
    setStatus('submitting')
    const { error: insertError } = await supabase.from('form_submissions').insert({ form_id: form.id, org_id: org.id, data })
    if (insertError) { setError('Something went wrong submitting your form. Please try again.'); setStatus('ready'); return }
    setStatus('done')
  }

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F6F8FC' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTop: '3px solid #1B9AAA', borderRadius: '50%', animation: 'ls-spin 0.8s linear infinite' }} />
        <style>{`@keyframes ls-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F6F8FC', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Form Not Found</div>
        <div style={{ fontSize: 14, color: '#64748B', maxWidth: 340 }}>This form link may be inactive, or the address might be incorrect. Please check with the organisation that shared it.</div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F6F8FC', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 4 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#0F172A' }}>Thank you!</div>
        <div style={{ fontSize: 14, color: '#64748B', maxWidth: 340 }}>Your response has been submitted to {org?.name}.</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 15% 0%, #6D5DF60C, transparent 40%), radial-gradient(circle at 85% 15%, #30C48D0C, transparent 40%), #F6F8FC', padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Org header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {org?.logo_url
            ? <img src={org.logo_url} alt={org.name} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 4, border: `1.5px solid ${primary}30` }} />
            : <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: '#fff' }}>{org?.name?.[0] || '?'}</div>
          }
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{org?.name}</div>
        </div>

        {/* Form card */}
        <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 24, padding: '28px 26px', boxShadow: '0 20px 60px -24px rgba(30,41,59,0.15)' }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#0F172A', marginBottom: form.description ? 6 : 20 }}>{form.name}</div>
          {form.description && <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 22, lineHeight: 1.5 }}>{form.description}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {(form.fields || []).map((field, i) => (
                <div key={i}>
                  {field.type !== 'checkbox' && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 7 }}>
                      {field.label}{field.required && <span style={{ color: '#DC2626' }}> *</span>}
                    </div>
                  )}
                  <FieldInput field={field} value={data[field.label]} onChange={v => setField(field.label, v)} />
                </div>
              ))}
            </div>

            {error && <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 13, fontWeight: 600 }}>{error}</div>}

            <button type="submit" disabled={status === 'submitting'}
              style={{ marginTop: 22, width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: status === 'submitting' ? '#9CA3AF' : `linear-gradient(135deg, ${primary}, ${primary}CC)`, color: '#fff', fontWeight: 800, fontSize: 15, cursor: status === 'submitting' ? 'default' : 'pointer' }}>
              {status === 'submitting' ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11.5, color: '#94A3B8' }}>Powered by LaunchSession</div>
      </div>
    </div>
  )
}
