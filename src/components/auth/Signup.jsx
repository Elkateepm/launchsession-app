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
    setMessage('Trial request received. We’ll contact you shortly to activate your LaunchSession workspace.')
  }

  return (
    <div style={page}>
      <div style={glowOne} />
      <div style={glowTwo} />
      <div style={orbital} />

      <div style={wrap}>
        <img src="/logo.png" alt="LaunchSession" style={logo} />

        <h1 style={title}>Start your free 7-day trial</h1>
        <p style={subtitle}>Request access to your LaunchSession workspace.</p>

        <form onSubmit={handleSignup} style={card}>
          <div style={iconCircle}>🚀</div>

          <h2 style={cardTitle}>Tell us about your organisation</h2>
          <p style={cardSub}>We’ll review your request and get back to you within 24 hours.</p>

          {error && <div style={errorBox}>{error}</div>}
          {message && <div style={successBox}>✅ {message}</div>}

          <label style={label}>Organisation name</label>
          <input required placeholder="Acme Youth Club" value={organisationName} onChange={e=>setOrganisationName(e.target.value)} style={inp} />

          <label style={label}>Your full name</label>
          <input required placeholder="Jane Smith" value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} />

          <label style={label}>Work email</label>
          <input required type="email" placeholder="jane@organisation.org" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />

          <button type="submit" disabled={loading || !!message} style={{...btn, opacity: loading || message ? 0.75 : 1}}>
            {loading ? 'Submitting...' : message ? 'Request Sent' : 'Start Free 7-Day Trial →'}
          </button>

          <div style={divider}><span>What happens next?</span></div>

          <div style={steps}>
            <div style={step}><b>1. We review</b><span>We check your organisation details.</span></div>
            <div style={step}><b>2. You get access</b><span>We create your workspace.</span></div>
            <div style={step}><b>3. Start building</b><span>Manage sessions and outcomes.</span></div>
          </div>
        </form>

        <button onClick={() => window.location.href='/landing.html'} style={backBtn}>← Back to LaunchSession</button>
        <p style={secure}>🔒 Your information is secure and never shared.</p>
      </div>
    </div>
  )
}

const page = { minHeight:'100vh', background:'radial-gradient(circle at top left, #2a144f 0%, #07111f 42%, #030711 100%)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 20px', position:'relative', overflow:'hidden' }
const glowOne = { position:'absolute', top:-180, left:-140, width:520, height:520, background:'radial-gradient(circle, rgba(168,85,247,0.28), transparent 65%)' }
const glowTwo = { position:'absolute', bottom:-220, right:-160, width:620, height:620, background:'radial-gradient(circle, rgba(37,99,235,0.34), transparent 65%)' }
const orbital = { position:'absolute', width:900, height:900, border:'1px solid rgba(255,255,255,0.06)', borderRadius:'50%', top:'8%', left:'50%', transform:'translateX(-50%)' }
const wrap = { width:'100%', maxWidth:760, position:'relative', zIndex:2, textAlign:'center' }
const logo = { width:150, height:'auto', objectFit:'contain', marginBottom:18 }
const title = { fontSize:'clamp(34px,5vw,54px)', lineHeight:1.05, margin:'0 0 12px', fontWeight:900, letterSpacing:-1.5 }
const subtitle = { margin:'0 0 36px', color:'rgba(255,255,255,0.72)', fontSize:18 }
const card = { textAlign:'left', background:'rgba(255,255,255,0.055)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:28, padding:36, boxShadow:'0 40px 120px rgba(0,0,0,0.45)', backdropFilter:'blur(18px)' }
const iconCircle = { width:74, height:74, borderRadius:999, background:'rgba(59,130,246,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, margin:'0 auto 22px' }
const cardTitle = { textAlign:'center', fontSize:26, margin:'0 0 8px', fontWeight:850 }
const cardSub = { textAlign:'center', color:'rgba(255,255,255,0.62)', margin:'0 0 28px', fontSize:15, lineHeight:1.6 }
const label = { display:'block', margin:'18px 0 8px', fontSize:13, fontWeight:800, color:'rgba(255,255,255,0.84)' }
const inp = { width:'100%', boxSizing:'border-box', padding:'17px 18px', borderRadius:14, border:'1px solid rgba(255,255,255,0.14)', background:'rgba(255,255,255,0.075)', color:'#fff', fontSize:15, outline:'none' }
const btn = { width:'100%', marginTop:26, padding:17, borderRadius:14, border:'none', background:'linear-gradient(135deg,#3b82f6,#4f46e5)', color:'#fff', fontWeight:900, fontSize:15, cursor:'pointer', boxShadow:'0 18px 48px rgba(59,130,246,0.32)' }
const divider = { display:'flex', alignItems:'center', justifyContent:'center', margin:'30px 0 22px', color:'rgba(255,255,255,0.42)', fontSize:13 }
const steps = { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }
const step = { background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:16, textAlign:'center', color:'rgba(255,255,255,0.68)', fontSize:13, lineHeight:1.5, display:'flex', flexDirection:'column', gap:8 }
const successBox = { background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)', color:'#86EFAC', borderRadius:14, padding:14, marginBottom:18, textAlign:'center', fontWeight:700 }
const errorBox = { background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', color:'#FCA5A5', borderRadius:14, padding:14, marginBottom:18, textAlign:'center', fontWeight:700 }
const backBtn = { marginTop:24, background:'transparent', border:'none', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:14 }
const secure = { marginTop:24, color:'rgba(255,255,255,0.5)', fontSize:14 }
