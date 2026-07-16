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
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', justifyContent: 'center', padding: '48px 20px 32px', position: 'relative', overflow: 'hidden', fontFamily: font }}>

      <SpaceBackground height={620} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {step === 'found' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <img src="/logo.png" alt="LaunchSession" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, color: '#fff' }}>
                Launch<span style={{ background: 'linear-gradient(135deg,#93C5FD,#C4B5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Session</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Built for youth &amp; community organisations</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <img src="/logo.png" alt="LaunchSession" style={{ width: 76, height: 76, objectFit: 'contain', display: 'block', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: '#fff' }}>
              Launch<span style={{ background: 'linear-gradient(135deg,#93C5FD,#C4B5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Session</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
              Built for youth &amp; community organisations
            </div>
          </div>
        )}

        {step === 'org' && (
          <div style={{ marginTop: 8, marginBottom: 22, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.9, lineHeight: 1.15, color: '#fff' }}>
              Let&apos;s get you to<br />
              <span style={{ background: 'linear-gradient(135deg,#60A5FA,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>your workspace</span>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 10, fontWeight: 500 }}>
              Enter your organisation name to continue
            </div>
          </div>
        )}

        {step === 'found' && (
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.18, color: '#fff' }}>Welcome back!</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 8, fontWeight: 500 }}>Find your organisation to continue</div>
          </div>
        )}

        {step === 'multiple' && (
          <>
            {/* Rocket hero illustration */}
            <div style={{ margin: '4px 0 8px', textAlign: 'center' }}>
              <RocketIllustration width={205} />
            </div>

            {/* Headline */}
            <div style={{ textAlign: 'center', marginBottom: 26 }}>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.18, color: '#fff' }}>A few workspaces match</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 10, fontWeight: 500 }}>Select your organisation below</div>
            </div>
          </>
        )}

        <div style={{
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${step === 'found' ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 24, padding: 28, backdropFilter: 'blur(20px)',
          boxShadow: step === 'found' ? '0 0 60px 10px rgba(139,92,246,0.18)' : 'none',
        }}>

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
              </form>
            </div>
          )}

          {/* STEP: FOUND */}
          {step === 'found' && org && !Array.isArray(org) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px', border: `2px solid ${org.primary_color || '#8B5CF6'}`, boxShadow: `0 0 24px 2px ${org.primary_color || '#8B5CF6'}40`,
                background: '#0B0F27', overflow: 'hidden',
              }}>
                <img src={org.logo_url || FALLBACK_LOGO_URL} alt={org.name} style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 10 }}>{org.name}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#C4B5FD', marginBottom: 10 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                Verified Organisation
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>{org.slug}.launchsession.co.uk</div>
              <button onClick={() => handleContinue(org)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: font, boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
                Continue to Sign In →
              </button>
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

        {step === 'found' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>OR</div>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <button onClick={() => { setStep('org'); setError(''); setOrgName('') }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)',
              fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: font,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <span style={{ flex: 1, textAlign: 'left' }}>Sign in to a different organisation</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 20, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Your data is secure and your organisation is private.
            </div>
          </>
        )}

        {step === 'org' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Secure. Private. Built for organisations like yours.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 26 }}>
              {[
                { icon: 'lock', bg: 'linear-gradient(135deg,#8B5CF6,#6366F1)', title: 'Secure access', sub: 'Your data stays safe' },
                { icon: 'people', bg: 'linear-gradient(135deg,#3B4276,#252B52)', title: 'Built for teams', sub: 'Collaborate with ease' },
                { icon: 'rocket', bg: 'linear-gradient(135deg,#8B5CF6,#6366F1)', title: 'Save time', sub: 'Focus on what matters' },
              ].map(f => (
                <div key={f.title} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, flexShrink: 0 }}>
                    {f.icon === 'lock' && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    )}
                    {f.icon === 'people' && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
                        <circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.9.5 5 2.6 5 5.3" />
                      </svg>
                    )}
                    {f.icon === 'rocket' && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2c3 2 5 6 5 10 0 2-1 4-1 4l-4 1-4-1s-1-2-1-4c0-4 2-8 5-10Z" />
                        <circle cx="12" cy="10" r="1.6" fill="#fff" stroke="none" />
                        <path d="M9 15l-3 3 1 3 3-3M15 15l3 3-1 3-3-3" />
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.35 }}>{f.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <button onClick={() => window.location.href = 'https://www.launchsession.co.uk/landing.html'} style={{
          width: '100%', marginTop: 28, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
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
