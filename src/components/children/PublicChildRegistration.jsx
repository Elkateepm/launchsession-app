import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ORG_SLUG = window.location.pathname.split('/register-child/')[1]?.split('/').filter(Boolean)[0]

const MAX_CHILDREN = 10

const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }
const label = { fontSize: 12.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }
const section = { background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }
const sectionTitle = { fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 14 }

function Field({ children }) {
  return <div style={{ marginBottom: 14 }}>{children}</div>
}

const uid = () => Math.random().toString(36).slice(2, 9)

const blankChild = () => ({
  key: uid(),
  first_name: '', last_name: '', date_of_birth: '', school: '',
  allergies: '', medical_notes: '', has_asthma: false, has_diabetes: false,
  takes_medication: false, medication_details: '', has_epipen: false,
  has_behaviour_plan: false, behaviour_plan_notes: '',
  travel_consent: false, consent_photo: false, consent_trip: false,
  consent_medical: false, consent_data_sharing: false,
  notes: '',
})

const CONSENTS = [
  ['travel_consent', 'This child can travel home independently'],
  ['consent_photo', 'I consent to photos being taken for the organisation\'s use'],
  ['consent_trip', 'I consent to this child taking part in off-site trips'],
  ['consent_medical', 'I consent to staff administering basic first aid / emergency medical treatment if needed'],
  ['consent_data_sharing', 'I consent to my data being shared with relevant partner organisations where necessary'],
]

const MEDICAL_FLAGS = [
  ['has_asthma', 'Has asthma'], ['has_diabetes', 'Has diabetes'],
  ['takes_medication', 'Takes regular medication'], ['has_epipen', 'Carries an EpiPen'],
  ['has_behaviour_plan', 'Has a support / behaviour plan'],
]

// One child's whole record: details, medical, consents.
//
// Consents live here rather than being asked once for the family, because a
// parent can reasonably allow photographs of one child and not another, and
// consent has to be given per person rather than inherited from a sibling.
// Nothing here is ever pre-ticked from a previous child for the same reason.
function ChildCard({ child, index, total, primary, open, onToggle, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...child, [k]: v })
  const name = child.first_name.trim() || `Young person ${index + 1}`
  const incomplete = !child.first_name.trim()

  return (
    <div style={{ border: `1.5px solid ${open ? primary : '#E2E8F0'}`, borderRadius: 14, marginBottom: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
        <button type="button" onClick={onToggle} aria-expanded={open}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 800,
            background: incomplete ? '#F1F5F9' : `${primary}1A`, color: incomplete ? '#94A3B8' : primary,
          }}>{index + 1}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            {incomplete && <span style={{ display: 'block', fontSize: 11.5, color: '#B45309', marginTop: 1 }}>Needs a first name</span>}
          </span>
          <span style={{ color: '#94A3B8', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
        </button>
        {total > 1 && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 15, padding: 4 }}>✕</button>
        )}
      </div>

      {open && (
        <div style={{ padding: '4px 16px 18px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ ...sectionTitle, marginTop: 14, fontSize: 13 }}>About them</div>
          <Field><label style={label}>First name *</label><input style={inp} value={child.first_name} onChange={e => set('first_name', e.target.value)} /></Field>
          <Field><label style={label}>Last name</label><input style={inp} value={child.last_name} onChange={e => set('last_name', e.target.value)} /></Field>
          <Field><label style={label}>Date of birth</label><input type="date" style={inp} value={child.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></Field>
          <Field><label style={label}>School</label><input style={inp} value={child.school} onChange={e => set('school', e.target.value)} /></Field>

          <div style={{ ...sectionTitle, marginTop: 20, fontSize: 13 }}>Medical &amp; support needs</div>
          <Field><label style={label}>Allergies</label><input style={inp} value={child.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Peanuts, tree nuts — leave blank if none" /></Field>
          <Field><label style={label}>Medical notes</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={child.medical_notes} onChange={e => set('medical_notes', e.target.value)} /></Field>
          {MEDICAL_FLAGS.map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#334155', marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={child[k]} onChange={e => set(k, e.target.checked)} /> {l}
            </label>
          ))}
          {child.takes_medication && <Field><label style={label}>Medication details</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={child.medication_details} onChange={e => set('medication_details', e.target.value)} /></Field>}
          {child.has_behaviour_plan && <Field><label style={label}>Support plan notes</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={child.behaviour_plan_notes} onChange={e => set('behaviour_plan_notes', e.target.value)} /></Field>}

          <div style={{ ...sectionTitle, marginTop: 20, fontSize: 13 }}>Permissions &amp; consents</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>
            These are asked separately for each young person — they aren't copied between siblings.
          </div>
          {CONSENTS.map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: '#334155', marginBottom: 12, cursor: 'pointer', lineHeight: 1.4 }}>
              <input type="checkbox" checked={child[k]} onChange={e => set(k, e.target.checked)} style={{ marginTop: 2 }} /> {l}
            </label>
          ))}
          <Field><label style={label}>Anything else we should know about them?</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={child.notes} onChange={e => set('notes', e.target.value)} /></Field>
        </div>
      )}
    </div>
  )
}

