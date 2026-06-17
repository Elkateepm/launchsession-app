import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function Signup() {
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signUp({
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

    if (authError) {
      console.error('AUTH ERROR:', authError)
      setError(authError.message || JSON.stringify(authError, null, 2))
      setLoading(false)
      return
    }

    setLoading(false)
    setError('✅ Trial request created. Please check your email to confirm your account. We will activate your workspace shortly.')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#060B18', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <form onSubmit={handleSignup} style={{ width:'100%', maxWidth:460, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding:32 }}>
        <h1 style={{ color:'#fff', margin:0 }}>Start your free 7-day trial</h1>
        <p style={{ color:'rgba(255,255,255,0.55)' }}>Create your LaunchSession workspace.</p>
        {error && <pre style={{ color:'#FCA5A5', marginBottom:16, whiteSpace:'pre-wrap', fontSize:12 }}>{error}</pre>}
        <input required placeholder="Organisation name" value={orgName} onChange={e=>setOrgName(e.target.value)} style={inp} />
        <input required placeholder="Your full name" value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} />
        <input required type="email" placeholder="Work email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
        <input required type="password" placeholder="Create password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} />
        <button type="submit" disabled={loading} style={btn}>{loading ? 'Creating trial...' : 'Start Free Trial'}</button>
      </form>
    </div>
  )
}

const inp = { width:'100%', boxSizing:'border-box', marginTop:14, padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff' }
const btn = { width:'100%', marginTop:20, padding:14, borderRadius:12, border:'none', background:'#3b82f6', color:'#fff', fontWeight:800, cursor:'pointer' }
