import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../lib/icons'

// Public form experience.
//
// Seen by parents and carers on a phone, usually once, often in a hurry, and it
// is the only part of LaunchSession most of them will ever see. So it carries
// the organisation's branding rather than ours, asks one section at a time when
// a form is long, and never shows a raw validation error.

const PARTS = window.location.pathname.split('/forms/')[1]?.split('/').filter(Boolean) || []
const ORG_SLUG = PARTS[0]
const FORM_ID = PARTS[1]

const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

function isLightHex(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex || '')) return false
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170
}

const SECTION_SIZE = 6

// Only split when there is genuinely a lot to answer. Breaking a seven-question
// form into two screens adds a click and helps nobody.
function chunkFields(fields, multiStep) {
  if (!multiStep || fields.length <= SECTION_SIZE + 2) return [fields]
  const out = []
  for (let i = 0; i < fields.length; i += SECTION_SIZE) out.push(fields.slice(i, i + SECTION_SIZE))
  return out
}

function FieldInput({ field, value, onChange, invalid, accent, id }) {
  const base = {
    width: '100%', boxSizing: 'border-box', padding: '14px 15px', borderRadius: 12,
    border: `1.5px solid ${invalid ? '#DC2626' : '#E2E8F0'}`,
    // 16px keeps iOS Safari from zooming the viewport on focus.
    fontSize: 16, fontFamily: 'inherit', outline: 'none', background: '#fff',
    color: '#0F172A', transition: 'border-color 150ms ease, box-shadow 150ms ease',
  }
  const onFocus = e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22` }
  const onBlur = e => { e.target.style.borderColor = invalid ? '#DC2626' : '#E2E8F0'; e.target.style.boxShadow = 'none' }
  const common = { id, onFocus, onBlur, 'aria-invalid': invalid || undefined }

  switch (field.type) {
    case 'textarea':
      return <textarea {...common} value={value || ''} onChange={e => onChange(e.target.value)} rows={4}
        style={{ ...base, resize: 'vertical', minHeight: 104 }} />

    case 'checkbox':
      return (
        <label htmlFor={id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
          padding: '14px 15px', borderRadius: 12, background: value ? `${accent}0F` : '#fff',
          border: `1.5px solid ${value ? accent : invalid ? '#DC2626' : '#E2E8F0'}`,
          transition: 'background 150ms ease, border-color 150ms ease',
        }}>
          <input {...common} type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
            style={{ marginTop: 2, width: 20, height: 20, flexShrink: 0, accentColor: accent }} />
          <span style={{ fontSize: 15, color: '#0F172A', lineHeight: 1.45 }}>
            {/* Must match the builder preview, or staff approve wording that
                respondents never see. */}
            {field.checkboxText || field.label}
            {field.required && <span style={{ color: '#DC2626' }}> *</span>}
          </span>
        </label>
      )

    case 'select':
      // Short option lists render as tappable cards. On a phone these are
      // faster and far clearer than a native picker wheel.
      if ((field.options || []).length <= 5) {
        return (
          <div role="radiogroup" aria-labelledby={`${id}-label`} style={{ display: 'grid', gap: 8 }}>
            {(field.options || []).map((o, i) => {
              const active = value === o
              return (
                <button key={i} type="button" role="radio" aria-checked={active}
                  onClick={() => onChange(o)}
                  style={{
                    textAlign: 'left', padding: '14px 15px', borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${active ? accent : invalid ? '#DC2626' : '#E2E8F0'}`,
                    background: active ? `${accent}0F` : '#fff',
                    color: '#0F172A', fontSize: 15.5, fontWeight: active ? 700 : 500,
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 11,
                    transition: 'background 150ms ease, border-color 150ms ease',
                  }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${active ? accent : '#CBD5E1'}`,
                    background: active ? accent : '#fff',
                    boxShadow: active ? 'inset 0 0 0 3.5px #fff' : 'none',
                  }} />
                  {o}
                </button>
              )
            })}
          </div>
        )
      }
      return (
        <select {...common} value={value || ''} onChange={e => onChange(e.target.value)} style={base}>
          <option value="">Choose one…</option>
          {(field.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      )

    case 'date':   return <input {...common} type="date" value={value || ''} onChange={e => onChange(e.target.value)} style={base} />
    case 'number': return <input {...common} type="number" inputMode="decimal" value={value || ''} onChange={e => onChange(e.target.value)} style={base} />
    case 'email':  return <input {...common} type="email" inputMode="email" autoComplete="email" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="name@example.com" style={base} />
    case 'phone':  return <input {...common} type="tel" inputMode="tel" autoComplete="tel" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="07123 456789" style={base} />
    default:       return <input {...common} type="text" value={value || ''} onChange={e => onChange(e.target.value)} style={base} />
  }
}

function Shell({ org, primary, secondary, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FC', paddingBottom: 48 }}>
      <div style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        padding: '26px 20px 34px',
      }}>
        <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 15, background: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.16)', overflow: 'hidden',
          }}>
            <img src={org?.logo_url || FALLBACK_LOGO_URL} alt=""
              style={{
                width: org?.logo_url ? '100%' : 42, height: org?.logo_url ? '100%' : 42,
                objectFit: 'contain', padding: org?.logo_url ? 6 : 0,
              }} />
          </div>
          <div style={{
            fontSize: 19, fontWeight: 900, letterSpacing: -0.3, minWidth: 0,
            color: isLightHex(primary) && isLightHex(secondary) ? '#0F172A' : '#fff',
          }}>{org?.name}</div>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: '-18px auto 0', padding: '0 16px' }}>{children}</div>

      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11.5, color: '#94A3B8' }}>
        Powered by LaunchSession
      </div>
    </div>
  )
}

function Card({ children, pad = 24 }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 20, padding: pad,
      border: '1px solid #ECE9F5', boxShadow: '0 12px 32px -20px rgba(15,23,42,0.35)',
    }}>{children}</div>
  )
}

export default function PublicForm() {
  const [org, setOrg] = useState(null)
  const [form, setForm] = useState(null)
  const [status, setStatus] = useState('loading')  // loading | intro | ready | notfound | submitting | done
  const [data, setData] = useState({})
  const [step, setStep] = useState(0)
  const [invalid, setInvalid] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ORG_SLUG || !FORM_ID) { setStatus('notfound'); return }
    let cancelled = false
    ;(async () => {
      // One security-definer call. It returns a form only if it is public, live,
      // in date, and the slug matches its owning organisation -- so a form id
      // cannot be read under another org's URL.
      const { data: rows, error: rpcErr } = await supabase
        .rpc('get_public_form', { p_org_slug: ORG_SLUG, p_form_id: FORM_ID })
      if (cancelled) return
      if (rpcErr || !rows?.length) { setStatus('notfound'); return }

      const row = rows[0]
      setOrg({
        name: row.org_name,
        logo_url: row.org_logo_url,
        // A per-form accent overrides the org colour where one is set; almost
        // no form sets one, which is the intended default.
        primary_color: row.accent_color || row.org_primary_color,
        secondary_color: row.org_secondary_color,
      })
      setForm(row)
      setStatus('intro')
    })()
    return () => { cancelled = true }
  }, [])

  const primary = org?.primary_color || '#7C5CFC'
  const secondary = (org?.secondary_color && org.secondary_color.toLowerCase() !== primary.toLowerCase())
    ? org.secondary_color : '#6366F1'

  const fields = useMemo(() => form?.fields || [], [form])
  const sections = useMemo(() => chunkFields(fields, form?.multi_step), [fields, form])
  const isLast = step >= sections.length - 1

  const setField = (label, value) => {
    setData(d => ({ ...d, [label]: value }))
    setInvalid(list => list.filter(l => l !== label))
  }

  // A submission with no identifiable name is close to useless to whoever has
  // to review it, so take the most likely one from the answers themselves.
  const nameFrom = answers => {
    const key = Object.keys(answers).find(k => /name/i.test(k) && !/school|contact|gp|surgery/i.test(k))
    return key ? String(answers[key] || '').slice(0, 120) : null
  }

  // Submission is a click handler rather than a native form submit, so the
  // browser no longer runs its own type validation. An invalid email address
  // would otherwise pass simply for being non-empty.
  const formatProblem = fl => {
    const raw = String(data[fl.label] ?? '').trim()
    if (!raw) return null
    if (fl.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) return 'That email address does not look right.'
    if (fl.type === 'phone' && raw.replace(/[^\d]/g, '').length < 7) return 'That phone number looks too short.'
    if (fl.type === 'number' && Number.isNaN(Number(raw))) return 'Please enter a number.'
    return null
  }

  const validateSection = () => {
    const section = sections[step] || []

    const badFormat = section.filter(fl => formatProblem(fl))
    if (badFormat.length) {
      setInvalid(badFormat.map(fl => fl.label))
      setError(formatProblem(badFormat[0]))
      const bi = fields.findIndex(fl => fl.label === badFormat[0].label)
      document.getElementById(`fld-${bi}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return false
    }

    const missing = section
      .filter(fl => fl.required && (fl.type === 'checkbox' ? !data[fl.label] : !String(data[fl.label] ?? '').trim()))
      .map(fl => fl.label)
    setInvalid(missing)
    if (missing.length) {
      setError(missing.length === 1
        ? `Please answer: ${missing[0]}`
        : `Please answer the ${missing.length} highlighted questions.`)
      // Scroll to the first thing they missed rather than leaving them to hunt
      // for a red border on a long screen.
      const firstIdx = fields.findIndex(fl => fl.label === missing[0])
      document.getElementById(`fld-${firstIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return false
    }
    setError('')
    return true
  }

  const next = () => { if (validateSection()) { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) } }
  const back = () => { setError(''); setStep(s => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const submit = async () => {
    if (!validateSection()) return
    setStatus('submitting')
    const { error: e } = await supabase.rpc('submit_public_form', {
      p_form_id: form.id, p_data: data, p_name: nameFrom(data),
    })
    if (e) {
      // The answers are still in state. Saying so is the difference between
      // trying again and giving up.
      setError("We couldn't send your form just then. Your answers are still here — please try again.")
      setStatus('ready')
      return
    }
    setStatus('done')
  }

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F7F8FC' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTop: '3px solid #7C5CFC', borderRadius: '50%', animation: 'ls-spin 0.8s linear infinite' }} />
        <style>{'@keyframes ls-spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
        background: '#F7F8FC', flexDirection: 'column', gap: 10, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 34 }}><Icon name="🔍" /></div>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#0F172A' }}>This form isn't available</div>
        <div style={{ fontSize: 14.5, color: '#64748B', maxWidth: 340, lineHeight: 1.6 }}>
          It may have closed, or the link may be out of date. If someone sent it to you,
          ask them for the current link.
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <Shell org={org} primary={primary} secondary={secondary}>
        <Card pad={30}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 62, height: 62, borderRadius: '50%', margin: '0 auto 16px',
              background: '#E7F8ED', color: '#04713C',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
            }}><Icon name="✓" /></div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Thank you</div>
            <div style={{ fontSize: 15, color: '#64748B', lineHeight: 1.6, marginBottom: 18 }}>
              {form.confirmation_message || `Your response has been sent to ${org?.name}.`}
            </div>
            <div style={{
              display: 'inline-block', padding: '10px 16px', borderRadius: 12,
              background: '#F7F8FC', fontSize: 13.5, color: '#475569', fontWeight: 600,
            }}>{form.name}</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 18 }}>You can close this page.</div>
          </div>
        </Card>
      </Shell>
    )
  }

  if (status === 'intro') {
    const mins = Math.max(1, Math.round(fields.length / 5))
    return (
      <Shell org={org} primary={primary} secondary={secondary}>
        <Card pad={28}>
          <h1 style={{ fontSize: 25, fontWeight: 900, color: '#0F172A', margin: '0 0 10px', lineHeight: 1.25 }}>
            {form.name}
          </h1>
          {(form.intro_text || form.description) && (
            <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.65, margin: '0 0 18px' }}>
              {form.intro_text || form.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            <span style={{ padding: '6px 12px', borderRadius: 99, background: `${primary}12`, color: primary, fontSize: 12.5, fontWeight: 700 }}>
              {fields.length} question{fields.length === 1 ? '' : 's'}
            </span>
            <span style={{ padding: '6px 12px', borderRadius: 99, background: '#F1F5F9', color: '#475569', fontSize: 12.5, fontWeight: 700 }}>
              About {mins} minute{mins === 1 ? '' : 's'}
            </span>
          </div>
          <button onClick={() => setStatus('ready')} style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff',
            fontSize: 16.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: `0 10px 26px -12px ${primary}`,
          }}>Start</button>
        </Card>
      </Shell>
    )
  }

  const current = sections[step] || []
  const pct = sections.length > 1 ? ((step + 1) / sections.length) * 100 : null

  return (
    <Shell org={org} primary={primary} secondary={secondary}>
      <Card>
        {pct !== null && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>
                Step {step + 1} of {sections.length}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: primary }}>{Math.round(pct)}%</span>
            </div>
            <div style={{ height: 7, background: '#F1F5F9', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 7,
                background: `linear-gradient(90deg, ${primary}, ${secondary})`,
                transition: 'width 280ms ease',
              }} />
            </div>
          </div>
        )}

        {pct === null && (
          <h1 style={{ fontSize: 21, fontWeight: 900, color: '#0F172A', margin: '0 0 18px' }}>{form.name}</h1>
        )}

        <div style={{ display: 'grid', gap: 20 }}>
          {current.map(field => {
            const idx = fields.indexOf(field)
            const id = `fld-${idx}`
            const bad = invalid.includes(field.label)
            return (
              <div key={id}>
                {field.type !== 'checkbox' && (
                  <label htmlFor={id} id={`${id}-label`} style={{
                    display: 'block', fontSize: 15, fontWeight: 700, color: '#0F172A',
                    marginBottom: 8, lineHeight: 1.45,
                  }}>
                    {field.label}
                    {field.required && <span style={{ color: '#DC2626' }}> *</span>}
                  </label>
                )}
                <FieldInput
                  id={id}
                  field={field}
                  value={data[field.label]}
                  onChange={v => setField(field.label, v)}
                  invalid={bad}
                  accent={primary}
                />
                {bad && (
                  <div role="alert" style={{ fontSize: 13, color: '#DC2626', marginTop: 7 }}>
                    This one is needed before you can continue.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div role="alert" style={{
            marginTop: 18, padding: '12px 14px', borderRadius: 12,
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318',
            fontSize: 14, lineHeight: 1.5,
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {step > 0 && (
            <button onClick={back} style={{
              padding: '15px 20px', borderRadius: 14, border: '1.5px solid #E2E8F0',
              background: '#fff', color: '#475569', fontSize: 15.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Back</button>
          )}
          <button
            onClick={isLast ? submit : next}
            disabled={status === 'submitting'}
            style={{
              flex: 1, padding: '16px', borderRadius: 14, border: 'none',
              background: status === 'submitting' ? '#CBD5E1' : `linear-gradient(135deg, ${primary}, ${secondary})`,
              color: '#fff', fontSize: 16.5, fontWeight: 800,
              cursor: status === 'submitting' ? 'wait' : 'pointer', fontFamily: 'inherit',
              boxShadow: status === 'submitting' ? 'none' : `0 10px 26px -12px ${primary}`,
            }}
          >
            {status === 'submitting' ? 'Sending…' : isLast ? 'Submit' : 'Continue'}
          </button>
        </div>
      </Card>
    </Shell>
  )
}
