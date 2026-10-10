import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../lib/icons'

// /join-team/<code>: someone scanned a team's QR code or opened its link.
// They can only ask; the request waits on the Team page until someone
// approves it, which sends them the usual email invite to set up an account.
const CODE = window.location.pathname.split('/join-team/')[1]?.split('/').filter(Boolean)[0]

const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 16, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }
const label = { fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }

export default function PublicTeamJoin({ code = CODE }) {
  const [org, setOrg] = useState(undefined) // undefined loading, null not found
  const [f, setF] = useState({ full_name: '', email: '', phone: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  useEffect(() => {
    // A malformed code would make the uuid cast fail; treat it as not found.
    if (!code || !/^[0-9a-f-]{36}$/i.test(code)) { setOrg(null); return }
    supabase.rpc('get_team_join_page', { p_code: code }).then(({ data }) => setOrg(data?.[0] || null))
  }, [code])

  const ready = f.full_name.trim() && /\S+@\S+\.\S+/.test(f.email.trim())

  const submit = async (e) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true); setError('')
    const { error: err } = await supabase.rpc('submit_team_join_request', {
      p_code: code, p_full_name: f.full_name.trim(), p_email: f.email.trim(),
      p_phone: f.phone.trim() || null, p_message: f.message.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err.message || 'Something went wrong. Please try again.'); return }
    setDone(true)
  }

  const page = { minHeight: '100dvh', background: 'var(--surface2)', fontFamily: 'system-ui, sans-serif' }
  const centre = { ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }

  if (org === undefined) return <div style={{ ...centre, color: 'var(--text-faint)' }}>Loading…</div>
  if (org === null) return (
    <div style={centre}>
      <div style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 36, marginBottom: 10, color: 'var(--text3)' }}><Icon name="🔗" /></div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>This join link isn't working</div>
        <div style={{ fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.5 }}>It may have been turned off or replaced. Ask the organisation for a new one.</div>
      </div>
    </div>
  )

  const primary = org.primary_color || '#4714ff'

  if (done) return (
    <div style={centre}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 36, maxWidth: 420, boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--ok-text)' }}><Icon name="✅" /></div>
        <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Request sent</div>
        <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.55 }}>
          {org.org_name} will look at your request. Once approved, you'll get an email at <strong>{f.email.trim()}</strong> to set up your account.
        </div>
      </div>
    </div>
  )

  return (
    <div style={page}>
      <div style={{ background: primary, padding: '28px 20px', color: '#fff', textAlign: 'center' }}>
        {org.logo_url && <img src={org.logo_url} alt="" style={{ maxWidth: 160, height: 52, objectFit: 'contain', background: '#fff', borderRadius: 12, padding: '6px 10px', boxSizing: 'border-box', marginBottom: 10 }} />}
        <div style={{ fontSize: 20, fontWeight: 900 }}>{org.org_name}</div>
        <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 2 }}>Ask to join the team</div>
      </div>
      <form onSubmit={submit} style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 60px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 20px 6px', marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 16 }}>
            Fill this in and someone at {org.org_name} will approve you. You'll then get an email to set up your account.
          </div>
          {[
            ['full_name', 'Your name *', 'text', 'name'],
            ['email', 'Email *', 'email', 'email'],
            ['phone', 'Phone', 'tel', 'tel'],
          ].map(([k, l, type, ac]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <label htmlFor={`join-${k}`} style={label}>{l}</label>
              <input id={`join-${k}`} type={type} autoComplete={ac} value={f[k]} onChange={e => set(k, e.target.value)} maxLength={k === 'full_name' ? 120 : k === 'phone' ? 40 : 254} style={inp} />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="join-message" style={label}>Anything they should know?</label>
            <textarea id="join-message" rows={3} value={f.message} onChange={e => set('message', e.target.value)} maxLength={1000} placeholder="e.g. I'm the new Tuesday coach" style={{ ...inp, resize: 'vertical' }} />
          </div>
        </div>
        {error && <div style={{ color: 'var(--danger-text)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={!ready || busy} style={{
          width: '100%', minHeight: 48, borderRadius: 12, border: 'none', background: ready ? primary : 'var(--text-faint)',
          color: '#fff', fontWeight: 800, fontSize: 15, cursor: ready && !busy ? 'pointer' : 'default', fontFamily: 'inherit', opacity: busy ? 0.7 : 1,
        }}>{busy ? 'Sending…' : 'Ask to join'}</button>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-faint)', marginTop: 14 }}>
          <Icon name="🔒" /> Only {org.org_name}'s team managers see what you send.
        </div>
      </form>
    </div>
  )
}
