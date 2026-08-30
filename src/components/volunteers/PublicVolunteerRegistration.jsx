import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../lib/icons'

const ORG_SLUG = window.location.pathname.split('/register-volunteer/')[1]?.split('/').filter(Boolean)[0]

const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }
const label = { fontSize: 12.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }
const section = { background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }
const sectionTitle = { fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 14 }

const SKILL_OPTIONS = ['Coaching', 'First Aid', 'Driving', 'Mentoring', 'Admin & Office', 'Cooking / Catering', 'Music / Arts', 'Safeguarding Lead']
const AVAILABILITY_OPTIONS = ['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekends', 'School holidays']

function Field({ children }) {
  return <div style={{ marginBottom: 14 }}>{children}</div>
}

function toggleInArray(arr, val) {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

export default function PublicVolunteerRegistration() {
  const [org, setOrg] = useState(undefined) // undefined = loading, null = not found
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', email: '', phone: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    skills: [], availability: [],
    dbs_number: '', dbs_expiry: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!ORG_SLUG) { setOrg(null); return }
    // Public-safe view -- no auth context here (volunteer registration form).
    supabase.from('organisations_public').select('id, name, slug, logo_url, primary_color, secondary_color')
      .eq('slug', ORG_SLUG).maybeSingle().then(({ data }) => setOrg(data || null))
  }, [])

  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || '#123B30'

  const canContinue = () => {
    if (step === 1) return form.first_name.trim().length > 0 && (form.phone.trim() || form.email.trim())
    return true
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    const { data: applicationId, error: err } = await supabase.rpc('submit_volunteer_application', {
      p_org_slug: org.slug,
      p_first_name: form.first_name.trim(), p_last_name: form.last_name.trim() || null,
      p_email: form.email || null, p_phone: form.phone || null, p_dob: form.date_of_birth || null,
      p_emergency_contact_name: form.emergency_contact_name || null, p_emergency_contact_phone: form.emergency_contact_phone || null,
      p_skills: form.skills.length ? form.skills : null, p_availability: form.availability.length ? form.availability : null,
      p_dbs_number: form.dbs_number || null, p_dbs_expiry: form.dbs_expiry || null,
      p_notes: form.notes || null,
    })
    if (err) {
      setSubmitting(false)
      setError("Something went wrong submitting this — please try again, or contact the organisation directly.")
      return
    }

    // With an email address the application lands as 'unverified' and stays
    // invisible to the organisation until the applicant confirms the address
    // is theirs. Without one there is nothing to confirm, so it goes straight
    // through and the confirmation screen says so.
    const wantsVerification = !!form.email.trim()
    if (wantsVerification && applicationId) {
      const { error: sendErr } = await supabase.functions.invoke('send-volunteer-verification', {
        body: { application_id: applicationId },
      })
      // The row exists either way; failing to send is worth telling them about
      // so they can retry rather than waiting on an email that never arrives.
      if (sendErr) {
        setSubmitting(false)
        setError("We saved your application but couldn't send the confirmation email. Please try again, or contact the organisation directly.")
        return
      }
    }
    setNeedsVerification(wantsVerification)
    setSubmitting(false)
    setDone(true)
  }

  if (org === undefined) return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontFamily: 'system-ui' }}>Loading…</div>
  if (org === null) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', textAlign: 'center', padding: 20 }}>
      <div><div style={{ fontSize: 40, marginBottom: 10 }}><Icon name="🔍" /></div><div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>We couldn't find that organisation's volunteer sign-up page.</div></div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100dvh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40, maxWidth: 460, textAlign: 'center', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <div style={{ fontSize: 46, marginBottom: 14 }}><Icon name="✅" /></div>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Application received</div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
          {needsVerification
            ? <>Thanks {form.first_name} — one last step. We've emailed <strong style={{ color: '#0F172A' }}>{form.email.trim()}</strong> with a link to confirm it's yours. Your application reaches {org.name} once you've clicked it.</>
            : <>Thanks {form.first_name} — your volunteer application has been sent to {org.name} for review. They'll be in touch soon.</>}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`, padding: '28px 20px', color: '#fff', textAlign: 'center' }}>
        {org.logo_url && <img src={org.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', marginBottom: 10 }} />}
        <div style={{ fontSize: 20, fontWeight: 900 }}>{org.name}</div>
        <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 2 }}>Become a volunteer</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['About You', 'Contact', 'Skills', 'DBS', 'Review'].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 99, background: step > i ? primary : '#E2E8F0', marginBottom: 5 }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: step === i + 1 ? primary : '#94A3B8' }}>{s}</div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={section}>
            <div style={sectionTitle}>About you</div>
            <Field><label style={label}>First name *</label><input style={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></Field>
            <Field><label style={label}>Last name</label><input style={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></Field>
            <Field><label style={label}>Date of birth</label><input type="date" style={inp} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></Field>
            <Field><label style={label}>Phone</label><input type="tel" style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field><label style={label}>Email</label><input type="email" style={inp} value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Please provide at least a phone number or email so we can reach you.</div>
          </div>
        )}

        {step === 2 && (
          <div style={section}>
            <div style={sectionTitle}>Emergency contact</div>
            <Field><label style={label}>Emergency contact name</label><input style={inp} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></Field>
            <Field><label style={label}>Emergency contact phone</label><input type="tel" style={inp} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></Field>
          </div>
        )}

        {step === 3 && (
          <div style={section}>
            <div style={sectionTitle}>Skills & availability</div>
            <label style={label}>What can you help with?</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {SKILL_OPTIONS.map(s => {
                const active = form.skills.includes(s)
                return (
                  <button key={s} type="button" onClick={() => set('skills', toggleInArray(form.skills, s))}
                    style={{ padding: '7px 13px', borderRadius: 99, border: `1.5px solid ${active ? primary : '#E2E8F0'}`, background: active ? primary : '#fff', color: active ? '#fff' : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    {s}
                  </button>
                )
              })}
            </div>
            <label style={label}>When are you generally available?</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AVAILABILITY_OPTIONS.map(a => {
                const active = form.availability.includes(a)
                return (
                  <button key={a} type="button" onClick={() => set('availability', toggleInArray(form.availability, a))}
                    style={{ padding: '7px 13px', borderRadius: 99, border: `1.5px solid ${active ? primary : '#E2E8F0'}`, background: active ? primary : '#fff', color: active ? '#fff' : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    {a}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={section}>
            <div style={sectionTitle}>DBS check (if you have one)</div>
            <Field><label style={label}>DBS certificate number</label><input style={inp} value={form.dbs_number} onChange={e => set('dbs_number', e.target.value)} placeholder="Leave blank if you don't have one yet" /></Field>
            <Field><label style={label}>DBS expiry date</label><input type="date" style={inp} value={form.dbs_expiry} onChange={e => set('dbs_expiry', e.target.value)} /></Field>
            <Field><label style={label}>Anything else we should know?</label><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          </div>
        )}

        {step === 5 && (
          <div style={section}>
            <div style={sectionTitle}>Review before submitting</div>
            {[
              ['Name', `${form.first_name} ${form.last_name}`.trim()],
              ['Date of birth', form.date_of_birth],
              ['Contact', [form.phone, form.email].filter(Boolean).join(' · ')],
              ['Emergency contact', form.emergency_contact_name],
              ['Skills', form.skills.join(', ') || 'None selected'],
              ['Availability', form.availability.join(', ') || 'None selected'],
              ['DBS number', form.dbs_number || 'Not provided'],
            ].map(([k, v]) => v ? (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                <span style={{ color: '#64748B' }}>{k}</span><span style={{ fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{v}</span>
              </div>
            ) : null)}
            {error && <div style={{ marginTop: 14, color: '#DC2626', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}><Icon name="←" /> Back</button>}
          {step < 5 ? (
            <button onClick={() => canContinue() && setStep(s => s + 1)} disabled={!canContinue()}
              style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: canContinue() ? primary : '#CBD5E1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canContinue() ? 'pointer' : 'default' }}>
              Continue →
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 16 }}><Icon name="🔒" /> Your information is sent securely and only visible to {org.name}.</div>
      </div>
    </div>
  )
}
