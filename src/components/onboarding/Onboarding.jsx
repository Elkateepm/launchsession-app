import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

const ORG_TYPES = [
  { value: 'charity', label: '❤️ Charity' },
  { value: 'sports_club', label: '⚽ Sports Club' },
  { value: 'youth_group', label: '🧒 Youth Group' },
  { value: 'community_centre', label: '🏢 Community Centre' },
  { value: 'after_school', label: '📚 After-School' },
  { value: 'other', label: '✨ Other' },
]

const SIZES = [
  { value: '1-25', label: '1–25 members' },
  { value: '26-50', label: '26–50 members' },
  { value: '51-100', label: '51–100 members' },
  { value: '101-250', label: '101–250 members' },
  { value: '250+', label: '250+ members' },
]

const FOCUSES = [
  { value: 'sports', label: '⚽ Sports & Physical Activity' },
  { value: 'arts', label: '🎨 Arts & Creative' },
  { value: 'education', label: '📖 Education & Learning' },
  { value: 'wellbeing', label: '🧠 Wellbeing & Mental Health' },
  { value: 'multiple', label: '🌟 Multiple Focus Areas' },
]

export default function Onboarding({ session, org, onComplete }) {
  const [step, setStep] = useState(0)
  const [orgType, setOrgType] = useState('')
  const [size, setSize] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('UK')
  const [focus, setFocus] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  const handleComplete = async () => {
    setSaving(true)
    setError('')

    const { error: orgError } = await supabase
      .from('organisations')
      .update({
        type: orgType,
        city,
        country,
        size,
        focus,
        contact_name: contactName,
        contact_email: contactEmail,
        onboarding_data: { org_type: orgType, size, city, country, focus, contact_name: contactName, contact_email: contactEmail, completed_at: new Date().toISOString() }
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

  const TOTAL_STEPS = 6
  const page = { minHeight: '100vh', background: 'radial-gradient(circle at 20% 0%, rgba(37,99,235,0.28), transparent 32%), linear-gradient(135deg, #020617 0%, #071A3A 45%, #020817 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: '#fff' }
  const card = { width: '100%', maxWidth: 520, background: 'linear-gradient(145deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))', border: '1px solid rgba(96,165,250,0.18)', borderRadius: 24, padding: '40px 36px', boxShadow: '0 28px 80px rgba(0,0,0,0.35)' }
  const title = { fontSize: 26, fontWeight: 900, marginBottom: 8, letterSpacing: -0.5 }
  const sub = { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }
  const opt = (sel) => ({ padding: '14px 16px', borderRadius: 12, border: sel ? '2px solid #3B82F6' : '1.5px solid rgba(255,255,255,0.1)', background: sel ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%' })
  const btn = (disabled) => ({ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 })
  const btnGhost = { width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10 }
  const inp = { width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 15, outline: 'none', marginBottom: 14 }

  const Progress = () => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < step ? '#3B82F6' : i === step ? '#60A5FA' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s' }} />
      ))}
    </div>
  )

  if (step === 0) return (
    <div style={page}><div style={card}>
      <div style={{ fontSize: 52, marginBottom: 20 }}>🚀</div>
      <div style={title}>Welcome to {org.name}!</div>
      <div style={sub}>Let's take 2 minutes to set up your LaunchSession workspace. We'll ask a few quick questions to personalise your experience.</div>
      <button style={btn(false)} onClick={next}>Let's Go →</button>
    </div></div>
  )

  if (step === 1) return (
    <div style={page}><div style={card}>
      <Progress />
      <div style={title}>What type of organisation are you?</div>
      <div style={sub}>This helps us tailor your workspace to your needs.</div>
      <div style={grid}>{ORG_TYPES.map(o => <button key={o.value} style={opt(orgType === o.value)} onClick={() => setOrgType(o.value)}>{o.label}</button>)}</div>
      <button style={btn(!orgType)} onClick={next} disabled={!orgType}>Continue →</button>
      <button style={btnGhost} onClick={back}>← Back</button>
    </div></div>
  )

  if (step === 2) return (
    <div style={page}><div style={card}>
      <Progress />
      <div style={title}>How many members do you have?</div>
      <div style={sub}>An approximate number is fine.</div>
      <div style={grid}>{SIZES.map(o => <button key={o.value} style={opt(size === o.value)} onClick={() => setSize(o.value)}>{o.label}</button>)}</div>
      <button style={btn(!size)} onClick={next} disabled={!size}>Continue →</button>
      <button style={btnGhost} onClick={back}>← Back</button>
    </div></div>
  )

  if (step === 3) return (
    <div style={page}><div style={card}>
      <Progress />
      <div style={title}>Where are you based?</div>
      <div style={sub}>Enter your city and country.</div>
      <input style={inp} placeholder="City (e.g. London)" value={city} onChange={e => setCity(e.target.value)} autoFocus />
      <input style={inp} placeholder="Country (e.g. UK)" value={country} onChange={e => setCountry(e.target.value)} />
      <button style={btn(!city.trim())} onClick={next} disabled={!city.trim()}>Continue →</button>
      <button style={btnGhost} onClick={back}>← Back</button>
    </div></div>
  )

  if (step === 4) return (
    <div style={page}><div style={card}>
      <Progress />
      <div style={title}>What's your primary focus?</div>
      <div style={sub}>What does your organisation mainly deliver?</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {FOCUSES.map(o => <button key={o.value} style={opt(focus === o.value)} onClick={() => setFocus(o.value)}>{o.label}</button>)}
      </div>
      <button style={btn(!focus)} onClick={next} disabled={!focus}>Continue →</button>
      <button style={btnGhost} onClick={back}>← Back</button>
    </div></div>
  )

  if (step === 5) return (
    <div style={page}><div style={card}>
      <Progress />
      <div style={title}>Who's the main contact?</div>
      <div style={sub}>We'll use this for important workspace communications.</div>
      <input style={inp} placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} autoFocus />
      <input style={inp} type="email" placeholder="Work email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
      {error && <div style={{ color: '#FCA5A5', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button style={btn(!contactName.trim() || saving)} onClick={handleComplete} disabled={!contactName.trim() || saving}>
        {saving ? 'Setting up...' : 'Launch My Workspace 🚀'}
      </button>
      <button style={btnGhost} onClick={back}>← Back</button>
    </div></div>
  )

  return null
}
