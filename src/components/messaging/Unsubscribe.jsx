import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Public unsubscribe page, reached from the link in a newsletter.
//
// The token in the URL is the newsletter_recipients row id -- a random uuid
// that only ever appeared in that one person's email. Using it instead of the
// address means the email itself never travels in a URL, which would otherwise
// end up in browser history, referrer headers and shared screenshots.
//
// Deliberately does not act on page load. Mail clients and security scanners
// pre-fetch links in email, and an unsubscribe that fires on GET would opt
// people out who never clicked anything. The person has to press the button.

const TOKEN = window.location.pathname.split('/unsubscribe/')[1]?.split(/[/?#]/)[0]

const wrap = {
  minHeight: '100vh', background: '#F6F8FC', fontFamily: 'system-ui, sans-serif',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}
const card = {
  background: '#fff', borderRadius: 20, padding: '38px 34px', maxWidth: 440, width: '100%',
  textAlign: 'center', boxShadow: '0 20px 60px rgba(15,23,42,0.08)',
}

export default function Unsubscribe() {
  const [state, setState] = useState('ready') // ready | working | done | error
  const [info, setInfo] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!TOKEN) { setState('error'); setMessage('That unsubscribe link is missing its code.') }
  }, [])

  const confirm = async () => {
    setState('working')
    const { data, error } = await supabase.rpc('unsubscribe_newsletter', { p_token: TOKEN })
    if (error) {
      setState('error')
      setMessage('That unsubscribe link is not valid. It may have already been used, or the newsletter may have been deleted.')
      return
    }
    setInfo(Array.isArray(data) ? data[0] : data)
    setState('done')
  }

  if (state === 'error') return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>🔗</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>We couldn't use that link</div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>{message}</div>
      </div>
    </div>
  )

  if (state === 'done') return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
          {info?.already ? "You're already unsubscribed" : "You've been unsubscribed"}
        </div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>
          {info?.email ? <strong style={{ color: '#334155' }}>{info.email}</strong> : 'That address'} won't receive any more
          newsletters from {info?.org_name || 'this organisation'}.
        </div>
        <div style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 1.6, marginTop: 16 }}>
          You'll still get essential messages about your place on sessions — this only stops the newsletter.
          If you'd like to come back, ask {info?.org_name || 'the organisation'} to add you again.
        </div>
      </div>
    </div>
  )

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>✉️</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 10 }}>Unsubscribe from this newsletter?</div>
        <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 22 }}>
          You'll stop receiving newsletters. Essential messages about your place on sessions will still reach you.
        </div>
        <button onClick={confirm} disabled={state === 'working'} style={{
          width: '100%', padding: '14px', borderRadius: 11, border: 'none',
          background: '#0F172A', color: '#fff', fontSize: 15, fontWeight: 800,
          cursor: state === 'working' ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: state === 'working' ? 0.6 : 1,
        }}>
          {state === 'working' ? 'Unsubscribing…' : 'Yes, unsubscribe me'}
        </button>
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 14 }}>
          Clicked by mistake? Just close this page — nothing has changed yet.
        </div>
      </div>
    </div>
  )
}
