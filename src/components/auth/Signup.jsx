import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

const slugify = value =>
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

    const slug = slugify(orgName)

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }

    const now = new Date()
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert([{
        name: orgName,
        slug,
        status: 'trial',
        trial_started_at: now.toISOString(),
        trial_expires_at: expires.toISOString()
      }])
      .select()
      .single()

    if (orgError) { setError(orgError.message); setLoading(false); return }

    await supabase.from('user_profiles').insert([{
      id: authData.user.id,
      org_id: org.id,
      email,
      full_name: fullName,
      role: 'admin'
    }])

    localStorage.setItem('launchsession_org_slug', slug)
    window.location.href = '/?org=' + slug
  }

  return (
    <div style={{ minHeight:'100vh', background:'#060B18', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <form onSubmit={handleSignup} style={{ width:'100%', maxWidth:460, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding:32 }}>
        <h1 style={{ color:'#fff', margin:0 }}>Start your free 7-day trial</h1>
        <p style={{ color:'rgba(255,255,255,0.55)' }}>Create your LaunchSession workspace.</p>
        {error && <div style={{ color:'#FCA5A5', marginBottom:16 }}>{error}</div>}
        <input required placeholder="Organisation name" value={orgName} onChange={e=>setOrgName(e.target.value)} style={inp} />
        <input required placeholder="Your full name" value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} />
        <input required type="email" placeholder="Work email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
        <input required type="password" placeholder="Create password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} />
        <button disabled={loading} style={btn}>{loading ? 'Creating trial...' : 'Start Free Trial'}</button>
      </form>
    </div>
  )
}

const inp = { width:'100%', boxSizing:'border-box', marginTop:14, padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff' }
const btn = { width:'100%', marginTop:20, padding:14, borderRadius:12, border:'none', background:'#3b82f6', color:'#fff', fontWeight:800, cursor:'pointer' }
