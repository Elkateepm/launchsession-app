// AUTH FLOW LOCK: org lookup must save selected org then route to /login?org=slug.
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import AuthLayout, { AUTH, AuthError, OrganisationIdentity, authInput, authLabel, authLink, authButton } from './AuthLayout'
import { useBreakpoint } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'

export default function OrgLookup() {
  const { isDesktop } = useBreakpoint()
  useEffect(() => {
    try {
      localStorage.removeItem('launchsession_org_slug')
      localStorage.removeItem('launchsession_remembered_org_slug')
    } catch (e) {}
  }, [])
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('org')
  const [org, setOrg] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [rememberOrg, setRememberOrg] = useState(false)
  const [allOrgs, setAllOrgs] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const [dismissed, setDismissed] = useState(false)
  const blurTimer = useRef(null)

  // The org list was already being pulled in full on every search and filtered
  // in the browser, so fetching it once up front costs nothing extra and makes
  // suggestions instant -- no per-keystroke query, no debounce, no rate limit
  // to think about.
  useEffect(() => {
    let cancelled = false
    supabase.from('organisations_public').select('*').then(({ data, error: loadError }) => {
      if (!cancelled && !loadError) setAllOrgs(data || [])
    }, () => { /* Search can retry when the directory is unavailable. */ })
    return () => { cancelled = true; if (blurTimer.current) clearTimeout(blurTimer.current) }
  }, [])

  const norm = (v) => (v || '').toLowerCase().replace(/-/g, ' ').trim()

  // Ranked matches for a query: exact, then prefix, then substring. Shared by
  // the suggestion dropdown and the submit handler so the two can never
  // disagree about whether an organisation exists -- submitting used to
  // require an exact name, which told people "No organisation found" while
  // their organisation was sitting in the dropdown directly below.
  const rankMatches = (list, raw) => {
    const q = norm(raw)
    if (!q || !list) return []

    const scored = []
    for (const o of list) {
      const name = norm(o.name)
      const slug = norm(o.slug)
      // Prefix beats substring, so typing "sol" puts Solidarity Sports at the
      // top rather than something that merely contains the letters.
      if (name === q || slug === q) scored.push([0, o])
      else if (name.startsWith(q) || slug.startsWith(q)) scored.push([1, o])
      else if (name.includes(q) || slug.includes(q)) scored.push([2, o])
    }
    scored.sort((a, b) => a[0] - b[0] || norm(a[1].name).localeCompare(norm(b[1].name)))
    return scored.map(x => x[1])
  }

  // Two characters minimum. A single letter would list most of the tenant
  // directory to anyone idly typing, which is a different thing from helping
  // somebody who knows their own organisation's name.
  const computeSuggestions = (raw) => {
    if (norm(raw).length < 2 || !allOrgs) return []
    return rankMatches(allOrgs, raw).slice(0, 6)
  }

  // autoFocus means somebody can be mid-word before the list arrives. Without
  // this, their suggestions would stay empty until the next keystroke.
  useEffect(() => {
    if (allOrgs && step === 'org' && !dismissed) setSuggestions(computeSuggestions(orgName))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrgs])

  const handleOrgNameChange = (value) => {
    setOrgName(value)
    setDismissed(false)
    setHighlight(-1)
    setSuggestions(computeSuggestions(value))
    if (error) setError('')
  }

  // Picking a suggestion lands on the confirmation step rather than jumping
  // straight to /login, so the logo and the "remember this
  // organisation" checkbox all still get their turn.
  const handlePick = (selected) => {
    setSuggestions([])
    setDismissed(true)
    setOrgName(selected.name || selected.slug)
    setOrg(selected)
    setStep('found')
  }

  const handleKeyDown = (e) => {
    const open = suggestions.length > 0 && !dismissed
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter' && highlight >= 0) {
      // Only swallow Enter when something is actually highlighted, so the form
      // still submits normally for anyone typing the name out in full.
      e.preventDefault()
      handlePick(suggestions[highlight])
    } else if (e.key === 'Escape') {
      setDismissed(true)
      setHighlight(-1)
    }
  }

  const handleOrgSearch = async e => {
    e.preventDefault()
    if (!orgName.trim() || loading) return
    setLoading(true)
    setError('')

    const normalizedQuery = norm(orgName)

    // Uses the public-safe view (name/slug/logo/colours only) instead of the
    // base table -- status filtering (active/trial) is already baked into the
    // view. Prefetched on mount; re-read here only if that hasn't landed yet.
    let orgs = allOrgs
    if (!orgs) {
      try {
        const { data, error: loadError } = await supabase.from('organisations_public').select('*')
        if (loadError) throw loadError
        orgs = data || []
        setAllOrgs(orgs)
      } catch (e) {
        setError('We could not load organisations. Check your connection and try again.')
        setLoading(false)
        return
      }
    }

    setLoading(false)
    setSuggestions([])

    // An exact name wins outright -- someone who typed their organisation in
    // full should not be handed a chooser. Otherwise fall back to the same
    // ranking the dropdown uses, so a partial name resolves instead of
    // erroring. Below two characters only an exact match counts, matching the
    // dropdown's own floor: "a" must not return half the tenant directory.
    const ranked = normalizedQuery.length >= 2 ? rankMatches(orgs, orgName) : []
    const exact = orgs.filter(o => norm(o.name) === normalizedQuery || norm(o.slug) === normalizedQuery)
    // Capped for the same reason the dropdown is: a very broad query should
    // narrow the name, not scroll a list of every organisation it touched.
    const matches = exact.length ? exact : ranked.slice(0, 8)

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
    if (rememberOrg) {
      localStorage.setItem('launchsession_remembered_org_slug', selectedOrg.slug)
    } else {
      localStorage.removeItem('launchsession_remembered_org_slug')
    }
    window.location.href = window.location.origin + '/login?org=' + encodeURIComponent(selectedOrg.slug)
  }

  const selectedOrg = step === 'found' && org && !Array.isArray(org) ? org : null
  const primary = selectedOrg?.primary_color || '#5A45BC'
  const heading = { margin: '0 0 10px', fontSize: isDesktop ? 28 : 25, lineHeight: 1.25, letterSpacing: -0.8, color: AUTH.ink, fontWeight: 800 }
  const description = { margin: '0 0 24px', fontSize: 13, lineHeight: 1.7, color: AUTH.muted }
  const resetSearch = () => { setStep('org'); setError(''); setOrg(null); setOrgName(''); setSuggestions([]); setHighlight(-1); setRememberOrg(false) }
  const showSuggestions = inputFocused && suggestions.length > 0 && !dismissed
  const orgOption = (o, i, suggestion) => <button type="button" aria-label={`Select ${o.name}`} onMouseDown={e => suggestion && e.preventDefault()} onClick={() => handlePick(o)} onMouseEnter={() => suggestion && setHighlight(i)}
    style={{ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 10, border: suggestion ? 0 : `1px solid ${AUTH.border}`, textAlign: 'left', background: suggestion && i === highlight ? '#F0EDF9' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
    <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', color: AUTH.muted, background: AUTH.wash, border: `1px solid ${withAlpha(o.primary_color || '#5A45BC', '30')}`, overflow: 'hidden' }}>{o.logo_url ? <img src={o.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon name="🏢" />}</span>
    <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 13, color: AUTH.ink, overflowWrap: 'anywhere' }}>{o.name}</strong><span style={{ display: 'block', color: AUTH.muted, fontSize: 11, marginTop: 4, overflowWrap: 'anywhere' }}>Workspace: {o.slug}</span></span><span aria-hidden="true" style={{ color: AUTH.muted }}><Icon name="chevron" /></span>
  </button>

  return <AuthLayout org={selectedOrg} stage="organisation">
    {step === 'org' && <>
      <h1 style={heading}>Find your organisation</h1>
      <p id="organisation-search-hint" style={description}>Start with the youth organisation, charity or community team you work with. Then sign in with your own account.</p>
      <AuthError>{error}</AuthError>
      <form onSubmit={handleOrgSearch} aria-busy={loading}>
        <label htmlFor="organisation-search" style={authLabel}>Organisation name</label>
        <div style={{ position: 'relative' }}>
          <span aria-hidden="true" style={{ position: 'absolute', top: 17, left: 14, color: AUTH.muted }}><Icon name="search" /></span>
          <input id="organisation-search" type="text" value={orgName} onChange={e => handleOrgNameChange(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setInputFocused(true); setDismissed(false); setSuggestions(computeSuggestions(orgName)) }}
            onBlur={() => { blurTimer.current = setTimeout(() => { setInputFocused(false); setDismissed(true) }, 150) }}
            required disabled={loading} autoFocus={isDesktop} autoComplete="off" spellCheck={false} role="combobox" aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? 'org-suggestions' : undefined} aria-describedby="organisation-search-hint" aria-autocomplete="list"
            aria-activedescendant={showSuggestions && highlight >= 0 ? `org-suggestion-${highlight}` : undefined}
            placeholder="Enter your organisation name" style={{ ...authInput, paddingLeft: 42 }} />
        </div>
        {showSuggestions && <ul id="org-suggestions" role="listbox" aria-label="Matching organisations" style={{ margin: '8px 0 0', padding: 5, listStyle: 'none', maxHeight: 252, overflowY: 'auto', border: `1px solid ${AUTH.border}`, borderRadius: 12, background: '#fff' }}>
          {suggestions.map((o, i) => <li key={o.id} id={`org-suggestion-${i}`} role="option" aria-selected={i === highlight}>{orgOption(o, i, true)}</li>)}
        </ul>}
        <button type="submit" disabled={loading || !orgName.trim()} style={{ ...authButton(primary, loading || !orgName.trim()), marginTop: 18 }}>{loading ? 'Searching…' : 'Find my workspace'}</button>
      </form>
      <p style={{ ...description, margin: '18px 0 0', fontSize: 12 }}>Not sure which name to use? Ask the person who invited you. New accounts are arranged by your organisation.</p>
    </>}

    {selectedOrg && <>
      <h1 style={heading}>Is this your organisation?</h1>
      <p style={description}>Check the details before continuing to your account.</p>
      <OrganisationIdentity org={selectedOrg} />
      <p style={{ fontSize: 12, color: AUTH.muted, margin: '10px 0 22px', overflowWrap: 'anywhere' }}>Workspace: {selectedOrg.slug}</p>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, marginBottom: 20, cursor: 'pointer' }}>
        <input type="checkbox" checked={rememberOrg} onChange={e => setRememberOrg(e.target.checked)} aria-describedby="remember-org-hint" style={{ width: 19, height: 19, margin: '2px 0 0', flexShrink: 0, accentColor: primary }} />
        <span><span style={{ fontSize: 13, fontWeight: 650, color: AUTH.ink }}>Remember this organisation</span><span id="remember-org-hint" style={{ display: 'block', marginTop: 4, fontSize: 11, color: AUTH.muted, lineHeight: 1.6 }}>For future sign-ins on this device. This does not keep you signed in.</span></span>
      </label>
      <button type="button" onClick={() => handleContinue(selectedOrg)} style={authButton(primary)}>Continue to sign in</button>
      <button type="button" onClick={resetSearch} style={{ ...authLink, marginTop: 8 }}><Icon name="←" /> Choose a different organisation</button>
    </>}

    {step === 'multiple' && Array.isArray(org) && <>
      <h1 style={heading}>Choose your organisation</h1>
      <p style={description}>More than one workspace matches. Select the organisation you work with.</p>
      <div style={{ display: 'grid', gap: 10 }}>{org.map((o, i) => <React.Fragment key={o.id}>{orgOption(o, i, false)}</React.Fragment>)}</div>
      <button type="button" onClick={resetSearch} style={{ ...authLink, marginTop: 12 }}><Icon name="←" /> Search again</button>
    </>}
  </AuthLayout>
}
