import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function OrgLookup() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('email')
  const [org, setOrg] = useState(null)

  const handleLookup = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    // Look up user_profiles by email to find their org
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id, full_name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (profile?.org_id) {
      const { data: orgData } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', profile.org_id)
        .eq('status', 'active')
        .single()

      if (orgData) {
        setOrg(orgData)
        setStep('found')
        setLoading(false)
        return
      }
    }

    // Try matching by email domain
    const domain = email.split('@')[1]
    if (domain) {
      const { data: orgs } = await supabase
        .from('organisations')
        .select('*')
        .eq('status', 'active')
        .ilike('contact_email', '%' + domain)
        .limit(1)

      if (orgs?.length > 0) {
        setOrg(orgs[0])
        setStep('found')
        setLoading(false)
        return
      }
    }

    setStep('notfound')
    setLoading(false)
  }

  const handleContinue = () => {
    window.location.href = window.location.origin + '?org=' + org.slug
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src='/logo.png' alt='LaunchSession' style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>LaunchSession</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32 }}>

          {step === 'email' && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Find your workspace</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>Enter your work email and we'll find your organisation.</div>
              {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleLookup}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Work email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="you@organisation.com"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={loading || !email.trim()} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || !email.trim() ? 'default' : 'pointer', opacity: loading || !email.trim() ? 0.6 : 1 }}>
                  {loading ? 'Searching...' : 'Find my workspace →'}
                </button>
              </form>
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Know your organisation? </span>
                <button onClick={() => {
                  const slug = window.prompt('Enter your organisation slug:')
                  if (slug?.trim()) window.location.href = window.location.origin + '?org=' + slug.trim()
                }} style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Enter slug</button>
              </div>
            </div>
          )}

          {step === 'found' && org && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: org.primary_color || '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 auto 16px' }}>
                {org.logo_url ? <img src={org.logo_url} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 18 }} /> : org.name[0]}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Found your workspace</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{org.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>{org.slug}.launchsession.co.uk</div>
              <button onClick={handleContinue} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
                Continue to {org.name} →
              </button>
              <button onClick={() => setStep('email')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer' }}>Not your workspace?</button>
            </div>
          )}

          {step === 'notfound' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>No workspace found</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 24 }}>
                We couldn't find a LaunchSession workspace for <strong style={{ color: '#fff' }}>{email}</strong>. Contact your organisation admin for access.
              </div>
              <button onClick={() => { setStep('email'); setError('') }} style={{ width: '100%', padding: 13, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>Try a different email</button>
              <a href="mailto:hello@launchsession.co.uk?subject=New Organisation Request" style={{ display: 'block', fontSize: 13, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>Request access for my organisation</a>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => window.location.href = 'https://www.launchsession.co.uk/landing.html'} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ← Back to launchsession.co.uk
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>
          Powered by <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>LaunchSession</span>
        </div>
      </div>
    </div>
  )
}
