import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ORG_SLUG = window.location.pathname.split('/register-child/')[1]?.split('/').filter(Boolean)[0]

const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }
const label = { fontSize: 12.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }
const section = { background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }
const sectionTitle = { fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 14 }

function Field({ children }) {
  return <div style={{ marginBottom: 14 }}>{children}</div>
}

export default function PublicChildRegistration() {
  const [org, setOrg] = useState(undefined) // undefined = loading, null = not found
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', school: '',
    parent_name: '', parent_phone: '', parent_email: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    allergies: '', medical_notes: '', has_asthma: false, has_diabetes: false,
    takes_medication: false, medication_details: '', has_epipen: false,
    has_behaviour_plan: false, behaviour_plan_notes: '',
    travel_consent: false, consent_photo: false, consent_trip: false, consent_medical: false, consent_data_sharing: false,
    notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!ORG_SLUG) { setOrg(null); return }
    supabase.from('organisations').select('id, name, slug, logo_url, primary_color, secondary_color')
      .eq('slug', ORG_SLUG).maybeSingle().then(({ data }) => setOrg(data || null))
  }, [])

  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || '#123B30'

  const canContinue = () => {
    if (step === 1) return form.first_name.trim().length > 0
    if (step === 2) return form.parent_name.trim().length > 0 && (form.parent_phone.trim() || form.parent_email.trim())
    return true
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    const { error: err } = await supabase.from('child_registration_requests').insert({
      org_id: org.id,
      first_name: form.first_name.trim(), last_name: form.last_name.trim() || null,
      date_of_birth: form.date_of_birth || null, school: form.school || null,
      parent_name: form.parent_name.trim(), parent_phone: form.parent_phone || null, parent_email: form.parent_email || null,
      emergency_contact_name: form.emergency_contact_name || null, emergency_contact_phone: form.emergency_contact_phone || null,
      allergies: form.allergies || null, medical_notes: form.medical_notes || null,
      has_asthma: form.has_asthma, has_diabetes: form.has_diabetes, takes_medication: form.takes_medication,
      medication_details: form.medication_details || null, has_epipen: form.has_epipen,
      has_behaviour_plan: form.has_behaviour_plan, behaviour_plan_notes: form.behaviour_plan_notes || null,
      travel_consent: form.travel_consent, consent_photo: form.consent_photo, consent_trip: form.consent_trip,
      consent_medical: form.consent_medical, consent_data_sharing: form.consent_data_sharing,
      notes: form.notes || null, status: 'pending',
    })
    setSubmitting(false)
    if (err) { setError("Something went wrong submitting this — please try again, or contact the organisation directly."); return }
    setDone(true)
  }

  if (org === undefined) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'system-ui' }}>Loading…</div>
  if (org === null) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', textAlign: 'center', padding: 20 }}>
      <div><div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div><div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>We couldn't find that organisation's registration page.</div></div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40, maxWidth: 460, textAlign: 'center', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <div style={{ fontSize: 46, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Registration received</div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
          Thanks — {form.first_name}'s details have been sent to {org.name} for review. They'll be in touch once it's been approved.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`, padding: '28px 20px', color: '#fff', textAlign: 'center' }}>
        {org.logo_url && <img src={org.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', marginBottom: 10 }} />}
        <div style={{ fontSize: 20, fontWeight: 900 }}>{org.name}</div>
        <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 2 }}>Register a young person</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['Details', 'Family', 'Medical', 'Consents', 'Review'].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 99, background: step > i ? primary : '#E2E8F0', marginBottom: 5 }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: step === i + 1 ? primary : '#94A3B8' }}>{s}</div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={section}>
            <div style={sectionTitle}>About the young person</div>
            <Field><label style={label}>First name *</label><input style={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></Field>
            <Field><label style={label}>Last name</label><input style={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></Field>
            <Field><label style={label}>Date of birth</label><input type="date" style={inp} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></Field>
            <Field><label style={label}>School</label><input style={inp} value={form.school} onChange={e => set('school', e.target.value)} /></Field>
          </div>
        )}

        {step === 2 && (
          <div style={section}>
            <div style={sectionTitle}>Family & emergency contact</div>
            <Field><label style={label}>Parent / carer name *</label><input style={inp} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} /></Field>
            <Field><label style={label}>Phone</label><input type="tel" style={inp} value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} /></Field>
            <Field><label style={label}>Email</label><input type="email" style={inp} value={form.parent_email} onChange={e => set('parent_email', e.target.value)} /></Field>
            <Field><label style={label}>Emergency contact name</label><input style={inp} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></Field>
            <Field><label style={label}>Emergency contact phone</label><input type="tel" style={inp} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></Field>
          </div>
        )}

        {step === 3 && (
          <div style={section}>
            <div style={sectionTitle}>Medical & support needs</div>
            <Field><label style={label}>Allergies</label><input style={inp} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Peanuts, tree nuts — leave blank if none" /></Field>
            <Field><label style={label}>Medical notes</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} /></Field>
            {[
              ['has_asthma', 'Has asthma'], ['has_diabetes', 'Has diabetes'], ['takes_medication', 'Takes regular medication'],
              ['has_epipen', 'Carries an EpiPen'], ['has_behaviour_plan', 'Has a support / behaviour plan'],
            ].map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#334155', marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} /> {l}
              </label>
            ))}
            {form.takes_medication && <Field><label style={label}>Medication details</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={form.medication_details} onChange={e => set('medication_details', e.target.value)} /></Field>}
            {form.has_behaviour_plan && <Field><label style={label}>Support plan notes</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={form.behaviour_plan_notes} onChange={e => set('behaviour_plan_notes', e.target.value)} /></Field>}
          </div>
        )}

        {step === 4 && (
          <div style={section}>
            <div style={sectionTitle}>Permissions & consents</div>
            {[
              ['travel_consent', 'My child can travel home independently'],
              ['consent_photo', 'I consent to photos being taken for the organisation\'s use'],
              ['consent_trip', 'I consent to my child taking part in off-site trips'],
              ['consent_medical', 'I consent to staff administering basic first aid / emergency medical treatment if needed'],
              ['consent_data_sharing', 'I consent to my data being shared with relevant partner organisations where necessary'],
            ].map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: '#334155', marginBottom: 12, cursor: 'pointer', lineHeight: 1.4 }}>
                <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} style={{ marginTop: 2 }} /> {l}
              </label>
            ))}
            <Field><label style={label}>Anything else we should know?</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          </div>
        )}

        {step === 5 && (
          <div style={section}>
            <div style={sectionTitle}>Review before submitting</div>
            {[
              ['Name', `${form.first_name} ${form.last_name}`.trim()],
              ['Date of birth', form.date_of_birth],
              ['School', form.school],
              ['Parent / carer', form.parent_name],
              ['Contact', [form.parent_phone, form.parent_email].filter(Boolean).join(' · ')],
              ['Allergies', form.allergies || 'None recorded'],
              ['Consents given', [
                form.consent_photo && 'Photo', form.consent_trip && 'Trips', form.consent_medical && 'Medical',
                form.consent_data_sharing && 'Data sharing', form.travel_consent && 'Independent travel',
              ].filter(Boolean).join(', ') || 'None selected'],
            ].map(([k, v]) => v ? (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                <span style={{ color: '#64748B' }}>{k}</span><span style={{ fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{v}</span>
              </div>
            ) : null)}
            {error && <div style={{ marginTop: 14, color: '#DC2626', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>← Back</button>}
          {step < 5 ? (
            <button onClick={() => canContinue() && setStep(s => s + 1)} disabled={!canContinue()}
              style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: canContinue() ? primary : '#CBD5E1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canContinue() ? 'pointer' : 'default' }}>
              Continue →
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting…' : 'Submit registration'}
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 16 }}>🔒 Your information is sent securely and only visible to {org.name}.</div>
      </div>
    </div>
  )
}
