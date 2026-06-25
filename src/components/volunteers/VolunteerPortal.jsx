import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const SPORTS = ['Football','Basketball','Cricket','Tennis','Swimming','Athletics','Gymnastics','Boxing','Rugby','Cycling']
const LANGUAGES = ['Arabic','French','Spanish','Urdu','Bengali','Somali','Polish','Portuguese','Turkish','Punjabi']
const SPORT_ICONS = { Football:'ti-ball-football',Basketball:'ti-ball-basketball',Cricket:'ti-cricket',Tennis:'ti-tennis',Swimming:'ti-swimming',Athletics:'ti-run',Gymnastics:'ti-stretching',Boxing:'ti-box',Rugby:'ti-rugby',Cycling:'ti-bike' }

function SectionCard({ children, borderColor }) {
  return <div style={{ background:'#fff', borderRadius:18, border:'1.5px solid '+(borderColor||'var(--border)'), padding:'16px', marginBottom:14 }}>{children}</div>
}
function SectionHead({ icon, title, filled }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:30, height:30, borderRadius:9, background:'#F5F0FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i className={'ti '+icon} style={{ fontSize:15, color:'#9B59B6' }} />
        </div>
        <span style={{ fontSize:14, fontWeight:800, color:'var(--black)', fontFamily:'var(--font-display)' }}>{title}</span>
      </div>
      {filled && <span style={{ fontSize:10, fontWeight:700, background:'#EDFAED', color:'#417505', borderRadius:99, padding:'3px 9px' }}>Saved</span>}
    </div>
  )
}