export default function PublicChildRegistration() {
  const [org, setOrg] = useState(undefined) // undefined = loading, null = not found
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Shared across every child on this form.
  const [family, setFamily] = useState({
    parent_name: '', parent_phone: '', parent_email: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  })
  const setF = (k, v) => setFamily(f => ({ ...f, [k]: v }))

  const [children, setChildren] = useState([blankChild()])
  const [openKey, setOpenKey] = useState(null)

  useEffect(() => { setOpenKey(children[0]?.key || null) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ORG_SLUG) { setOrg(null); return }
    // Public-safe view -- no auth context here (parent registration form).
    supabase.from('organisations_public').select('id, name, slug, logo_url, primary_color, secondary_color')
      .eq('slug', ORG_SLUG).maybeSingle().then(({ data }) => setOrg(data || null))
  }, [])

  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || '#123B30'

  const updateChild = (i, next) => setChildren(cs => cs.map((c, j) => (j === i ? next : c)))
  const removeChild = (i) => setChildren(cs => cs.filter((_, j) => j !== i))
  const addChild = () => {
    if (children.length >= MAX_CHILDREN) return
    const c = blankChild()
    setChildren(cs => [...cs, c])
    setOpenKey(c.key)
  }

  const namedChildren = children.filter(c => c.first_name.trim())

  const canContinue = () => {
    if (step === 1) return family.parent_name.trim().length > 0 && (family.parent_phone.trim() || family.parent_email.trim())
    if (step === 2) return namedChildren.length > 0 && namedChildren.length === children.length
    return true
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    const { error: err } = await supabase.rpc('submit_child_registrations', {
      p_org_slug: org.slug,
      p_parent_name: family.parent_name.trim(),
      p_parent_phone: family.parent_phone || null,
      p_parent_email: family.parent_email || null,
      p_emergency_contact_name: family.emergency_contact_name || null,
      p_emergency_contact_phone: family.emergency_contact_phone || null,
      // `key` is a React list key and has no business being sent.
      p_children: children.map(({ key, ...rest }) => rest),
    })
    setSubmitting(false)
    if (err) {
      // The function raises readable messages for the things a parent can
      // actually fix (a bad date, a name left blank, the 10-child cap), so
      // show those rather than burying them under a generic apology.
      setError(err.message || "Something went wrong submitting this — please try again, or contact the organisation directly.")
      return
    }
    setDone(true)
  }

  if (org === undefined) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'system-ui' }}>Loading…</div>
  if (org === null) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', textAlign: 'center', padding: 20 }}>
      <div><div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div><div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>We couldn't find that organisation's registration page.</div></div>
    </div>
  )

  if (done) {
    const names = children.map(c => c.first_name.trim()).filter(Boolean)
    const list = names.length === 1
      ? `${names[0]}'s details have`
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}'s details have`
    return (
      <div style={{ minHeight: '100vh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 40, maxWidth: 460, textAlign: 'center', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
          <div style={{ fontSize: 46, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
            {names.length > 1 ? `${names.length} registrations received` : 'Registration received'}
          </div>
          <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
            Thanks — {list} been sent to {org.name} for review. They'll be in touch once they've been approved.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`, padding: '28px 20px', color: '#fff', textAlign: 'center' }}>
        {org.logo_url && <img src={org.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', marginBottom: 10 }} />}
        <div style={{ fontSize: 20, fontWeight: 900 }}>{org.name}</div>
        <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 2 }}>Register a young person</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 60px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['Your details', 'Young people', 'Review'].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 99, background: step > i ? primary : '#E2E8F0', marginBottom: 5 }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: step === i + 1 ? primary : '#94A3B8' }}>{s}</div>
            </div>
          ))}
        </div>

        {/* STEP 1 — asked once for the whole family */}
        {step === 1 && (
          <div style={section}>
            <div style={sectionTitle}>Your details</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
              You only need to fill these in once, however many young people you're registering.
            </div>
            <Field><label style={label}>Parent / carer name *</label><input style={inp} value={family.parent_name} onChange={e => setF('parent_name', e.target.value)} /></Field>
            <Field><label style={label}>Phone</label><input type="tel" style={inp} value={family.parent_phone} onChange={e => setF('parent_phone', e.target.value)} /></Field>
            <Field><label style={label}>Email</label><input type="email" style={inp} value={family.parent_email} onChange={e => setF('parent_email', e.target.value)} /></Field>
            <Field><label style={label}>Emergency contact name</label><input style={inp} value={family.emergency_contact_name} onChange={e => setF('emergency_contact_name', e.target.value)} /></Field>
            <Field><label style={label}>Emergency contact phone</label><input type="tel" style={inp} value={family.emergency_contact_phone} onChange={e => setF('emergency_contact_phone', e.target.value)} /></Field>
          </div>
        )}

        {/* STEP 2 — one card per child */}
        {step === 2 && (
          <div>
            <div style={{ ...section, paddingBottom: 8 }}>
              <div style={sectionTitle}>Who are you registering?</div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
                Add each young person below. Tap a name to fill in their details, medical needs and consents.
              </div>

              {children.map((c, i) => (
                <ChildCard
                  key={c.key}
                  child={c}
                  index={i}
                  total={children.length}
                  primary={primary}
                  open={openKey === c.key}
                  onToggle={() => setOpenKey(k => (k === c.key ? null : c.key))}
                  onChange={next => updateChild(i, next)}
                  onRemove={() => removeChild(i)}
                />
              ))}

              {children.length < MAX_CHILDREN ? (
                <button type="button" onClick={addChild} style={{
                  width: '100%', padding: '13px', borderRadius: 11, marginBottom: 14,
                  border: `1.5px dashed ${primary}`, background: 'transparent', color: primary,
                  fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
                }}>+ Add another young person</button>
              ) : (
                <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>
                  That's the maximum of {MAX_CHILDREN} on one form. Please submit any others separately.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — review */}
        {step === 3 && (
          <div style={section}>
            <div style={sectionTitle}>Review before submitting</div>

            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Your details</div>
            {[
              ['Parent / carer', family.parent_name],
              ['Contact', [family.parent_phone, family.parent_email].filter(Boolean).join(' · ')],
              ['Emergency contact', [family.emergency_contact_name, family.emergency_contact_phone].filter(Boolean).join(' · ')],
            ].map(([k, v]) => v ? (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                <span style={{ color: '#64748B' }}>{k}</span><span style={{ fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{v}</span>
              </div>
            ) : null)}

            {children.map((c, i) => (
              <div key={c.key} style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Young person {i + 1}
                </div>
                {[
                  ['Name', `${c.first_name} ${c.last_name}`.trim()],
                  ['Date of birth', c.date_of_birth],
                  ['School', c.school],
                  ['Allergies', c.allergies || 'None recorded'],
                  ['Consents given', CONSENTS.filter(([k]) => c[k]).map(([, l]) => l.split(' ').slice(0, 3).join(' ')).length
                    ? CONSENTS.filter(([k]) => c[k]).map(([k]) => ({
                        consent_photo: 'Photo', consent_trip: 'Trips', consent_medical: 'Medical',
                        consent_data_sharing: 'Data sharing', travel_consent: 'Independent travel',
                      })[k]).join(', ')
                    : 'None selected'],
                ].map(([k, v]) => v ? (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                    <span style={{ color: '#64748B' }}>{k}</span><span style={{ fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{v}</span>
                  </div>
                ) : null)}
              </div>
            ))}

            {error && <div style={{ marginTop: 14, color: '#DC2626', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>← Back</button>}
          {step < 3 ? (
            <button onClick={() => canContinue() && setStep(s => s + 1)} disabled={!canContinue()}
              style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: canContinue() ? primary : '#CBD5E1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canContinue() ? 'pointer' : 'default' }}>
              Continue →
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting…' : `Submit ${children.length > 1 ? `${children.length} registrations` : 'registration'}`}
            </button>
          )}
        </div>

        {step === 2 && children.length > namedChildren.length && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#B45309', marginTop: 10 }}>
            Every young person needs at least a first name before you can continue.
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 16 }}>🔒 Your information is sent securely and only visible to {org.name}.</div>
      </div>
    </div>
  )
}
