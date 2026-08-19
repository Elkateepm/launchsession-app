import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

// Landing page for the link in the volunteer confirmation email.
//
// The applicant has no account, so the only thing identifying them is the
// token in the URL. Confirming promotes the application from 'unverified' to
// 'pending', which is the point at which the organisation can see it at all.

export default function VerifyVolunteerApplication() {
  const [state, setState] = useState('working')   // working | done | failed
  const [org, setOrg] = useState(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    // Guard against the double invocation React does in development: the token
    // is consumed on first use, so a second call would report failure.
    if (ran.current) return
    ran.current = true

    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setState('failed')
      setMessage('This link is missing its confirmation code. Please use the link from your email exactly as it was sent.')
      return
    }

    supabase.rpc('verify_volunteer_application', { p_token: token }).then(({ data, error }) => {
      if (error) {
        setState('failed')
        setMessage(
          /no longer valid/i.test(error.message || '')
            ? "This link is no longer valid — it may already have been used. If you've already confirmed, there's nothing more to do."
            : "We couldn't confirm your application just now. Please try the link again in a moment."
        )
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      setOrg(row?.org_name || null)
      setName(row?.first_name || '')
      setState('done')
    })
  }, [])

  const wrap = {
    minHeight: '100vh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  }
  const card = {
    background: '#fff', borderRadius: 20, padding: 40, maxWidth: 460, width: '100%',
    textAlign: 'center', boxShadow: '0 20px 60px rgba(15,23,42,0.10)',
  }

  if (state === 'working') {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 15, color: '#64748B' }}>Confirming your application…</div>
        </div>
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontSize: 46, marginBottom: 14 }}>🔗</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>We couldn&rsquo;t confirm that link</div>
          <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>{message}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 46, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
          {name ? `Thanks ${name}, you're all set` : "You're all set"}
        </div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>
          {org
            ? <>Your email is confirmed and your application has gone to <strong style={{ color: '#0F172A' }}>{org}</strong> for review. They&rsquo;ll be in touch if it&rsquo;s a good fit.</>
            : <>Your email is confirmed and your application has gone to the organisation for review.</>}
        </div>
      </div>
    </div>
  )
}
