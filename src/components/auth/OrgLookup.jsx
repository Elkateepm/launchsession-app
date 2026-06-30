// AUTH FLOW LOCK: org lookup must save selected org then route to /login?org=slug.
import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function OrgLookup() {
  localStorage.removeItem('launchsession_org_slug')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('org')
  const [org, setOrg] = useState(null)

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
    <div style={{ minHeight: '100vh', background: '#060B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src='/logo.png' alt='LaunchSession' style={{ width: 120, height: 120, objectFit: 'contain', display: 'block', margin: '0 auto 0' }} />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32 }}>

          {/* STEP: ORG NAME */}
          {step === 'org' && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Find your workspace</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>Enter your organisation name to get started.</div>
              {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleOrgSearch}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Organisation Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    required
                    autoFocus
                    placeholder="e.g. Solidarity Sports"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button type="submit" disabled={loading || !orgName.trim()} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading || !orgName.trim() ? 'default' : 'pointer', opacity: loading || !orgName.trim() ? 0.6 : 1 }}>
                  {loading ? 'Searching...' : 'Find my workspace →'}
                </button>
              </form>
            </div>
          )}

          {/* STEP: FOUND */}
          {step === 'found' && org && !Array.isArray(org) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: org.primary_color || '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 auto 16px', overflow: 'hidden' }}>
                {org.logo_url ? <img src={org.logo_url} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : org.name[0]}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Workspace found</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{org.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 28 }}>{org.slug}.launchsession.co.uk</div>
              <button onClick={() => handleContinue(org)} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
                Continue to {org.name} →
              </button>
              <button onClick={() => { setStep('org'); setError(''); setOrgName('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer' }}>Not your workspace?</button>
            </div>
          )}

          {/* STEP: MULTIPLE RESULTS */}
          {step === 'multiple' && Array.isArray(org) && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Multiple workspaces found</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Select your organisation:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {org.map(o => (
                  <button key={o.id} onClick={() => handleContinue(o)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: o.primary_color || '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                      {o.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{o.slug}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => { setStep('org'); setError(''); setOrgName('') }} style={{ marginTop: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer' }}>← Try a different name</button>
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