export default function VolunteerPortal() {
  const [authUser, setAuthUser] = useState(null)
  const [org, setOrg] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [futureSessions, setFutureSessions] = useState([])
  const [staffStatus, setStaffStatus] = useState({})
  const [hours, setHours] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('login')
  const [activeTab, setActiveTab] = useState('home')
  const [form, setForm] = useState({ email:'', password:'', full_name:'', confirm:'' })
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState({})
  const [editMode, setEditMode] = useState(false)
  const [profileForm, setProfileForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showSafeguarding, setShowSafeguarding] = useState(false)
  const [customSkill, setCustomSkill] = useState('')
  const [toast, setToast] = useState('')
  const photoInputRef = useRef(null)

  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768)
  React.useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const slug = window.location.pathname.split('/volunteer/')[1]?.split('/')[0]
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'Organisation'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (slug) supabase.from('organisations').select('*').eq('slug', slug).single().then(({ data }) => { if (data) setOrg(data) })
  }, [slug])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setAuthUser(session?.user || null); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setAuthUser(s?.user || null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (authUser && org) validateAndLoad() }, [authUser, org]) // eslint-disable-line react-hooks/exhaustive-deps

  async function validateAndLoad() {
    const { data: p } = await supabase.from('user_profiles').select('*').eq('id', authUser.id).eq('org_id', org.id).eq('role', 'volunteer').single()
    if (!p) { await supabase.auth.signOut(); setAuthUser(null); setView('login'); setError('This account does not have volunteer access for this organisation.'); return }
    if (p.status === 'pending') { setProfile(p); setView('pending'); return }
    setProfile(p)
    setProfileForm({
      full_name: p.full_name || '', phone: p.phone || '',
      emergency_contact_name: p.emergency_contact_name || '', emergency_contact_phone: p.emergency_contact_phone || '',
      availability: p.availability || [], skills: p.skills || [], age_groups: p.age_groups || [],
    })
    await loadSessions(p)
    setView('dashboard')
  }

  async function loadSessions(p) {
    const orgId = p?.org_id || profile?.org_id || org.id
    const [{ data: todaySess }, { data: future }, { data: ss }] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id', orgId).eq('date', today).order('start_time'),
      supabase.from('sessions').select('*').eq('org_id', orgId).gte('date', today).order('date').limit(20),
      supabase.from('session_staff').select('*').eq('user_id', authUser.id),
    ])
    setSessions(todaySess || [])
    setFutureSessions(future || [])
    const map = {}; (ss || []).forEach(r => { map[r.session_id] = r }); setStaffStatus(map)
    const signed = (ss || []).filter(r => r.signed_in_at)
    setSessionCount(signed.length)
    // Estimate hours from signed in/out
    const h = signed.reduce((sum, r) => {
      if (r.signed_in_at && r.signed_out_at) return sum + (new Date(r.signed_out_at) - new Date(r.signed_in_at)) / 3600000
      return sum + 2 // estimate 2h per session if not signed out
    }, 0)
    setHours(Math.round(h * 10) / 10)
  }

  async function handleLogin(e) {
    e.preventDefault(); setAuthLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) { setError(error.message); setAuthLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setAuthLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) { setAuthLoading(false); setView('login'); setError('You already have an account. Please sign in.'); return }
      setError(error.message); setAuthLoading(false); return
    }
    if (data.user) {
      await supabase.from('user_profiles').upsert({ id: data.user.id, full_name: form.full_name, email: form.email, org_id: org.id, role: 'volunteer', status: 'pending', onboarding_complete: true })
    }
    setAuthLoading(false); setView('pending')
  }

  async function handleSignOut() { await supabase.auth.signOut(); setAuthUser(null); setProfile(null); setView('login') }

  async function toggleSession(s) {
    setSigningIn(p => ({ ...p, [s.id]: true }))
    const existing = staffStatus[s.id]
    if (existing) {
      if (existing.signed_in_at && !existing.signed_out_at) {
        await supabase.from('session_staff').update({ signed_out_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('session_staff').update({ signed_in_at: new Date().toISOString(), signed_out_at: null }).eq('id', existing.id)
      }
    } else {
      await supabase.from('session_staff').insert({ session_id: s.id, user_id: authUser.id, org_id: org.id, signed_in_at: new Date().toISOString() })
    }
    setSigningIn(p => ({ ...p, [s.id]: false }))
    await loadSessions(profile)
  }

  async function bookSession(s) {
    if (staffStatus[s.id]) return
    await supabase.from('session_staff').insert({ session_id: s.id, user_id: authUser.id, org_id: org.id })
    showToast('Session booked!')
    await loadSessions(profile)
  }

  async function saveProfile() {
    setSaving(true)
    await supabase.from('user_profiles').update({ ...profileForm }).eq('id', authUser.id)
    setProfile(p => ({ ...p, ...profileForm }))
    setSaving(false); setEditMode(false); showToast('Profile saved!')
  }

  async function uploadPhoto(e) {
    const file = e.target.files[0]; if (!file) return
    const ext = file.name.split('.').pop()
    const path = `volunteers/${authUser.id}.${ext}`
    const { data } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (data) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('user_profiles').update({ photo_url: urlData.publicUrl }).eq('id', authUser.id)
      setProfile(p => ({ ...p, photo_url: urlData.publicUrl }))
    }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const setPF = (k, v) => setProfileForm(p => ({ ...p, [k]: v }))
  const toggleSkill = s => setPF('skills', profileForm.skills?.includes(s) ? profileForm.skills.filter(x => x !== s) : [...(profileForm.skills||[]), s])
  const toggleDay = d => setPF('availability', profileForm.availability?.includes(d) ? profileForm.availability.filter(x => x !== d) : [...(profileForm.availability||[]), d])
  const toggleAge = a => setPF('age_groups', profileForm.age_groups?.includes(a) ? profileForm.age_groups.filter(x => x !== a) : [...(profileForm.age_groups||[]), a])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'Volunteer'
  const tier = hours >= 100 ? 'Platinum' : hours >= 50 ? 'Gold' : hours >= 25 ? 'Silver' : 'Bronze'
  const tierColors = { Platinum:'#4ADE80', Gold:'#F5D000', Silver:'#C0C0C0', Bronze:'#CD7F32' }
  const nextTier = hours >= 100 ? 100 : hours >= 50 ? 100 : hours >= 25 ? 50 : 25
  const progress = Math.min((hours / nextTier) * 100, 100)

  const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginTop:6 }
  const labelStyle = { fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)', display:'block' }

  const OrgBadge = () => (
    <div style={{ textAlign:'center', marginBottom:32 }}>
      <div style={{ width:64, height:64, borderRadius:18, background:`linear-gradient(135deg, ${primary}, ${primary}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 14px', overflow:'hidden' }}>
        {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🚀'}
      </div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', margin:'0 0 4px' }}>{orgName}</h1>
      <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', margin:0 }}>Volunteer Portal</p>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:`3px solid ${primary}`, borderTop:'3px solid transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (view === 'pending') return (
    <div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400, textAlign:'center' }}>
        <OrgBadge />
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:20, padding:28 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#f1f5f9', marginBottom:8 }}>Awaiting approval</div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.6 }}>Your volunteer request has been sent to {orgName}. You'll receive access once an admin approves your account.</div>
        </div>
        <button onClick={handleSignOut} style={{ marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>Sign out</button>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.15)', marginTop:24 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  if (view === 'register') return (
    <div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <OrgBadge />
        <form onSubmit={handleRegister} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:28 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#f1f5f9', marginBottom:4 }}>Create volunteer account</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:20 }}>Your request will be reviewed by {orgName} before you can access sessions.</div>
          {[['Full name','text','full_name','Jane Smith'],['Email','email','email','jane@email.com'],['Password','password','password','••••••••'],['Confirm password','password','confirm','••••••••']].map(([label, type, key, ph]) => (
            <div key={key} style={{ marginBottom:14 }}>
              <label style={labelStyle}>{label}</label>
              <input type={type} placeholder={ph} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required style={inputStyle} />
            </div>
          ))}
          {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#FCA5A5', marginBottom:14 }}>{error}</div>}
          <button type="submit" disabled={authLoading} style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:`linear-gradient(135deg, ${primary}, ${primary}bb)`, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', marginTop:4 }}>
            {authLoading ? 'Registering...' : 'Request access →'}
          </button>
          <button type="button" onClick={() => { setView('login'); setError('') }} style={{ width:'100%', marginTop:10, padding:10, background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:13, cursor:'pointer' }}>
            Already have an account? Sign in
          </button>
        </form>
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.15)', marginTop:20 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  if (view === 'login') return (
    <div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <OrgBadge />
        <form onSubmit={handleLogin} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:28 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#f1f5f9', marginBottom:4 }}>Welcome back</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:20 }}>Sign in to your volunteer account</div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Email</label>
            <input type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))} required style={inputStyle} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={labelStyle}>Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password:e.target.value }))} required style={inputStyle} />
          </div>
          {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#FCA5A5', marginBottom:14 }}>{error}</div>}
          <button type="submit" disabled={authLoading} style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:`linear-gradient(135deg, ${primary}, ${primary}bb)`, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', opacity:authLoading?0.7:1 }}>
            {authLoading ? 'Signing in...' : 'Sign in →'}
          </button>
          <button type="button" onClick={() => { setView('register'); setError('') }} style={{ width:'100%', marginTop:10, padding:10, background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:13, cursor:'pointer' }}>
            New volunteer? Register here
          </button>
        </form>
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.15)', marginTop:20 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  // DASHBOARD
  const sports = (profileForm.skills||[]).filter(s => SPORTS.includes(s))
  // const languages = (profileForm.skills||[]).filter(s => LANGUAGES.includes(s))
  // const customSkills = (profileForm.skills||[]).filter(s => !SPORTS.includes(s) && !LANGUAGES.includes(s))

  const TABS = [
    { key:'home', icon:'ti-home', label:'Home' },
    { key:'sessions', icon:'ti-calendar', label:'Sessions' },
    { key:'book', icon:'ti-heart-plus', label:'Book' },
    { key:'profile', icon:'ti-user', label:'Profile' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif', paddingBottom:isMobile?80:0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <div style={{ background:'#080D1A', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg, ${primary}, ${primary}88)`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🚀'}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9' }}>{orgName}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Volunteer Portal</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div onClick={() => { setActiveTab('profile') }} style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg, ${primary}88, #6366f188)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', cursor:'pointer', overflow:'hidden' }}>
            {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : firstName[0]?.toUpperCase()}
          </div>
          <button onClick={handleSignOut} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.4)', fontSize:11, cursor:'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position:'fixed', top:70, left:'50%', transform:'translateX(-50%)', background:'#22c55e', color:'#fff', borderRadius:12, padding:'10px 20px', fontSize:13, fontWeight:700, zIndex:200, boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* CONTENT */}
      <div style={{ display:'flex', maxWidth:isMobile?560:1100, margin:'0 auto', padding:isMobile?'20px 16px':'32px 24px', gap:32 }}>

        {/* DESKTOP SIDEBAR */}
        {!isMobile && (
          <div style={{ width:220, flexShrink:0 }}>
            {/* Profile card */}
            <div style={{ background:'linear-gradient(135deg, #1B2A4A, #2D1B69)', borderRadius:16, padding:'20px 16px', marginBottom:16 }}>
              <div style={{ width:56, height:56, borderRadius:16, background:'#9B59B6', border:'2px solid rgba(245,208,0,0.4)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:20, fontWeight:900, color:'#fff' }}>{firstName[0]?.toUpperCase()}</span>}
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:2 }}>{profile?.full_name}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>{profile?.email}</div>
                <span style={{ background:'rgba(245,208,0,0.2)', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800, color:'#F5D000' }}>{tier}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:12 }}>
                <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:900, color:primary }}>{hours.toFixed(1)}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:0.5 }}>Hours</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:900, color:'#F5D000' }}>{sessionCount}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:0.5 }}>Sessions</div>
                </div>
              </div>
            </div>
            {/* Nav items */}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e8edf2', overflow:'hidden' }}>
              {TABS.map((t, i) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 16px', border:'none', borderBottom:i<TABS.length-1?'1px solid #f1f5f9':'none', background:activeTab===t.key?`${primary}10`:'transparent', color:activeTab===t.key?primary:'#64748b', fontSize:13, fontWeight:700, cursor:'pointer', textAlign:'left', transition:'all 0.15s', borderLeft:activeTab===t.key?`3px solid ${primary}`:'3px solid transparent' }}>
                  <i className={'ti '+t.icon} style={{ fontSize:18 }} />{t.label}
                </button>
              ))}
            </div>
            <button onClick={handleSignOut} style={{ width:'100%', marginTop:12, padding:'10px', borderRadius:10, border:'1px solid #e8edf2', background:'transparent', color:'#94a3b8', fontSize:12, fontWeight:600, cursor:'pointer' }}>Sign out</button>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div style={{ flex:1, minWidth:0 }}>

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div>
            <p style={{ fontSize:12, color:'#94a3b8', margin:'0 0 4px' }}>{new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}</p>
            <h2 style={{ fontSize:24, fontWeight:800, color:'#0f172a', margin:'0 0 20px' }}>{greeting}, {firstName} 👋</h2>

            {/* IMPACT CARD */}
            <div style={{ background:'linear-gradient(135deg, #0D1B2A 0%, #1B2A4A 60%, #6366f1 100%)', borderRadius:20, padding:20, marginBottom:16, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'rgba(99,102,241,0.2)' }} />
              <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10 }}>❤️ MY IMPACT</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                <div style={{ fontSize:44, fontWeight:900, color:'#F5D000', lineHeight:1 }}>{Math.round(hours * 2)}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.6)' }}>young people supported</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:12, padding:12 }}>
                  <div style={{ fontSize:22, fontWeight:900, color:primary, lineHeight:1, marginBottom:4 }}>{hours.toFixed(1)}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5 }}>⏱️ Hours Given</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:12, padding:12 }}>
                  <div style={{ fontSize:22, fontWeight:900, color:'#F5D000', lineHeight:1, marginBottom:4 }}>{sessionCount}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5 }}>✅ Sessions Done</div>
                </div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600 }}>{tier} Volunteer · {tier === 'Platinum' ? 'Legendary!' : `${(nextTier - hours).toFixed(1)}h to ${tier === 'Bronze' ? 'Silver' : tier === 'Silver' ? 'Gold' : 'Platinum'}`}</span>
                  <span style={{ fontSize:11, color:tierColors[tier], fontWeight:700 }}>{tier}</span>
                </div>
                <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:99, height:5 }}>
                  <div style={{ background:`linear-gradient(90deg, ${primary}, #F5D000)`, width:`${progress}%`, height:'100%', borderRadius:99 }} />
                </div>
              </div>
            </div>

            {/* TODAY'S SESSIONS */}
            <div style={{ fontSize:13, fontWeight:800, color:'#0f172a', textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>Today's Sessions</div>
            {sessions.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #e8edf2', padding:'32px 24px', textAlign:'center', marginBottom:16 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:4 }}>No sessions today</div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Check the Book tab for upcoming sessions.</div>
              </div>
            ) : sessions.map(s => {
              const ss = staffStatus[s.id]
              const isIn = ss?.signed_in_at && !ss?.signed_out_at
              const wasIn = ss?.signed_in_at && ss?.signed_out_at
              return (
                <div key={s.id} style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${isIn ? primary+'44' : '#e8edf2'}`, padding:'14px 16px', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', marginBottom:4 }}>{s.title}</div>
                      <div style={{ fontSize:12, color:'#94a3b8' }}>🕐 {s.start_time} – {s.end_time}{s.location ? ` · 📍 ${s.location}` : ''}</div>
                      {isIn && <div style={{ fontSize:11, fontWeight:700, color:primary, marginTop:4 }}>● Signed in at {new Date(ss.signed_in_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</div>}
                      {wasIn && <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Signed out · {new Date(ss.signed_out_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</div>}
                    </div>
                    <button onClick={() => toggleSession(s)} disabled={signingIn[s.id]}
                      style={{ padding:'9px 16px', borderRadius:10, border:isIn?`1px solid ${primary}44`:'none', background:isIn?'transparent':`linear-gradient(135deg, ${primary}, ${primary}bb)`, color:isIn?primary:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', flexShrink:0, opacity:signingIn[s.id]?0.6:1 }}>
                      {signingIn[s.id] ? '...' : isIn ? 'Sign Out' : wasIn ? 'Sign In Again' : 'Sign In'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <div>
            <h2 style={{ fontSize:20, fontWeight:800, color:'#0f172a', margin:'0 0 16px' }}>My Session Log</h2>
            {Object.keys(staffStatus).length === 0 ? (
              <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #e8edf2', padding:'40px 24px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:4 }}>No sessions logged yet</div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Book sessions and sign in to start logging hours.</div>
              </div>
            ) : futureSessions.filter(s => staffStatus[s.id]).map(s => {
              const ss = staffStatus[s.id]
              const signedIn = !!ss?.signed_in_at; const signedOut = !!ss?.signed_out_at
              const hrs = ss?.signed_in_at && ss?.signed_out_at ? ((new Date(ss.signed_out_at) - new Date(ss.signed_in_at)) / 3600000).toFixed(1) : null
              return (
                <div key={s.id} style={{ background:'#fff', borderRadius:14, border:'1.5px solid #e8edf2', padding:'14px 16px', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', marginBottom:2 }}>{s.title}</div>
                      <div style={{ fontSize:12, color:'#94a3b8' }}>📅 {new Date(s.date+'T00:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })} · 🕐 {s.start_time}</div>
                    </div>
                    {hrs && <div style={{ background:'#E8F7F9', borderRadius:10, padding:'6px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:900, color:primary }}>{hrs}h</div>
                    </div>}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {signedIn && <span style={{ fontSize:11, fontWeight:700, color:'#417505', background:'#EDFAED', borderRadius:20, padding:'3px 10px' }}>✓ In {new Date(ss.signed_in_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>}
                    {signedOut && <span style={{ fontSize:11, fontWeight:700, color:primary, background:'#E8F7F9', borderRadius:20, padding:'3px 10px' }}>✓ Out {new Date(ss.signed_out_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>}
                    {!signedIn && s.date === today && <button onClick={() => toggleSession(s)} style={{ padding:'6px 14px', borderRadius:20, border:'none', background:'#417505', color:'#fff', fontSize:11, fontWeight:800, cursor:'pointer' }}>Sign In</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* BOOK TAB */}
        {activeTab === 'book' && (
          <div>
            <h2 style={{ fontSize:20, fontWeight:800, color:'#0f172a', margin:'0 0 4px' }}>Find Your Next Adventure</h2>
            <p style={{ fontSize:13, color:'#94a3b8', margin:'0 0 20px' }}>Browse and book upcoming sessions</p>
            {futureSessions.filter(s => !staffStatus[s.id]).map((s, i) => {
              const isFeatured = i === 0
              return (
                <div key={s.id} style={{ background:isFeatured?'#0D1B2A':'#fff', borderRadius:18, border:isFeatured?'none':'1.5px solid #e8edf2', padding:'16px', marginBottom:12, position:'relative', overflow:'hidden' }}>
                  {isFeatured && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg, ${primary}, #F5D000)` }} />}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                    <div style={{ width:48, height:48, borderRadius:14, background:isFeatured?`${primary}33`:'#E8F7F9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className="ti ti-calendar-event" style={{ fontSize:22, color:isFeatured?primary:primary }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {isFeatured && <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Featured Session</div>}
                      <div style={{ fontSize:16, fontWeight:900, color:isFeatured?'#fff':'#0f172a', marginBottom:6 }}>{s.title}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <div style={{ fontSize:12, color:isFeatured?'rgba(255,255,255,0.6)':'#94a3b8' }}>📅 {new Date(s.date+'T00:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}</div>
                        <div style={{ fontSize:12, color:isFeatured?'rgba(255,255,255,0.6)':'#94a3b8' }}>🕐 {s.start_time} – {s.end_time}</div>
                        {s.location && <div style={{ fontSize:12, color:isFeatured?'rgba(255,255,255,0.6)':'#94a3b8' }}>📍 {s.location}</div>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => bookSession(s)}
                    style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:isFeatured?'#F5D000':`linear-gradient(135deg, ${primary}, ${primary}bb)`, color:isFeatured?'#0D1B2A':'#fff', fontSize:14, fontWeight:900, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    <i className="ti ti-heart-plus" style={{ fontSize:15 }} />Join Session
                  </button>
                </div>
              )
            })}
            {futureSessions.filter(s => !staffStatus[s.id]).length === 0 && (
              <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #e8edf2', padding:'40px 24px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:4 }}>You're all booked up!</div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Check back later for more sessions.</div>
              </div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div>
            {!editMode ? (
              <div>
                {/* HERO CARD */}
                <div style={{ background:'linear-gradient(135deg, #1B2A4A 0%, #2D1B69 60%, #9B59B6 100%)', borderRadius:22, padding:'22px 18px 18px', marginBottom:14, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(245,208,0,0.1)' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <div style={{ width:72, height:72, borderRadius:20, background:'#9B59B6', border:'3px solid rgba(245,208,0,0.4)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:24, fontWeight:900, color:'#fff' }}>{firstName[0]?.toUpperCase()}</span>}
                      </div>
                      <button onClick={() => photoInputRef.current?.click()} style={{ position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'#F5D000', border:'2px solid #1B2A4A', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <i className="ti ti-camera" style={{ fontSize:11, color:'#0D1B2A' }} />
                      </button>
                      <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={uploadPhoto} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:3 }}>{profile?.full_name || 'Volunteer'}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8 }}>{profile?.email}</div>
                      <span style={{ background:'rgba(245,208,0,0.2)', borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:800, color:'#F5D000' }}>{tier} Volunteer</span>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    {[{ val:hours.toFixed(1), label:'Hours', color:'#F5D000' }, { val:sessionCount, label:'Sessions', color:'#9FE1CB' }, { val:tier, label:'Tier', color:'#CECBF6' }].map(s => (
                      <div key={s.label} style={{ background:'rgba(255,255,255,0.07)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                        <div style={{ fontSize:18, fontWeight:900, color:s.color, lineHeight:1 }}>{s.val}</div>
                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5, marginTop:4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AVAILABILITY */}
                {profileForm.availability?.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #e8edf2', padding:16, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#0f172a', marginBottom:10 }}>📅 When I can help</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {profileForm.availability.map(d => <span key={d} style={{ background:'#E8F7F9', color:'#085041', borderRadius:99, padding:'6px 14px', fontSize:12, fontWeight:700, border:'1.5px solid #1B9AAA' }}>{d.slice(0,3)}</span>)}
                    </div>
                  </div>
                )}

                {/* SKILLS */}
                {sports.length > 0 && (
                  <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #e8edf2', padding:16, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#0f172a', marginBottom:10 }}>⚡ Sporting superpowers</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {sports.map(s => <span key={s} style={{ display:'flex', alignItems:'center', gap:5, background:'#F5F0FF', color:'#534AB7', borderRadius:99, padding:'6px 14px', fontSize:12, fontWeight:800, border:'1.5px solid #AFA9EC' }}><i className={'ti '+(SPORT_ICONS[s]||'ti-star')} style={{ fontSize:13 }} />{s}</span>)}
                    </div>
                  </div>
                )}

                {/* EMERGENCY CONTACT */}
                <div style={{ background:'#fff', borderRadius:16, border:`1.5px solid ${profile?.emergency_contact_name ? '#9FE1CB' : '#FFB3B3'}`, padding:16, marginBottom:16 }}>
                  <button onClick={() => setShowSafeguarding(!showSafeguarding)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <i className="ti ti-shield-heart" style={{ fontSize:18, color: profile?.emergency_contact_name ? '#417505' : '#C00' }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#0f172a' }}>Emergency contact</div>
                        {!profile?.emergency_contact_name && <div style={{ fontSize:10, color:'#C00', fontWeight:600 }}>Please add a trusted contact</div>}
                      </div>
                    </div>
                    <i className={'ti ti-chevron-'+(showSafeguarding?'up':'down')} style={{ fontSize:15, color:'#94a3b8' }} />
                  </button>
                  {showSafeguarding && (
                    <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #e8edf2' }}>
                      {profile?.emergency_contact_name ? (
                        <div style={{ background:'#EDFAED', borderRadius:12, padding:'12px 14px', border:'1.5px solid #9FE1CB' }}>
                          <div style={{ fontSize:14, fontWeight:800, color:'#0f172a', marginBottom:2 }}>{profile.emergency_contact_name}</div>
                          <div style={{ fontSize:12, color:'#64748b' }}>{profile.emergency_contact_phone}</div>
                        </div>
                      ) : <div style={{ fontSize:12, color:'#C00', fontWeight:600 }}>No emergency contact added. Edit your profile to add one.</div>}
                    </div>
                  )}
                </div>

                <button onClick={() => setEditMode(true)} style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:`linear-gradient(135deg, ${primary}, #6366f1)`, color:'#fff', fontSize:15, fontWeight:900, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <i className="ti ti-pencil" style={{ fontSize:16 }} />Edit my profile
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'#0f172a' }}>Edit Profile</div>
                  <button onClick={() => setEditMode(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:10, padding:'7px 14px', fontSize:12, fontWeight:700, color:'#64748b', cursor:'pointer' }}>Cancel</button>
                </div>
                <SectionCard>
                  <SectionHead icon="ti-id-badge" title="About me" filled={!!(profileForm.full_name && profileForm.phone)} />
                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Full name *</label>
                    <input value={profileForm.full_name} onChange={e => setPF('full_name', e.target.value)} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e8edf2', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Phone</label>
                    <input value={profileForm.phone} onChange={e => setPF('phone', e.target.value)} placeholder="07700900000" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e8edf2', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                  </div>
                </SectionCard>
                <SectionCard borderColor={profileForm.emergency_contact_name && profileForm.emergency_contact_phone ? '#9FE1CB' : '#FFB3B3'}>
                  <SectionHead icon="ti-heart" title="Emergency contact" filled={!!(profileForm.emergency_contact_name && profileForm.emergency_contact_phone)} />
                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Contact name</label>
                    <input value={profileForm.emergency_contact_name} onChange={e => setPF('emergency_contact_name', e.target.value)} placeholder="Jane Smith" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e8edf2', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Their number</label>
                    <input value={profileForm.emergency_contact_phone} onChange={e => setPF('emergency_contact_phone', e.target.value)} placeholder="07700900000" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e8edf2', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                  </div>
                </SectionCard>
                <SectionCard>
                  <SectionHead icon="ti-calendar-time" title="When I'm available" filled={(profileForm.availability||[]).length > 0} />
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => {
                      const on = profileForm.availability?.includes(d)
                      return <button key={d} onClick={() => toggleDay(d)} style={{ padding:'8px 14px', borderRadius:99, border:on?`2px solid ${primary}`:'1.5px solid #e8edf2', background:on?'#E8F7F9':'#fff', fontSize:12, fontWeight:700, color:on?'#085041':'#94a3b8', cursor:'pointer' }}>{d.slice(0,3)}</button>
                    })}
                  </div>
                </SectionCard>
                <SectionCard>
                  <SectionHead icon="ti-users-group" title="Age groups" filled={(profileForm.age_groups||[]).length > 0} />
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {['4-6','7-9','10-12','All ages'].map(a => {
                      const on = profileForm.age_groups?.includes(a)
                      return <button key={a} onClick={() => toggleAge(a)} style={{ padding:'8px 16px', borderRadius:99, border:on?'2px solid #F0A500':'1.5px solid #e8edf2', background:on?'#FFF8E6':'#fff', fontSize:12, fontWeight:700, color:on?'#B8860B':'#94a3b8', cursor:'pointer' }}>{a}</button>
                    })}
                  </div>
                </SectionCard>
                <SectionCard>
                  <SectionHead icon="ti-trophy" title="Skills & languages" filled={(profileForm.skills||[]).length > 0} />
                  <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Sports</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                    {SPORTS.map(s => { const on = (profileForm.skills||[]).includes(s); return <button key={s} onClick={() => toggleSkill(s)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:99, border:on?'2px solid #9B59B6':'1.5px solid #e8edf2', background:on?'#F5F0FF':'#fff', fontSize:12, fontWeight:700, color:on?'#9B59B6':'#94a3b8', cursor:'pointer' }}><i className={'ti '+(SPORT_ICONS[s]||'ti-star')} style={{ fontSize:12 }} />{s}</button> })}
                  </div>
                  <div style={{ fontSize:10, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Languages</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                    {LANGUAGES.map(l => { const on = (profileForm.skills||[]).includes(l); return <button key={l} onClick={() => toggleSkill(l)} style={{ padding:'6px 12px', borderRadius:99, border:on?`2px solid ${primary}`:'1.5px solid #e8edf2', background:on?'#E8F7F9':'#fff', fontSize:12, fontWeight:700, color:on?'#085041':'#94a3b8', cursor:'pointer' }}>{l}</button> })}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={customSkill} onChange={e => setCustomSkill(e.target.value)} placeholder="Add another skill..." onKeyDown={e => e.key==='Enter' && customSkill.trim() && (toggleSkill(customSkill.trim()), setCustomSkill(''))} style={{ flex:1, padding:'8px 12px', borderRadius:10, border:'1.5px solid #e8edf2', fontSize:13, outline:'none' }} />
                    <button onClick={() => { if (customSkill.trim()) { toggleSkill(customSkill.trim()); setCustomSkill('') } }} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'#9B59B6', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Add</button>
                  </div>
                </SectionCard>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginBottom:20 }}>
                  <button onClick={() => setEditMode(false)} style={{ padding:14, borderRadius:14, border:'1.5px solid #e8edf2', background:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', color:'#64748b' }}>Cancel</button>
                  <button onClick={saveProfile} disabled={saving||!profileForm.full_name?.trim()} style={{ padding:14, borderRadius:14, border:'none', background:primary, color:'#fff', fontSize:15, fontWeight:900, cursor:'pointer' }}>
                    {saving ? 'Saving...' : 'Save profile'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      </div>

      {/* BOTTOM NAV - mobile only */}
      {isMobile && <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #e8edf2', display:'flex', padding:'8px 0 env(safe-area-inset-bottom)', zIndex:100 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 0', border:'none', background:'transparent', cursor:'pointer' }}>
            <i className={'ti '+t.icon} style={{ fontSize:22, color:activeTab===t.key?primary:'#94a3b8' }} />
            <span style={{ fontSize:10, fontWeight:700, color:activeTab===t.key?primary:'#94a3b8' }}>{t.label}</span>
          </button>
        ))}
      </div>}
    </div>
  )
}
