
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const SLUG = window.location.pathname.split('/volunteer/')[1]?.split('/')[0]

const INTERESTS = ['⚽ Football','🏀 Basketball','🎨 Arts & Crafts','🎮 Gaming','🎵 Music','🍳 Cooking','🏕 Trips','📚 Homework Club','🤝 Mentoring','🚌 Transport','🍽 Refreshments','📸 Photography','💻 IT']
const EXPERIENCE_OPTS = ['Youth work','Teaching','Coaching','First Aid','Safeguarding','Healthcare','Administration','Events','Fundraising']
const QUALIFICATIONS = ['DBS Certificate','First Aid','Safeguarding','Driving Licence','Food Hygiene','Minibus Permit']
const AGE_GROUPS = ['4–7','8–11','12–15','16+','Any']
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const TIMES = ['Morning','Afternoon','Evening']

const s = {
  wrap: { minHeight:'100vh', background:'linear-gradient(135deg,#0D1B2A 0%,#1B2A3B 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Inter,sans-serif' },
  card: { background:'#fff', borderRadius:24, width:'100%', maxWidth:480, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.3)' },
  head: (color) => ({ background:color||'#1B9AAA', padding:'28px 28px 20px', color:'#fff' }),
  body: { padding:'28px 28px 24px' },
  label: { fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, display:'block', marginBottom:6 },
  inp: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E5E7EB', fontSize:15, outline:'none', boxSizing:'border-box', marginBottom:14, fontFamily:'Inter,sans-serif' },
  btn: (color) => ({ width:'100%', padding:14, borderRadius:14, border:'none', background:color||'#1B9AAA', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', marginTop:8 }),
  back: { background:'none', border:'none', color:'rgba(255,255,255,0.6)', fontSize:13, cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4, marginBottom:12 },
  chip: (active,color) => ({ padding:'8px 14px', borderRadius:99, border:`1.5px solid ${active?(color||'#1B9AAA'):'#E5E7EB'}`, background:active?(color||'#1B9AAA')+'18':'#F9FAFB', color:active?(color||'#1B9AAA'):'#6B7280', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }),
  prog: (pct,color) => ({ height:3, background:'rgba(255,255,255,0.2)', borderRadius:2, marginTop:12, overflow:'hidden', children:null }),
}

function ProgressBar({ step, total, color }) {
  return (
    <div style={{ height:3, background:'rgba(255,255,255,0.2)', borderRadius:2, marginTop:12 }}>
      <div style={{ height:'100%', width:`${(step/total)*100}%`, background:'rgba(255,255,255,0.8)', borderRadius:2, transition:'width 0.4s ease' }} />
    </div>
  )
}

// ─── ONBOARDING WIZARD ───────────────────────────────────────────────────────
function OnboardingWizard({ user, org, onComplete }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const photoRef = useRef(null)
  const primary = org?.primary_color || '#1B9AAA'
  const TOTAL = 12

  const [f, setF] = useState({
    first_name:'', last_name:'', preferred_name:'', phone:'', date_of_birth:'',
    emergency_contact_name:'', emergency_contact_relationship:'', emergency_contact_phone:'',
    postcode:'', address:'', city:'',
    availability:{ days:[], times:[] },
    interests:[], experience:[], volunteered_before:null,
    qualifications:[],
    age_groups:[], group_size:'',
    medical_conditions:'', accessibility_requirements:'', dietary_requirements:'', languages:'',
    preferred_contact:'Email',
    notification_prefs:{ session_reminders:true, new_opportunities:true, announcements:true, mentoring_updates:true },
    agreements:{ volunteer_agreement:false, safeguarding_policy:false, privacy_policy:false, photo_consent:false },
    signature:'',
  })

  const set = (k,v) => setF(p => ({...p,[k]:v}))
  const tog = (k,v) => setF(p => ({...p,[k]: p[k].includes(v)?p[k].filter(x=>x!==v):[...p[k],v]}))
  const togAvail = (type,v) => setF(p => ({...p, availability:{...p.availability,[type]: p.availability[type].includes(v)?p.availability[type].filter(x=>x!==v):[...p.availability[type],v]}}))
  const togNotif = (k) => setF(p => ({...p, notification_prefs:{...p.notification_prefs,[k]:!p.notification_prefs[k]}}))
  const togAgree = (k) => setF(p => ({...p, agreements:{...p.agreements,[k]:!p.agreements[k]}}))

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]; if(!file) return
    setPhotoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    await supabase.storage.from('staff-photos').upload(path, file, { upsert:true })
    const { data } = supabase.storage.from('staff-photos').getPublicUrl(path)
    setPhotoUrl(data.publicUrl)
    setPhotoUploading(false)
  }

  async function finish() {
    setSaving(true)
    const full_name = `${f.first_name} ${f.last_name}`.trim()
    await supabase.from('user_profiles').update({
      first_name: f.first_name, last_name: f.last_name, full_name,
      preferred_name: f.preferred_name, phone: f.phone, date_of_birth: f.date_of_birth||null,
      photo_url: photoUrl,
      emergency_contact_name: f.emergency_contact_name,
      emergency_contact_relationship: f.emergency_contact_relationship,
      emergency_contact_phone: f.emergency_contact_phone,
      address: f.address, city: f.city, postcode: f.postcode,
      availability: f.availability, interests: f.interests, skills: f.interests,
      experience: f.experience, volunteered_before: f.volunteered_before,
      qualifications: f.qualifications, age_groups: f.age_groups, group_size: f.group_size,
      medical_conditions: f.medical_conditions, accessibility_requirements: f.accessibility_requirements,
      dietary_requirements: f.dietary_requirements,
      languages: f.languages ? f.languages.split(',').map(x=>x.trim()) : [],
      preferred_contact: f.preferred_contact, notification_prefs: f.notification_prefs,
      agreements: f.agreements, signature: f.signature, signed_at: new Date().toISOString(),
      profile_setup_complete: true, onboarding_step: 12,
    }).eq('id', user.id)
    setSaving(false)
    onComplete()
  }

  const steps = [
    // 0: Welcome
    <div key={0} style={s.body}>
      <div style={{ textAlign:'center', padding:'20px 0' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>👋</div>
        <div style={{ fontSize:24, fontWeight:900, color:'#111', marginBottom:10 }}>Welcome to {org?.name}!</div>
        <div style={{ fontSize:15, color:'#6B7280', lineHeight:1.6, marginBottom:28 }}>Thanks for joining. Let's get you set up so we can match you with the right sessions.<br/><br/>This takes about 2–3 minutes.</div>
        <button onClick={()=>setStep(1)} style={s.btn(primary)}>Let's get started →</button>
      </div>
    </div>,

    // 1: About You
    <div key={1} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>About You</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Tell us a bit about yourself</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div><label style={s.label}>First name *</label><input style={s.inp} value={f.first_name} onChange={e=>set('first_name',e.target.value)} placeholder="Sarah" /></div>
        <div><label style={s.label}>Last name *</label><input style={s.inp} value={f.last_name} onChange={e=>set('last_name',e.target.value)} placeholder="Jones" /></div>
      </div>
      <label style={s.label}>Preferred name (optional)</label>
      <input style={s.inp} value={f.preferred_name} onChange={e=>set('preferred_name',e.target.value)} placeholder="What should we call you?" />
      <label style={s.label}>Mobile number *</label>
      <input style={s.inp} value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="07700900000" type="tel" />
      <label style={s.label}>Date of birth</label>
      <input style={s.inp} value={f.date_of_birth} onChange={e=>set('date_of_birth',e.target.value)} type="date" />
      <label style={s.label}>Profile photo (optional)</label>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
        <div style={{ width:56, height:56, borderRadius:16, background:primary+'22', border:`2px solid ${primary}44`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {photoUrl ? <img src={photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:22 }}>📷</span>}
        </div>
        <button onClick={()=>photoRef.current?.click()} style={{ padding:'8px 16px', borderRadius:10, border:`1.5px solid ${primary}`, background:'transparent', color:primary, fontSize:13, fontWeight:700, cursor:'pointer' }}>{photoUploading?'Uploading...':'Upload photo'}</button>
        <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={uploadPhoto} />
      </div>
      <button onClick={()=>setStep(2)} disabled={!f.first_name.trim()||!f.last_name.trim()||!f.phone.trim()} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 2: Emergency Contact
    <div key={2} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Emergency Contact</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Essential for safeguarding — who should we contact in an emergency?</div>
      <label style={s.label}>Contact name *</label>
      <input style={s.inp} value={f.emergency_contact_name} onChange={e=>set('emergency_contact_name',e.target.value)} placeholder="Jane Jones" />
      <label style={s.label}>Relationship</label>
      <input style={s.inp} value={f.emergency_contact_relationship} onChange={e=>set('emergency_contact_relationship',e.target.value)} placeholder="e.g. Partner, Parent, Sibling" />
      <label style={s.label}>Phone number *</label>
      <input style={s.inp} value={f.emergency_contact_phone} onChange={e=>set('emergency_contact_phone',e.target.value)} placeholder="07700900000" type="tel" />
      <button onClick={()=>setStep(3)} disabled={!f.emergency_contact_name.trim()||!f.emergency_contact_phone.trim()} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 3: Address
    <div key={3} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Your Address</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Useful for trips and emergencies</div>
      <label style={s.label}>Postcode</label>
      <input style={s.inp} value={f.postcode} onChange={e=>set('postcode',e.target.value)} placeholder="SW1A 1AA" />
      <label style={s.label}>Address</label>
      <input style={s.inp} value={f.address} onChange={e=>set('address',e.target.value)} placeholder="123 High Street" />
      <label style={s.label}>City</label>
      <input style={s.inp} value={f.city} onChange={e=>set('city',e.target.value)} placeholder="London" />
      <button onClick={()=>setStep(4)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 4: Availability
    <div key={4} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Your Availability</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>When are you usually free to volunteer?</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Days</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {DAYS.map(d=><button key={d} onClick={()=>togAvail('days',d)} style={s.chip(f.availability.days.includes(d),primary)}>{d}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Times</div>
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {TIMES.map(t=><button key={t} onClick={()=>togAvail('times',t)} style={s.chip(f.availability.times.includes(t),primary)}>{t}</button>)}
      </div>
      <button onClick={()=>setStep(5)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 5: Interests
    <div key={5} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Your Interests</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>What would you enjoy helping with?</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {INTERESTS.map(i=><button key={i} onClick={()=>tog('interests',i)} style={s.chip(f.interests.includes(i),primary)}>{i}</button>)}
      </div>
      <button onClick={()=>setStep(6)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 6: Experience
    <div key={6} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Your Experience</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Have you volunteered before?</div>
      <div style={{ display:'flex', gap:10, marginBottom:18 }}>
        {['Yes','No'].map(v=><button key={v} onClick={()=>set('volunteered_before',v==='Yes')} style={{ ...s.chip(f.volunteered_before===(v==='Yes'),primary), flex:1, textAlign:'center' }}>{v}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Relevant experience</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {EXPERIENCE_OPTS.map(e=><button key={e} onClick={()=>tog('experience',e)} style={s.chip(f.experience.includes(e),primary)}>{e}</button>)}
      </div>
      <button onClick={()=>setStep(7)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 7: Qualifications
    <div key={7} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Qualifications</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Select any you currently hold — you can upload documents later</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
        {QUALIFICATIONS.map(q=>(
          <label key={q} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:`1.5px solid ${f.qualifications.includes(q)?primary:'#E5E7EB'}`, background:f.qualifications.includes(q)?primary+'08':'#F9FAFB', cursor:'pointer' }}>
            <input type="checkbox" checked={f.qualifications.includes(q)} onChange={()=>tog('qualifications',q)} style={{ accentColor:primary, width:16, height:16 }} />
            <span style={{ fontSize:14, fontWeight:600, color:'#111' }}>{q}</span>
          </label>
        ))}
      </div>
      <button onClick={()=>setStep(8)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 8: Working Preferences
    <div key={8} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Working Preferences</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>What would you like to help with?</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Age groups</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {AGE_GROUPS.map(a=><button key={a} onClick={()=>tog('age_groups',a)} style={s.chip(f.age_groups.includes(a),primary)}>{a}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Group size</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
        {['One-to-one','Small groups','Large groups','Happy with anything'].map(g=>(
          <button key={g} onClick={()=>set('group_size',g)} style={{ ...s.chip(f.group_size===g,primary), textAlign:'left' }}>{g}</button>
        ))}
      </div>
      <button onClick={()=>setStep(9)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 9: Health & Accessibility
    <div key={9} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Health & Accessibility</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>All fields are optional — only share what you are comfortable with</div>
      <label style={s.label}>Medical conditions</label>
      <textarea style={{ ...s.inp, height:72, resize:'none' }} value={f.medical_conditions} onChange={e=>set('medical_conditions',e.target.value)} placeholder="e.g. Asthma, diabetes..." />
      <label style={s.label}>Accessibility requirements</label>
      <textarea style={{ ...s.inp, height:72, resize:'none' }} value={f.accessibility_requirements} onChange={e=>set('accessibility_requirements',e.target.value)} placeholder="e.g. Wheelchair access needed..." />
      <label style={s.label}>Dietary requirements</label>
      <input style={s.inp} value={f.dietary_requirements} onChange={e=>set('dietary_requirements',e.target.value)} placeholder="e.g. Vegetarian, halal..." />
      <label style={s.label}>Languages spoken</label>
      <input style={s.inp} value={f.languages} onChange={e=>set('languages',e.target.value)} placeholder="e.g. English, Urdu, French" />
      <button onClick={()=>setStep(10)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 10: Communication
    <div key={10} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Communication</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>How would you like to hear from us?</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Preferred contact</div>
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {['Email','SMS','WhatsApp'].map(c=><button key={c} onClick={()=>set('preferred_contact',c)} style={{ ...s.chip(f.preferred_contact===c,primary), flex:1, textAlign:'center' }}>{c}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Notifications</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
        {[['session_reminders','Session reminders'],['new_opportunities','New opportunities'],['announcements','Announcements'],['mentoring_updates','Mentoring updates']].map(([k,label])=>(
          <label key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E5E7EB', background:'#F9FAFB', cursor:'pointer' }}>
            <span style={{ fontSize:14, fontWeight:600, color:'#111' }}>{label}</span>
            <input type="checkbox" checked={f.notification_prefs[k]} onChange={()=>togNotif(k)} style={{ accentColor:primary, width:16, height:16 }} />
          </label>
        ))}
      </div>
      <button onClick={()=>setStep(11)} style={s.btn(primary)}>Continue →</button>
    </div>,

    // 11: Agreements
    <div key={11} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'#111', marginBottom:4 }}>Agreements</div>
      <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Please read and agree to the following</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
        {[['volunteer_agreement','Volunteer agreement'],['safeguarding_policy','Safeguarding policy'],['privacy_policy','Privacy policy'],['photo_consent','Photo consent']].map(([k,label])=>(
          <label key={k} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:`1.5px solid ${f.agreements[k]?primary:'#E5E7EB'}`, background:f.agreements[k]?primary+'08':'#F9FAFB', cursor:'pointer' }}>
            <input type="checkbox" checked={f.agreements[k]} onChange={()=>togAgree(k)} style={{ accentColor:primary, width:16, height:16 }} />
            <span style={{ fontSize:14, fontWeight:600, color:'#111' }}>{label}</span>
          </label>
        ))}
      </div>
      <label style={s.label}>Electronic signature</label>
      <input style={s.inp} value={f.signature} onChange={e=>set('signature',e.target.value)} placeholder="Type your full name to sign" />
      <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:14 }}>Date: {new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
      <button onClick={finish} disabled={saving||!f.agreements.volunteer_agreement||!f.agreements.safeguarding_policy||!f.agreements.privacy_policy||!f.signature.trim()} style={s.btn(primary)}>{saving?'Saving...':'Complete setup →'}</button>
    </div>,
  ]

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={{ background:primary, padding:'22px 28px 18px', color:'#fff', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }} />
          {/* Logo row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, position:'relative', zIndex:1 }}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.name} style={{ height:28, maxWidth:120, objectFit:'contain', filter:'brightness(0) invert(1)', opacity:0.9 }} />
            ) : (
              <span style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:0.8 }}>{org?.name}</span>
            )}
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.55)' }}>{step === 0 ? 'Volunteer Setup' : `Step ${step} of ${TOTAL - 1}`}</span>
          </div>
          {step > 0 && <button onClick={()=>setStep(s=>s-1)} style={s.back}>← Back</button>}
          <div style={{ fontSize:20, fontWeight:900, position:'relative', zIndex:1 }}>
            {['Welcome','About You','Emergency Contact','Your Address','Availability','Interests','Experience','Qualifications','Preferences','Health','Communication','Agreements'][step]}
          </div>
          {step > 0 && <ProgressBar step={step} total={TOTAL - 1} color={primary} />}
        </div>
        {steps[step]}
      </div>
    </div>
  )
}

// ─── MAIN PORTAL ─────────────────────────────────────────────────────────────
export default function VolunteerPortal() {
  const [org, setOrg] = useState(null)
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('loading')
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    supabase.from('organisations').select('*').eq('slug', SLUG).single().then(({data}) => setOrg(data))
    supabase.auth.getSession().then(({data:{session}}) => { setAuthUser(session?.user||null); if(!session) setView('login') })
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e,s) => setAuthUser(s?.user||null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if(authUser && org) validateAndLoad() }, [authUser, org]) // eslint-disable-line react-hooks/exhaustive-deps

  async function validateAndLoad() {
    setView('loading')
    const {data:p} = await supabase.from('user_profiles').select('*').eq('id',authUser.id).eq('org_id',org.id).single()
    if(!p) {
      const {data:any} = await supabase.from('user_profiles').select('role').eq('id',authUser.id).eq('org_id',org.id).single()
      if(any && any.role !== 'volunteer') { window.location.replace('/'); return }
      await supabase.auth.signOut(); setAuthUser(null); setView('login')
      setError('No volunteer account found for this organisation.'); return
    }
    if(p.role !== 'volunteer') { window.location.replace('/'); return }
    if(p.status === 'pending') { setProfile(p); setView('pending'); return }
    if(p.status === 'rejected') { setProfile(p); setView('rejected'); return }
    setProfile(p)
    if(!p.profile_setup_complete) { setView('onboarding'); return }
    setView('dashboard')
  }

  async function handleAuth(e) {
    e.preventDefault(); setAuthLoading(true); setError('')
    if(isRegister) {
      const {data,error:err} = await supabase.auth.signUp({email,password})
      if(err){setError(err.message);setAuthLoading(false);return}
      if(data.user) {
        await supabase.from('user_profiles').insert({ id:data.user.id, email, org_id:org.id, role:'volunteer', status:'pending', full_name:email.split('@')[0] })
        setView('pending')
      }
    } else {
      const {error:err} = await supabase.auth.signInWithPassword({email,password})
      if(err){setError(err.message);setAuthLoading(false);return}
    }
    setAuthLoading(false)
  }

  if(view==='loading') return (
    <div style={{ minHeight:'100vh', background:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:`3px solid ${primary}`, borderTop:'3px solid transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if(view==='onboarding') return <OnboardingWizard user={authUser} org={org} onComplete={()=>{ validateAndLoad() }} />

  if(view==='pending') return (
    <div style={s.wrap}>
      <div style={{ ...s.card, textAlign:'center' }}>
        <div style={s.head(primary)}><div style={{ fontSize:32 }}>⏳</div><div style={{ fontSize:20, fontWeight:900, marginTop:8 }}>Pending Approval</div></div>
        <div style={s.body}>
          <p style={{ color:'#6B7280', lineHeight:1.6, marginBottom:20 }}>Your application has been received. A staff member will review and approve your account shortly.</p>
          <button onClick={()=>supabase.auth.signOut().then(()=>setView('login'))} style={{ ...s.btn('#6B7280'), marginTop:0 }}>Sign out</button>
        </div>
      </div>
    </div>
  )

  if(view==='rejected') return (
    <div style={s.wrap}>
      <div style={{ ...s.card, textAlign:'center' }}>
        <div style={s.head('#EF4444')}><div style={{ fontSize:32 }}>❌</div><div style={{ fontSize:20, fontWeight:900, marginTop:8 }}>Application Unsuccessful</div></div>
        <div style={s.body}>
          <p style={{ color:'#6B7280', lineHeight:1.6, marginBottom:20 }}>Unfortunately your volunteer application was not approved. Please contact {org?.name} for more information.</p>
          <button onClick={()=>supabase.auth.signOut().then(()=>setView('login'))} style={{ ...s.btn('#6B7280'), marginTop:0 }}>Sign out</button>
        </div>
      </div>
    </div>
  )

  if(view==='login') return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={{ background: primary, padding:'28px 28px 22px', color:'#fff', position:'relative', overflow:'hidden' }}>
          {/* subtle background glow */}
          <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-30, left:-20, width:100, height:100, borderRadius:'50%', background:'rgba(0,0,0,0.08)', pointerEvents:'none' }} />
          {/* Org logo or name */}
          <div style={{ position:'relative', zIndex:1, marginBottom:16 }}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.name} style={{ height:40, maxWidth:160, objectFit:'contain', display:'block', filter:'brightness(0) invert(1)', opacity:0.92 }} />
            ) : (
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'6px 12px' }}>
                <div style={{ width:26, height:26, borderRadius:7, background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900 }}>
                  {(org?.name||'L')[0].toUpperCase()}
                </div>
                <span style={{ fontSize:13, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase' }}>{org?.name || 'LaunchSession'}</span>
              </div>
            )}
          </div>
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>{isRegister ? 'Join as Volunteer' : 'Volunteer Sign In'}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>{isRegister ? 'Create your volunteer account' : 'Welcome back'}</div>
          </div>
        </div>
        <div style={s.body}>
          {error && <div style={{ background:'#FFF0F0', border:'1px solid #FFD0D0', color:'#C00', borderRadius:10, padding:'10px 14px', fontSize:13, marginBottom:16, fontWeight:600 }}>{error}</div>}
          <form onSubmit={handleAuth}>
            <label style={s.label}>Email address</label>
            <input style={s.inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" required autoFocus />
            <label style={s.label}>Password</label>
            <input style={s.inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
            <button type="submit" disabled={authLoading} style={s.btn(primary)}>{authLoading?(isRegister?'Creating account...':'Signing in...'):(isRegister?'Create account →':'Sign in →')}</button>
          </form>
          <div style={{ textAlign:'center', marginTop:16 }}>
            <button onClick={()=>{setIsRegister(r=>!r);setError('')}} style={{ background:'none', border:'none', color:primary, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {isRegister?'Already have an account? Sign in':'New volunteer? Register here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Dashboard placeholder — existing dashboard code goes here
  return (
    <div style={{ minHeight:'100vh', background:'#0D1B2A', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
      <div>Dashboard for {profile?.full_name} — coming next</div>
    </div>
  )
}
