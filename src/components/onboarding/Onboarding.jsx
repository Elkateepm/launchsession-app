import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import OnboardingLayout, { useReducedMotion } from '../auth/onboarding/OnboardingLayout'
import ProgressHeader from '../auth/onboarding/ProgressHeader'
import SelectionCard from '../auth/onboarding/SelectionCard'
import AnimatedInput from '../auth/onboarding/AnimatedInput'

// Same 12-option list and icon keys as the sign-up flow, for a consistent
// vocabulary across both onboarding surfaces. Values are free text on
// organisations.type, so this needs no migration.
const ORG_TYPES = [
  { value: 'charity',           label: 'Charity',                  icon: 'heart',     description: 'Delivering community or charitable programmes' },
  { value: 'sports_club',       label: 'Sports Club',               icon: 'ball',      description: 'Running coaching, training or team sessions' },
  { value: 'community_centre',  label: 'Community Centre',          icon: 'building',  description: 'Managing local groups, programmes and events' },
  { value: 'after_school',      label: 'After-School Club',         icon: 'backpack',  description: 'Running activities outside normal school hours' },
  { value: 'youth_club',        label: 'Youth Club',                icon: 'users',     description: 'Providing regular activities and youth support' },
  { value: 'faith_community',   label: 'Faith or Community Group',  icon: 'handshake', description: 'Faith groups and grassroots organisations' },
  { value: 'holiday_club',      label: 'Holiday Club',              icon: 'sun',       description: 'School holiday activity camps' },
  { value: 'mentoring',         label: 'Mentoring Programme',       icon: 'compass',   description: 'Supporting young people through structured mentoring' },
  { value: 'education',         label: 'Education Provider',        icon: 'cap',       description: 'Schools, tutors and training providers' },
  { value: 'local_authority',   label: 'Local Authority',           icon: 'columns',   description: 'Councils and public-sector youth services' },
  { value: 'social_enterprise', label: 'Social Enterprise',         icon: 'leaf',      description: 'Mission-driven, trading for impact' },
  { value: 'other',             label: 'Other',                     icon: 'sparkle',   description: 'Tell us what you run' },
]

const YOUNG_PEOPLE_RANGES = ['1–25', '26–50', '51–100', '101–250', '251–500', '500+']
const STAFF_RANGES = ['Just me', '2–5', '6–15', '16–30', '30+']

const FOCUSES = [
  { value: 'sports',     label: 'Sports & Physical Activity',    icon: 'ball' },
  { value: 'arts',       label: 'Arts & Creative',                icon: 'sparkle' },
  { value: 'education',  label: 'Education & Learning',           icon: 'cap' },
  { value: 'wellbeing',  label: 'Wellbeing & Mental Health',      icon: 'heart' },
  { value: 'multiple',   label: 'Multiple Focus Areas',           icon: 'compass' },
]

const STEP_TITLES = ['Welcome', 'Organisation type', 'Organisation size', 'Location', 'Primary focus', 'Groups', 'Main contact']
const TOTAL_STEPS = 7

