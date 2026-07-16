// AUTH FLOW LOCK: org lookup must save selected org then route to /login?org=slug.
import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import SpaceBackground from './SpaceBackground'
import RocketIllustration from './RocketIllustration'

// Shown wherever an org logo would go, whenever the org hasn't set one yet
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

const font = "'Plus Jakarta Sans', sans-serif"

export default function OrgLookup() {
  localStorage.removeItem('launchsession_org_slug')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('org')
  const [org, setOrg] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)

  const handleOrgSearch = async e => {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)
    setError('')

    const query = orgName.trim().toLowerCase()
    const normalizedQuery = query.replace(/-/g, ' ')

    // Exact match only (hyphens treated as spaces)
    const { data: orgs } = await supabase
      .from('organisations')
      .select('*')
      .eq('status', 'active')

    setLoading(false)

    const matches = (orgs || []).filter(o => {
      const normalizedName = (o.name || '').toLowerCase().replace(/-/g, ' ')
      const normalizedSlug = (o.slug || '').toLowerCase().replace(/-/g, ' ')
      return normalizedName === normalizedQuery || normalizedSlug === normalizedQuery
    })

    if (matches.length === 1) {
      setOrg(matches[0])
      setStep('found')
    } else if (matches.length > 1) {
      setOrg(matches)
      setStep('multiple')
    } else {
      setError('No organisation found. Check the name or contact your admin.')
    }
  }

  const handleContinue = (selectedOrg) => {
    localStorage.setItem('launchsession_org_slug', selectedOrg.slug)
    window.location.href = window.location.origin + '/login?org=' + selectedOrg.slug
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', justifyContent: 'center', padding: '56px 20px 32px', position: 'relative', overflow: 'hidden', fontFamily: font }}>

      <SpaceBackground height={620} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo + wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <img src="/logo.png" alt="LaunchSession" style={{ width: 76, height: 76, objectFit: 'contain', display: 'block', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: '#fff' }}>
            Launch<span style={{ color: '#60A5FA' }}>Session</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
            Built for youth &amp; community organisations
          </div>
        </div>

        {/* Rocket hero illustration */}
        <div style={{ margin: '4px 0 8px' }}>
          <RocketIllustration width={190} />
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.18, color: '#fff' }}>
            {step === 'org' && <>Let&apos;s get you to your <span style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>workspace</span></>}
            {step === 'found' && <>Almost there</>}
            {step === 'multiple' && <>A few workspaces match</>}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 10, fontWeight: 500 }}>
            {step === 'org' && 'Enter your organisation name to continue'}
            {step === 'found' && 'Confirm your workspace to sign in'}
            {step === 'multiple' && 'Select your organisation below'}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, backdropFilter: 'blur(20px)' }}>

          {/* STEP: ORG NAME */}
          {step === 'org' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(139,92,246,0.35)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M6 21V7l6-4 6 4v14M10 21v-6h4v6M9 10h1M14 10h1M9 14h1M14 14h1" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Organisation name</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>This helps us find your workspace</div>
                </div>
              </div>

              {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <form onSubmit={handleOrgSearch}>
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={inputFocused ? '#93C5FD' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', transition: 'stroke 0.2s' }}>
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    required
                    autoFocus
                    placeholder="e.g. Solidarity Sports"
                    style={{
                      width: '100%', padding: '13px 16px 13px 42px', borderRadius: 12,
                      border: `1px solid ${inputFocused ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.12)'}`,
                      background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, outline: 'none',
                      boxSizing: 'border-box', fontFamily: font,
                      boxShadow: inputFocused ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  />
                </div>
                <button type="submit" disabled={loading || !orgName.trim()} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || !orgName.trim() ? 'default' : 'pointer', opacity: loading || !orgName.trim() ? 0.6 : 1, fontFamily: font, boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
                  {loading ? 'Searching...' : 'Find my workspace →'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  Secure &middot; Your data is protected
                </div>
              </form>
            </div>
          )}

          {/* STEP: FOUND */}
          {step === 'found' && org && !Array.isArray(org) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden', border: `2px solid ${org.primary_color || '#3B82F6'}30` }}>
                <img src={org.logo_url || FALLBACK_LOGO_URL} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Workspace found</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{org.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 28 }}>{org.slug}.launchsession.co.uk</div>
              <button onClick={() => handleContinue(org)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, fontFamily: font, boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
                Continue to {org.name} →
              </button>
              <button onClick={() => { setStep('org'); setError(''); setOrgName('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', fontFamily: font }}>Not your workspace?</button>
            </div>
          )}

          {/* STEP: MULTIPLE RESULTS */}
          {step === 'multiple' && Array.isArray(org) && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Multiple workspaces found</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Select your organisation:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {org.map(o => (
                  <button key={o.id} onClick={() => handleContinue(o)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontFamily: font }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: `1.5px solid ${o.primary_color || '#3B82F6'}30` }}>
                      <img src={o.logo_url || FALLBACK_LOGO_URL} alt={o.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{o.slug}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => { setStep('org'); setError(''); setOrgName('') }} style={{ marginTop: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', fontFamily: font }}>← Try a different name</button>
            </div>
          )}
        </div>

        <button onClick={() => window.location.href = 'https://www.launchsession.co.uk/landing.html'} style={{
          width: '100%', marginTop: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '13px 16px', color: 'rgba(255,255,255,0.55)', fontSize: 13.5, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: font,
        }}>
          <span style={{ fontSize: 15 }}>←</span> Back to launchsession.co.uk
        </button>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          Powered by <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>LaunchSession</span>
        </div>
      </div>
    </div>
  )
}
