import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function CreatePassword() {
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadInvite = async () => {
      const token = new URLSearchParams(window.location.search).get('token')
      if (!token) {
        setError('Invite token missing.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('admin_invites')
        .select('*, organisations(name, slug)')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (error || !data) setError('Invite not found or already used.')
      else setInvite(data)

      setLoading(false)
    }

    loadInvite()
  }, [])

  const createAccount = async e => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password
    })

    if (authError) {
      setError(authError.message)
      setSaving(false)
      return
    }

    if (authData?.user?.id) {
      await supabase.from('user_profiles').insert([{
        id: authData.user.id,
        org_id: invite.org_id,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role || 'admin'
      }])

      await supabase
        .from('admin_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
    }

    localStorage.setItem('launchsession_org_slug', invite.organisations.slug)
    window.location.href = '/hub?org=' + invite.organisations.slug
  }

  if (loading) return <div style={page}>Loading invite...</div>

  return (
    <div style={page}>
      <form onSubmit={createAccount} style={card}>
        <img src="/logo.png" alt="LaunchSession" style={{ width: 130, marginBottom: 20 }} />
        <h1 style={title}>Create your password</h1>
        {invite && <p style={sub}>Workspace: <b>{invite.organisations?.name}</b></p>}
        {error && <div style={err}>{error}</div>}
        <input type="password" placeholder="Create password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} />
        <input type="password" placeholder="Confirm password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={inp} />
        <button type="submit" disabled={saving} style={btn}>{saving ? 'Creating account...' : 'Create Account'}</button>
      </form>
    </div>
  )
}

const page = { minHeight:'100vh', background:'#060B18', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', padding:20 }
const card = { width:'100%', maxWidth:420, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding:32, textAlign:'center' }
const title = { margin:0, fontSize:30, fontWeight:900 }
const sub = { color:'rgba(255,255,255,0.6)' }
const inp = { width:'100%', boxSizing:'border-box', marginTop:14, padding:14, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#fff' }
const btn = { width:'100%', marginTop:20, padding:14, borderRadius:12, border:'none', background:'#3b82f6', color:'#fff', fontWeight:800, cursor:'pointer' }
const err = { color:'#FCA5A5', marginTop:16 }
