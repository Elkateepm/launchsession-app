import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Signup() {
  const [organisationName, setOrganisationName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSignup = async e => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    const { error } = await supabase.from('trial_requests').insert([{
      organisation_name: organisationName,
      full_name: fullName,
      email,
      status: 'new'
    }])

    if (error) {
      setError(error.message || 'Could not submit trial request.')
      setLoading(false)
      return
    }

    setLoading(false)
    setMessage('✅ Trial request received. We’ll contact you shortly to activate your LaunchSession workspace.')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#060B18', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <form onSubmit={handleSignup} style={{ width:'100%', maxWidth:460, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding:32 }}>
        <h1 style={{ color:'#fff', margin:0 }}>Start your free 7-day trial</h1>
        <p style={{ color:'rgba(255,255,255,0.55)' }}>Request access to your LaunchSession workspace.</p>

        {error && <div style={{ color:'#FCA5A5', marginBottom:16 }}>{error}</div>}
        {message && <div style={{ color:'#86EFAC', marginBottom:16 }}>{message}</div>}

        <input required placeholder="Organisation name" value={organisationName} onChange={e=>setOrganisationName(e.target.value)} style={inp} />
        <input required placeholder="Your full name" value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} />
        <input required type="email" placeholder="Work email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />

        <button type="submit" disabled={loading || !!message} style={btn}>
          {loading ? 'Submitting...' : message ? 'Request Sent' : 'Start Free Trial'}
        </button>
      </form>
    </div>
  )
}

const inp = { width:'100%', boxSizing:'border-box', marginTop:14, padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff' }
const btn = { width:'100%', marginTop:20, padding:14, borderRadius:12, border:'none', background:'#3b82f6', color:'#fff', fontWeight:800, cursor:'pointer' }
