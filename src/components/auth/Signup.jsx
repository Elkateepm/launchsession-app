import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Signup() {
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSignup = async e => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    const signupPromise = supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organisation_name: orgName,
          trial_requested: true
        }
      }
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Signup timed out. Please check Supabase Auth settings.')), 10000)
    )

    const { error: authError } = await Promise.race([signupPromise, timeoutPromise])

    if (authError) {
      setError(authError.message || 'Could not create trial account.')
      setLoading(false)
      return
    }

    setLoading(false)
    setMessage('✅ Trial request created. Please check your email to confirm your account.')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#060B18', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <form onSubmit={handleSignup} style={{ width:'100%', maxWidth:460, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding:32 }}>
        <h1 style={{ color:'#fff', margin:0 }}>Start your free 7-day trial</h1>
        <p style={{ color:'rgba(255,255,255,0.55)' }}>Create your LaunchSession workspace.</p>

        {error && <div style={{ color:'#FCA5A5', marginBottom:16 }}>{error}</div>}
        {message && <div style={{ color:'#86EFAC', marginBottom:16 }}>{message}</div>}

        <input required placeholder="Organisation name" value={orgName} onChange={e=>setOrgName(e.target.value)} style={inp} />
        <input required placeholder="Your full name" value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} />
        <input required type="email" placeholder="Work email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
        <input required type="password" placeholder="Create password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} />

        <button type="submit" disabled={loading || !!message} style={btn}>
          {loading ? 'Creating trial...' : message ? 'Check your email' : 'Start Free Trial'}
        </button>
      </form>
    </div>
  )
}

const inp = { width:'100%', boxSizing:'border-box', marginTop:14, padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff' }
const btn = { width:'100%', marginTop:20, padding:14, borderRadius:12, border:'none', background:'#3b82f6', color:'#fff', fontWeight:800, cursor:'pointer' }