export default function Onboarding({ session, org, onComplete }) {
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const [orgType, setOrgType] = useState('')
  const [orgTypeOther, setOrgTypeOther] = useState('')
  const [youngPeopleRange, setYoungPeopleRange] = useState('')
  const [staffRange, setStaffRange] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('United Kingdom')
  const [postcode, setPostcode] = useState('')
  const [focus, setFocus] = useState('')
  const [customGroups, setCustomGroups] = useState([])
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#4F6EF7')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))
  const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch (e) { return null } })()

  const handleComplete = async () => {
    setSaving(true)
    setError('')

    const resolvedOrgType = (orgType === 'other' && orgTypeOther.trim()) ? orgTypeOther.trim() : orgType

    const { error: orgError } = await supabase
      .from('organisations')
      .update({
        type: resolvedOrgType,
        city,
        country,
        size: youngPeopleRange,
        focus,
        contact_name: contactName,
        contact_email: contactEmail,
        onboarding_data: {
          org_type: resolvedOrgType, size: youngPeopleRange, staff_range: staffRange,
          city, country, postcode: postcode || null, timezone,
          focus, contact_name: contactName, contact_email: contactEmail,
          completed_at: new Date().toISOString(),
        },
        onboarding_complete: true,
        ...(customGroups.length > 0 ? { custom_groups: customGroups } : {})
      })
      .eq('id', org.id)

    if (orgError) { setError('Could not save organisation details.'); setSaving(false); return }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ onboarding_complete: true })
      .eq('id', session.user.id)

    if (profileError) { setError('Could not mark onboarding complete.'); setSaving(false); return }

    setSaving(false)
    onComplete()
  }

  const canContinue = [
    true,                              // 0 welcome
    !!orgType,                         // 1 org type
    !!youngPeopleRange && !!staffRange,// 2 size
    city.trim().length > 0,            // 3 location
    !!focus,                           // 4 focus
    true,                              // 5 groups (optional)
    contactName.trim().length > 0,     // 6 contact
  ][step]

  const stepVariants = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.12 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }
    : { initial: { opacity: 0, x: 14 }, animate: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }, exit: { opacity: 0, x: -10, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } } }

  if (step === 0) return (
    <OnboardingLayout wide={false}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 18 }}>🚀</div>
        <h2 style={cardTitle}>Welcome to {org.name}!</h2>
        <p style={cardSub}>Let's take a couple of minutes to set up your LaunchSession workspace. We'll ask a few quick questions to personalise it.</p>
        <button className="ls-primary-btn" style={primaryBtn} onClick={next}>Let's go <span className="ls-btn-arrow">→</span></button>
      </div>
    </OnboardingLayout>
  )

  const stepWide = step === 1
  const disabledReason = [
    '', 'Select an organisation type to continue.', 'Choose both ranges to continue.',
    'Add a town or city to continue.', 'Choose a primary focus to continue.', '',
    'Add a name for the main contact to continue.',
  ][step]

  return (
    <OnboardingLayout wide>
      <ProgressHeader stepNumber={step + 1} totalSteps={TOTAL_STEPS} title={STEP_TITLES[step]} showBack onBack={back} />

      {error && (
        <div role="alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ maxWidth: stepWide ? 'none' : 460, margin: stepWide ? 0 : '0 auto' }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} variants={stepVariants} initial="initial" animate="animate" exit="exit">

            {step === 1 && (
              <div>
                <h2 style={cardTitle}>What type of organisation is {org.name}?</h2>
                <p style={cardSub}>We'll tailor your workspace, terminology and suggested modules.</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
                  {ORG_TYPES.map(t => (
                    <SelectionCard key={t.value} icon={t.icon} title={t.label} description={t.description} selected={orgType === t.value} onClick={() => setOrgType(t.value)} />
                  ))}
                </div>
                {orgType === 'other' && (
                  <div style={{ marginTop: 14, maxWidth: 460 }}>
                    <AnimatedInput
                      label="Tell us what type of organisation you run"
                      autoFocus
                      valid={orgTypeOther.trim().length > 1}
                      inputProps={{ placeholder: 'e.g. Scout group, arts collective...', value: orgTypeOther, onChange: e => setOrgTypeOther(e.target.value) }}
                    />
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 style={cardTitle}>Approximately how many young people do you support?</h2>
                <p style={cardSub}>This helps us recommend the right setup. An estimate is fine.</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 26 }}>
                  {YOUNG_PEOPLE_RANGES.map(r => (
                    <SelectionCard key={r} compact title={r} selected={youngPeopleRange === r} onClick={() => setYoungPeopleRange(r)} icon={<span style={{ fontSize: 16, fontWeight: 900 }}>#</span>} />
                  ))}
                </div>

                <h3 style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>How many staff and volunteers will use LaunchSession?</h3>
                <p style={{ ...cardSub, marginBottom: 14 }}>You can invite them properly in the next step.</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
                  {STAFF_RANGES.map(r => (
                    <SelectionCard key={r} compact title={r} selected={staffRange === r} onClick={() => setStaffRange(r)} icon={<span style={{ fontSize: 16, fontWeight: 900 }}>#</span>} />
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ maxWidth: 460 }}>
                <h2 style={cardTitle}>Where is {org.name} based?</h2>
                <p style={cardSub}>We'll use this for regional settings, dates and safeguarding guidance.</p>
                <div style={{ marginBottom: 14 }}>
                  <AnimatedInput label="Town or city" autoFocus valid={city.trim().length > 1} inputProps={{ placeholder: 'e.g. London', value: city, onChange: e => setCity(e.target.value) }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <AnimatedInput label="Country" valid={country.trim().length > 1} inputProps={{ value: country, onChange: e => setCountry(e.target.value) }} />
                </div>
                <div>
                  <AnimatedInput label="Postcode (optional)" valid={false} inputProps={{ placeholder: 'e.g. WD18 0EU', value: postcode, onChange: e => setPostcode(e.target.value) }} />
                </div>
                <Teach>📍 You can add individual venue addresses later. {timezone ? `We've detected your time zone as ${timezone}.` : ''}</Teach>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 style={cardTitle}>What's your primary focus?</h2>
                <p style={cardSub}>What does {org.name} mainly deliver?</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 12 }}>
                  {FOCUSES.map(f => (
                    <SelectionCard key={f.value} icon={f.icon} title={f.label} selected={focus === f.value} onClick={() => setFocus(f.value)} />
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div style={{ maxWidth: 460 }}>
                <h2 style={cardTitle}>Set up your groups</h2>
                <p style={cardSub}>Add the groups your participants are organised into — like "Under 10s" or "Beginners". You can skip this and set it up later in Settings → Registers.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
                  {PRESET_GROUPS.map(label => (
                    <button key={label} onClick={() => {
                      if (!customGroups.find(g => g.label === label)) setCustomGroups(prev => [...prev, { id: 'g-' + Date.now() + label, label, color: newGroupColor }])
                    }} style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.15)', background: customGroups.find(g => g.label === label) ? 'rgba(79,110,247,0.3)' : 'rgba(255,255,255,0.05)', color: customGroups.find(g => g.label === label) ? '#93C5FD' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + {label}
                    </button>
                  ))}
                </div>

                {customGroups.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {customGroups.map(g => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, color: '#fff' }}>{g.label}</span>
                        <button onClick={() => setCustomGroups(prev => prev.filter(x => x.id !== g.id))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <AnimatedInput valid={false} inputProps={{ placeholder: 'Custom group name...', value: newGroupLabel, onChange: e => setNewGroupLabel(e.target.value), onKeyDown: e => e.key === 'Enter' && addGroup() }} />
                  </div>
                  <label title="Pick a colour" style={{ position: 'relative', width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: newGroupColor, border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input type="color" value={newGroupColor} onChange={e => setNewGroupColor(e.target.value)} style={{ position: 'absolute', inset: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', border: 'none', padding: 0, cursor: 'pointer', opacity: 0 }} />
                    <span style={{ fontSize: 16, pointerEvents: 'none' }}>🎨</span>
                  </label>
                </div>
                <button onClick={addGroup} style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: '#4F6EF7', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Add Group</button>
              </div>
            )}

            {step === 6 && (
              <div style={{ maxWidth: 460 }}>
                <h2 style={cardTitle}>Who's the main contact?</h2>
                <p style={cardSub}>We'll use this for important workspace communications.</p>
                <div style={{ marginBottom: 14 }}>
                  <AnimatedInput label="Full name" autoFocus valid={contactName.trim().length > 1} inputProps={{ placeholder: 'e.g. Jane Smith', value: contactName, onChange: e => setContactName(e.target.value) }} />
                </div>
                <AnimatedInput label="Work email" valid={/\S+@\S+\.\S+/.test(contactEmail.trim())} inputProps={{ type: 'email', placeholder: 'jane@organisation.org', value: contactEmail, onChange: e => setContactEmail(e.target.value) }} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={isMobile ? mobileStickyNav : { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24, maxWidth: stepWide ? 460 : 'none' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={back} style={ghostBtn}>← Back</button>
          {step === 5 ? (
            <button type="button" onClick={next} className="ls-primary-btn" style={{ ...primaryBtn, flex: 1 }}>Continue <span className="ls-btn-arrow">→</span></button>
          ) : step === 6 ? (
            <button type="button" onClick={handleComplete} disabled={!canContinue || saving} className="ls-primary-btn" style={{ ...primaryBtn, flex: 1, opacity: !canContinue || saving ? 0.6 : 1 }}>
              {saving ? 'Setting up…' : <>Launch My Workspace <span className="ls-btn-arrow">🚀</span></>}
            </button>
          ) : (
            <button type="button" onClick={next} disabled={!canContinue} className="ls-primary-btn" style={{ ...primaryBtn, flex: 1, opacity: canContinue ? 1 : 0.4 }}>Continue <span className="ls-btn-arrow">→</span></button>
          )}
        </div>
        {!canContinue && disabledReason && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{disabledReason}</div>}
      </div>
      {isMobile && <div style={{ height: 84 }} />}
    </OnboardingLayout>
  )

  function addGroup() {
    const label = newGroupLabel.trim()
    if (!label || customGroups.find(g => g.label === label)) return
    setCustomGroups(prev => [...prev, { id: 'g-' + Date.now(), label, color: newGroupColor }])
    setNewGroupLabel('')
  }
}

const PRESET_GROUPS = ['Under 7s', 'Under 10s', 'Under 12s', 'Under 14s', 'Under 16s', 'Beginners', 'Intermediate', 'Advanced', 'Team A', 'Team B']

function Teach({ children }) {
  return (
    <div style={{ marginTop: 18, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
      {children}
    </div>
  )
}

const cardTitle = { fontSize: 22, margin: '0 0 8px', fontWeight: 900, color: '#fff', lineHeight: 1.3 }
const cardSub = { color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, maxWidth: 460 }
const primaryBtn = { padding: '15px 26px', borderRadius: 14, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 40px rgba(59,130,246,0.35)', fontFamily: 'inherit' }
const ghostBtn = { padding: '15px 18px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
const mobileStickyNav = { position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(7,11,22,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 50 }
