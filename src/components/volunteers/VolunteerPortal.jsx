
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useRealtimeTable } from '../../lib/useRealtimeTable'

const SLUG = window.location.pathname.split('/volunteer/')[1]?.split('/')[0]

const INTERESTS = ['⚽ Football','🏀 Basketball','🎨 Arts & Crafts','🎮 Gaming','🎵 Music','🍳 Cooking','🏕 Trips','📚 Homework Club','🤝 Mentoring','🚌 Transport','🍽 Refreshments','📸 Photography','💻 IT']
const EXPERIENCE_OPTS = ['Youth work','Teaching','Coaching','First Aid','Safeguarding','Healthcare','Administration','Events','Fundraising']
const QUALIFICATIONS = ['DBS Certificate','First Aid','Safeguarding','Driving Licence','Food Hygiene','Minibus Permit']
const AGE_GROUPS = ['4–7','8–11','12–15','16+','Any']
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const TIMES = ['Morning','Afternoon','Evening']

const s = {
  wrap: { minHeight:'100vh', background:'radial-gradient(circle at 15% 10%, #16283d 0%, #0A121D 45%, #060a11 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Inter,sans-serif', position:'relative', overflow:'hidden' },
  card: { background:'#fff', borderRadius:28, width:'100%', maxWidth:480, overflow:'hidden', boxShadow:'0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)', position:'relative', zIndex:1 },
  head: (color) => ({ background:`linear-gradient(135deg, ${color||'#1B9AAA'}, ${color||'#1B9AAA'}dd)`, padding:'28px 28px 20px', color:'#fff', position:'relative', overflow:'hidden' }),
  body: { padding:'28px 28px 24px' },
  label: { fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.6, display:'block', marginBottom:6 },
  inp: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E5E7EB', fontSize:15, outline:'none', boxSizing:'border-box', marginBottom:14, fontFamily:'Inter,sans-serif', transition:'border-color 0.15s, box-shadow 0.15s' },
  btn: (color) => ({ width:'100%', padding:14, borderRadius:14, border:'none', background:`linear-gradient(135deg, ${color||'#1B9AAA'}, ${color||'#1B9AAA'}cc)`, color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', marginTop:8, boxShadow:`0 8px 24px ${color||'#1B9AAA'}55` }),
  back: { background:'none', border:'none', color:'rgba(255,255,255,0.6)', fontSize:13, cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4, marginBottom:12 },
  chip: (active,color) => ({ padding:'8px 14px', borderRadius:99, border:`1.5px solid ${active?(color||'#1B9AAA'):'#E5E7EB'}`, background:active?(color||'#1B9AAA')+'18':'#F9FAFB', color:active?(color||'#1B9AAA'):'#6B7280', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }),
  prog: (pct,color) => ({ height:3, background:'rgba(255,255,255,0.2)', borderRadius:2, marginTop:12, overflow:'hidden', children:null }),
}

// Ambient floating gradient orbs used behind auth/onboarding cards — purely decorative
function AmbientOrbs({ color }) {
  return (
    <>
      <motion.div
        animate={{ y:[0,-18,0], x:[0,10,0] }}
        transition={{ duration:9, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', top:'8%', left:'8%', width:220, height:220, borderRadius:'50%', background:`${color||'#1B9AAA'}22`, filter:'blur(50px)', pointerEvents:'none' }}
      />
      <motion.div
        animate={{ y:[0,16,0], x:[0,-12,0] }}
        transition={{ duration:11, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', bottom:'10%', right:'10%', width:260, height:260, borderRadius:'50%', background:'rgba(99,102,241,0.14)', filter:'blur(60px)', pointerEvents:'none' }}
      />
    </>
  )
}

function ProgressBar({ step, total, color }) {
  return (
    <div style={{ height:4, background:'rgba(255,255,255,0.2)', borderRadius:2, marginTop:12, overflow:'hidden' }}>
      <motion.div
        initial={false}
        animate={{ width:`${(step/total)*100}%` }}
        transition={{ type:'spring', stiffness:120, damping:20 }}
        style={{ height:'100%', background:'#fff', borderRadius:2 }}
      />
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
      <AmbientOrbs color={primary} />
      <motion.div
        initial={{ opacity:0, y:16, scale:0.98 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ duration:0.35, ease:'easeOut' }}
        style={s.card}
      >
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
          {step > 0 && <motion.button whileTap={{ scale:0.95 }} onClick={()=>setStep(s=>s-1)} style={s.back}>← Back</motion.button>}
          <div style={{ fontSize:20, fontWeight:900, position:'relative', zIndex:1 }}>
            {['Welcome','About You','Emergency Contact','Your Address','Availability','Interests','Experience','Qualifications','Preferences','Health','Communication','Agreements'][step]}
          </div>
          {step > 0 && <ProgressBar step={step} total={TOTAL - 1} color={primary} />}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity:0, x:16 }}
            animate={{ opacity:1, x:0 }}
            exit={{ opacity:0, x:-16 }}
            transition={{ duration:0.22, ease:'easeOut' }}
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </motion.div>
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
    const {error:err} = await supabase.auth.signInWithPassword({email,password})
    if(err){setError(err.message);setAuthLoading(false);return}
    setAuthLoading(false)
  }

  if(view==='loading') return (
    <div style={{ minHeight:'100vh', background:'radial-gradient(circle at 15% 10%, #16283d 0%, #0A121D 45%, #060a11 100%)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <motion.div
        animate={{ rotate:360 }}
        transition={{ duration:0.8, repeat:Infinity, ease:'linear' }}
        style={{ width:36, height:36, border:`3px solid ${primary}`, borderTop:'3px solid transparent', borderRadius:'50%' }}
      />
    </div>
  )

  if(view==='onboarding') return <OnboardingWizard user={authUser} org={org} onComplete={()=>{ validateAndLoad() }} />

  if(view==='pending') return (
    <div style={s.wrap}>
      <AmbientOrbs color={primary} />
      <motion.div initial={{ opacity:0, y:16, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.35 }} style={{ ...s.card, textAlign:'center' }}>
        <div style={s.head(primary)}><div style={{ fontSize:32 }}>⏳</div><div style={{ fontSize:20, fontWeight:900, marginTop:8 }}>Pending Approval</div></div>
        <div style={s.body}>
          <p style={{ color:'#6B7280', lineHeight:1.6, marginBottom:20 }}>Your application has been received. A staff member will review and approve your account shortly.</p>
          <motion.button whileTap={{ scale:0.97 }} onClick={()=>supabase.auth.signOut().then(()=>setView('login'))} style={{ ...s.btn('#6B7280'), marginTop:0 }}>Sign out</motion.button>
        </div>
      </motion.div>
    </div>
  )

  if(view==='rejected') return (
    <div style={s.wrap}>
      <AmbientOrbs color="#EF4444" />
      <motion.div initial={{ opacity:0, y:16, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.35 }} style={{ ...s.card, textAlign:'center' }}>
        <div style={s.head('#EF4444')}><div style={{ fontSize:32 }}>❌</div><div style={{ fontSize:20, fontWeight:900, marginTop:8 }}>Application Unsuccessful</div></div>
        <div style={s.body}>
          <p style={{ color:'#6B7280', lineHeight:1.6, marginBottom:20 }}>Unfortunately your volunteer application was not approved. Please contact {org?.name} for more information.</p>
          <motion.button whileTap={{ scale:0.97 }} onClick={()=>supabase.auth.signOut().then(()=>setView('login'))} style={{ ...s.btn('#6B7280'), marginTop:0 }}>Sign out</motion.button>
        </div>
      </motion.div>
    </div>
  )

  if(view==='login') return (
    <div style={s.wrap}>
      <AmbientOrbs color={primary} />
      <motion.div initial={{ opacity:0, y:16, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.35, ease:'easeOut' }} style={s.card}>
        <div style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, padding:'28px 28px 22px', color:'#fff', position:'relative', overflow:'hidden' }}>
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
            <div style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>Volunteer Sign In</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>Welcome back</div>
          </div>
        </div>
        <div style={s.body}>
          {error && <div style={{ background:'#FFF0F0', border:'1px solid #FFD0D0', color:'#C00', borderRadius:10, padding:'10px 14px', fontSize:13, marginBottom:16, fontWeight:600 }}>{error}</div>}
          <form onSubmit={handleAuth}>
            <label style={s.label}>Email address</label>
            <input style={s.inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" required autoFocus />
            <label style={s.label}>Password</label>
            <input style={s.inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
            <motion.button whileTap={{ scale:0.97 }} type="submit" disabled={authLoading} style={s.btn(primary)}>{authLoading?'Signing in...':'Sign in →'}</motion.button>
          </form>
          <div style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#9CA3AF', lineHeight:1.5 }}>
            New volunteer? Ask {org?.name || 'your organisation'} to send you an invite.
          </div>
        </div>
      </motion.div>
    </div>
  )

  return <VolunteerDashboard user={authUser} profile={profile} org={org} onSignOut={() => supabase.auth.signOut().then(() => { setAuthUser(null); setView('login') })} />
}

// ─── VOLUNTEER DASHBOARD ──────────────────────────────────────────────────────
function VolunteerDashboard({ user, profile, org, onSignOut }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [tab, setTab] = useState('today')
  const [sessions, setSessions] = useState([])
  const [myRota, setMyRota] = useState([])
  const [myBookings, setMyBookings] = useState({}) // session_id -> status
  const [attendance, setAttendance] = useState([])
  const [volunteerCounts, setVolunteerCounts] = useState({})
  const [saving, setSaving] = useState(null)
  const [showCFC, setShowCFC] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) : ''

  async function loadData() {
    if (!org?.id || !user?.id) return
    const [{ data: sess }, { data: rota }, { data: att }] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id', org.id).gte('session_date', today).order('session_date').order('start_time').limit(30),
      supabase.from('session_staff').select('*, session:sessions(*)').eq('org_id', org.id).eq('user_id', user.id).order('created_at'),
      supabase.from('session_staff').select('session_id').eq('org_id', org.id),
    ])
    setSessions(sess || [])
    setMyRota((rota || []).sort((a,b) => (a.session?.session_date||'').localeCompare(b.session?.session_date||'')))
    // Build my bookings map
    const bmap = {}
    ;(rota || []).forEach(r => { bmap[r.session_id] = r.status || 'pending' })
    setMyBookings(bmap)
    // Volunteer counts per session
    const counts = {}
    ;(att || []).forEach(r => { counts[r.session_id] = (counts[r.session_id]||0)+1 })
    setVolunteerCounts(counts)
    // My attendance/hours
    const { data: myAtt } = await supabase.from('volunteer_attendance').select('*').eq('volunteer_id', user.id).eq('org_id', org.id).order('created_at', { ascending:false })
    setAttendance(myAtt || [])
  }

  useEffect(() => {
    loadData()
  }, [org?.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useRealtimeTable('sessions', loadData, { filter: org?.id ? `org_id=eq.${org.id}` : undefined, enabled: !!org?.id, pollInterval: 6000 })
  useRealtimeTable('session_staff', loadData, { filter: org?.id ? `org_id=eq.${org.id}` : undefined, enabled: !!org?.id, pollInterval: 6000 })
  useRealtimeTable('volunteer_attendance', loadData, { filter: org?.id ? `org_id=eq.${org.id}` : undefined, enabled: !!org?.id, pollInterval: 6000 })

  async function handleBook(session) {
    setSaving(session.id)
    const booked = myBookings[session.id]
    if (booked) {
      await supabase.from('session_staff').delete().eq('session_id', session.id).eq('user_id', user.id).eq('org_id', org.id)
      setMyBookings(p => { const n={...p}; delete n[session.id]; return n })
    } else {
      await supabase.from('session_staff').insert({ session_id:session.id, user_id:user.id, org_id:org.id, role:'volunteer', status:'pending' })
      setMyBookings(p => ({ ...p, [session.id]:'pending' }))
    }
    setSaving(null)
    loadData()
  }

  const totalHours = attendance.reduce((s,a) => s+(a.hours_logged||0), 0)
  const completedSessions = attendance.filter(a => a.signed_out_at).length
  const upcomingRota = myRota.filter(r => (r.session?.session_date||'') >= today)
  const pastRota = myRota.filter(r => (r.session?.session_date||'') < today)
  const todaySessions = sessions.filter(s => s.session_date === today)
  const futureSessions = sessions.filter(s => s.session_date > today)

  const tier = totalHours >= 100 ? 'Champion' : totalHours >= 50 ? 'Gold' : totalHours >= 25 ? 'Silver' : 'Green'
  const tierColor = totalHours >= 100 ? '#F5D000' : totalHours >= 50 ? '#F0A500' : totalHours >= 25 ? '#C0C0C0' : '#4ADE80'
  const nextTier = totalHours >= 100 ? 100 : totalHours >= 50 ? 100 : totalHours >= 25 ? 50 : 25
  const nextTierName = totalHours >= 50 ? 'Champion' : totalHours >= 25 ? 'Gold' : 'Silver'
  const progress = Math.min((totalHours / nextTier) * 100, 100)

  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'there'
  const initials = (profile?.full_name || '?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  const NAV = [
    { key:'today',   icon:'🏠', label:'Today' },
    { key:'book',    icon:'📅', label:'Book' },
    { key:'rota',    icon:'📋', label:'My Rota' },
    { key:'impact',  icon:'⭐', label:'Impact' },
    { key:'profile', icon:'👤', label:'Profile' },
  ]

  return (
    <div style={{ height:'100%', background:'#F5F5F5', display:'flex', flexDirection:'column', fontFamily:'Inter,sans-serif', paddingTop:'env(safe-area-inset-top)', overflow:'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{ background:'linear-gradient(160deg, #0D1B2A 0%, #14263a 100%)', padding:'12px 18px 0', position:'relative', overflow:'hidden', flexShrink:0 }}>
        <motion.div
          animate={{ y:[0,-14,0], x:[0,8,0] }}
          transition={{ duration:8, repeat:Infinity, ease:'easeInOut' }}
          style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:primary+'20', filter:'blur(2px)' }}
        />
        <motion.div
          animate={{ y:[0,10,0], x:[0,-6,0] }}
          transition={{ duration:10, repeat:Infinity, ease:'easeInOut' }}
          style={{ position:'absolute', bottom:20, left:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}
        />
        <div style={{ position:'relative', zIndex:1 }}>
          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            {org?.logo_url && !imgFailed
              ? <img src={org.logo_url} alt={org.name} style={{ height:24, objectFit:'contain', filter:'brightness(0) invert(1)', opacity:0.85 }} onError={()=>setImgFailed(true)} />
              : <span style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1 }}>{org?.name}</span>
            }
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <motion.div whileTap={{ scale:0.92 }} onClick={()=>setTab('profile')} style={{ width:36, height:36, borderRadius:'50%', background:profile?.photo_url?'transparent':primary, border:'2px solid rgba(255,255,255,0.2)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:12, fontWeight:900, color:'#fff' }}>{initials}</span>}
              </motion.div>
              <motion.button whileTap={{ scale:0.95 }} onClick={onSignOut} style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.45)', background:'transparent', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:'5px 12px', cursor:'pointer' }}>Sign out</motion.button>
            </div>
          </div>
          {/* Greeting */}
          <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }} style={{ marginBottom:6 }}>
            <div style={{ fontSize:22, fontWeight:900, color:'#fff', lineHeight:1.1, marginBottom:6 }}>{greeting}, {firstName}! 👋</div>
            <div style={{ fontSize:12, color:primary, fontWeight:700, marginBottom:12 }}>Welcome to {org?.name}</div>
          </motion.div>
          {/* Stats strip */}
          <div style={{ display:'flex', gap:0, margin:'0 -18px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            {[
              { val: todaySessions.length, label:'Today', color:'#F5D000' },
              { val: upcomingRota.length, label:'Booked', color:'#fff' },
              { val: totalHours.toFixed(1), label:'Hours', color:primary },
            ].map((stat,i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity:0, y:8 }}
                animate={{ opacity:1, y:0 }}
                transition={{ duration:0.3, delay:i*0.05 }}
                style={{ flex:1, padding:'12px 0', textAlign:'center', borderRight: i<2?'1px solid rgba(255,255,255,0.07)':'none' }}
              >
                <div style={{ fontSize:18, fontWeight:900, color:stat.color, lineHeight:1 }}>{stat.val}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:0.5, marginTop:4 }}>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'16px 16px 110px' }}>
      <AnimatePresence mode="wait">
      <motion.div key={tab} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.2, ease:'easeOut' }}>

        {/* TODAY TAB */}
        {tab === 'today' && (
          <div>
            {/* Safeguarding */}
            <div style={{ background:'#FFF5F5', borderRadius:14, border:'1.5px solid #FFB3B3', padding:'12px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>🛡️</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#C00', marginBottom:1 }}>Safeguarding</div>
                <div style={{ fontSize:11, color:'#C00', fontWeight:600, opacity:0.8 }}>Report any concerns to the DSL immediately.</div>
              </div>
              <motion.button whileTap={{ scale:0.95 }} onClick={()=>setShowCFC(true)} style={{ background:'#C00', color:'#fff', border:'none', borderRadius:9, padding:'7px 12px', fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>Raise Concern</motion.button>
            </div>

            {/* Upcoming from rota */}
            {upcomingRota.slice(0,3).length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>Coming Up</div>
                {upcomingRota.slice(0,3).map(r => {
                  const isToday = r.session?.session_date === today
                  return (
                    <div key={r.id} style={{ background: isToday?`linear-gradient(135deg,${primary},#0F6E56)`:'#fff', borderRadius:14, border: isToday?'none':'1.5px solid #E5E7EB', padding:'13px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:11, background: isToday?'rgba(255,255,255,0.2)':primary+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>📅</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:800, color: isToday?'#fff':'#111', marginBottom:2 }}>{r.session?.title}</div>
                        <div style={{ fontSize:11, fontWeight:600, color: isToday?'rgba(255,255,255,0.7)':'#6B7280' }}>
                          {isToday?'Today':fmt(r.session?.session_date)}{r.session?.start_time?` · ${r.session.start_time}`:''}
                        </div>
                      </div>
                      {isToday && <span style={{ background:'rgba(255,255,255,0.2)', color:'#fff', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:800 }}>Today!</span>}
                      {!isToday && <span style={{ background: r.status==='confirmed'?'#DCFCE7':'#FEF9C3', color: r.status==='confirmed'?'#16A34A':'#92400E', borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:800 }}>{r.status==='confirmed'?'Confirmed':'Pending'}</span>}
                    </div>
                  )
                })}
                {upcomingRota.length > 3 && <button onClick={()=>setTab('rota')} style={{ width:'100%', padding:8, borderRadius:10, border:`1.5px solid ${primary}40`, background:primary+'10', fontSize:12, fontWeight:700, color:primary, cursor:'pointer' }}>View all {upcomingRota.length} sessions →</button>}
              </div>
            )}

            {/* Impact stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
              {[
                { val:totalHours.toFixed(1), label:'Hours given', color:'#F5D000', bg:'#0D1B2A' },
                { val:completedSessions, label:'Sessions done', color:'#fff', bg:primary },
                { val:Math.round(totalHours*2), label:'Young people', color:'#F5D000', bg:'#2D1B69' },
                { val:tier, label:'My tier', color:tierColor, bg:'#1A3A1A' },
              ].map(s => (
                <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:'12px 14px' }}>
                  <div style={{ fontSize:22, fontWeight:900, color:s.color, lineHeight:1, marginBottom:3 }}>{s.val}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Today's sessions */}
            <div style={{ fontSize:12, fontWeight:800, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>Today's Sessions</div>
            {todaySessions.length === 0 ? (
              <div style={{ background:'#0D1B2A', borderRadius:18, padding:'28px 20px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>⭐</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff', marginBottom:6 }}>Rest day!</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', fontWeight:600, marginBottom:16 }}>No sessions today — enjoy the break.</div>
                <motion.button whileTap={{ scale:0.97 }} onClick={()=>setTab('book')} style={{ padding:'10px 20px', borderRadius:10, border:'none', background:primary, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer' }}>Browse upcoming sessions →</motion.button>
              </div>
            ) : todaySessions.map(s => (
              <div key={s.id} style={{ background:'#fff', borderRadius:16, border:'1.5px solid #E5E7EB', padding:'14px', marginBottom:10, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, width:4, height:'100%', background:primary, borderRadius:'4px 0 0 4px' }} />
                <div style={{ paddingLeft:8 }}>
                  <div style={{ fontSize:15, fontWeight:900, color:'#111', marginBottom:4 }}>{s.title}</div>
                  <div style={{ fontSize:12, color:'#6B7280', fontWeight:600 }}>{s.start_time}{s.end_time?` – ${s.end_time}`:''}{s.location?` · ${s.location.split(',')[0]}`:''}</div>
                  <div style={{ marginTop:8, display:'flex', gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:700, background:primary+'18', color:primary, borderRadius:99, padding:'3px 10px' }}>❤️ {volunteerCounts[s.id]||0} volunteers</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BOOK TAB */}
        {tab === 'book' && (
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:'#111', marginBottom:4 }}>Find Your Next Session</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Join a session and help make a difference</div>

            {/* Confirmed bookings */}
            {upcomingRota.filter(r=>r.status==='confirmed').length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#16A34A', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>✅ My Confirmed Sessions</div>
                {upcomingRota.filter(r=>r.status==='confirmed').map(r => (
                  <div key={r.id} style={{ background:'linear-gradient(135deg,#DCFCE7,#D1FAE5)', borderRadius:14, border:'2px solid #16A34A', padding:'13px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:11, background:'#16A34A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>✅</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:2 }}>{r.session?.title}</div>
                      <div style={{ fontSize:11, color:'#6B7280', fontWeight:600 }}>{fmt(r.session?.session_date)}{r.session?.start_time?` · ${r.session.start_time}`:''}</div>
                    </div>
                    <span style={{ background:'#DCFCE7', color:'#16A34A', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:800 }}>Confirmed</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pending bookings */}
            {upcomingRota.filter(r=>r.status==='pending').length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#92400E', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>⏳ Awaiting Confirmation</div>
                {upcomingRota.filter(r=>r.status==='pending').map(r => (
                  <div key={r.id} style={{ background:'#FEF9C3', borderRadius:14, border:'1.5px solid #FDE68A', padding:'13px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:11, background:'#F59E0B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>⏳</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:2 }}>{r.session?.title}</div>
                      <div style={{ fontSize:11, color:'#6B7280', fontWeight:600 }}>{fmt(r.session?.session_date)}</div>
                    </div>
                    <span style={{ background:'#FEF9C3', color:'#92400E', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:800, border:'1.5px solid #FDE68A' }}>Pending</span>
                  </div>
                ))}
              </div>
            )}

            {/* Available sessions */}
            <div style={{ fontSize:12, fontWeight:800, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>
              Available Sessions ({[...todaySessions,...futureSessions].filter(s=>!myBookings[s.id]).length})
            </div>
            {[...todaySessions,...futureSessions].filter(s=>!myBookings[s.id]).length === 0 ? (
              <div style={{ background:'#0D1B2A', borderRadius:18, padding:'28px 20px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>🎉</div>
                <div style={{ fontSize:15, fontWeight:900, color:'#fff', marginBottom:6 }}>You're booked in for everything!</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', fontWeight:600 }}>Check back soon for new sessions.</div>
              </div>
            ) : [...todaySessions,...futureSessions].filter(s=>!myBookings[s.id]).map((s, idx) => {
              const isSaving = saving === s.id
              const count = volunteerCounts[s.id]||0
              const isFeatured = idx === 0
              return (
                <div key={s.id} style={{ background: isFeatured?'#0D1B2A':'#fff', borderRadius:18, border: isFeatured?'none':'1.5px solid #E5E7EB', padding:'16px', marginBottom:12, position:'relative', overflow:'hidden' }}>
                  {isFeatured && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${primary},#6366F1)` }} />}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                    <div style={{ width:48, height:48, borderRadius:14, background:primary+'22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22 }}>📅</div>
                    <div style={{ flex:1 }}>
                      {isFeatured && <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Next Session</div>}
                      <div style={{ fontSize:16, fontWeight:900, color: isFeatured?'#fff':'#111', marginBottom:5, lineHeight:1.2 }}>{s.title}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <div style={{ fontSize:12, fontWeight:600, color: isFeatured?'rgba(255,255,255,0.65)':'#6B7280', display:'flex', alignItems:'center', gap:5 }}>📅 {fmt(s.session_date)}</div>
                        {s.start_time && <div style={{ fontSize:12, fontWeight:600, color: isFeatured?'rgba(255,255,255,0.65)':'#6B7280', display:'flex', alignItems:'center', gap:5 }}>🕐 {s.start_time}{s.end_time?` – ${s.end_time}`:''}</div>}
                        {s.location && <div style={{ fontSize:12, fontWeight:600, color: isFeatured?'rgba(255,255,255,0.65)':'#6B7280', display:'flex', alignItems:'center', gap:5 }}>📍 {s.location.split(',')[0]}</div>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, fontWeight:700, background: isFeatured?'rgba(255,255,255,0.1)':primary+'15', color: isFeatured?'rgba(255,255,255,0.7)':primary, borderRadius:99, padding:'4px 10px' }}>❤️ {count} volunteer{count!==1?'s':''}</span>
                  </div>
                  <motion.button whileTap={{ scale:0.96 }} onClick={()=>handleBook(s)} disabled={isSaving} style={{ width:'100%', padding:12, borderRadius:12, border:'none', background: isFeatured?primary:`linear-gradient(135deg,${primary},#6366F1)`, color: isFeatured&&primary==='#F5D000'?'#0D1B2A':'#fff', fontSize:14, fontWeight:900, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    {isSaving?'...':<>❤️ Join Session</>}
                  </motion.button>
                </div>
              )
            })}
          </div>
        )}

        {/* ROTA TAB */}
        {tab === 'rota' && (
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:'#111', marginBottom:4 }}>My Sessions</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Your upcoming and past volunteer sessions</div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
              {[
                { val:upcomingRota.length, label:'Upcoming', bg:'#0D1B2A', color:'#F5D000' },
                { val:pastRota.length, label:'Completed', bg:primary, color:'#fff' },
              ].map(s => (
                <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:'14px' }}>
                  <div style={{ fontSize:28, fontWeight:900, color:s.color, lineHeight:1, marginBottom:4 }}>{s.val}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {upcomingRota.length === 0 && pastRota.length === 0 ? (
              <div style={{ background:'#0D1B2A', borderRadius:18, padding:'36px 20px', textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🗓️</div>
                <div style={{ fontSize:16, fontWeight:900, color:'#fff', marginBottom:8 }}>No sessions yet</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:20 }}>Book a session to get started</div>
                <motion.button whileTap={{ scale:0.97 }} onClick={()=>setTab('book')} style={{ padding:'11px 22px', borderRadius:10, border:'none', background:primary, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer' }}>Browse Sessions →</motion.button>
              </div>
            ) : (
              <>
                {upcomingRota.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>Upcoming</div>
                    {upcomingRota.map(r => (
                      <div key={r.id} style={{ background:'#fff', borderRadius:14, border:`1.5px solid ${r.status==='confirmed'?'#86EFAC':'#E5E7EB'}`, padding:'14px', marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:15, fontWeight:800, color:'#111', marginBottom:3 }}>{r.session?.title}</div>
                            <div style={{ fontSize:12, color:'#6B7280', fontWeight:600, display:'flex', gap:8, flexWrap:'wrap' }}>
                              {r.session?.session_date && <span>📅 {fmt(r.session.session_date)}</span>}
                              {r.session?.start_time && <span>🕐 {r.session.start_time}</span>}
                              {r.session?.location && <span>📍 {r.session.location.split(',')[0]}</span>}
                            </div>
                          </div>
                          <span style={{ background: r.status==='confirmed'?'#DCFCE7':'#FEF9C3', color: r.status==='confirmed'?'#16A34A':'#92400E', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:800, flexShrink:0 }}>{r.status==='confirmed'?'Confirmed':'Pending'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {pastRota.length > 0 && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>Past Sessions ({pastRota.length})</div>
                    {pastRota.slice(0,5).map(r => (
                      <div key={r.id} style={{ background:'#F9FAFB', borderRadius:12, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, opacity:0.75 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:'#E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>✅</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#111' }}>{r.session?.title}</div>
                          <div style={{ fontSize:11, color:'#6B7280' }}>{fmt(r.session?.session_date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* IMPACT TAB */}
        {tab === 'impact' && (
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:'#111', marginBottom:4 }}>My Impact</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Thank you for making a difference</div>

            {/* Hero impact card */}
            <div style={{ background:'linear-gradient(135deg,#0D1B2A,#1B2A4A)', borderRadius:20, padding:'20px', marginBottom:16, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:primary+'18' }} />
              <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1.5, marginBottom:12 }}>❤️ My Impact</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { val:Math.round(totalHours*2), label:'Young people helped', emoji:'👦', grad:`linear-gradient(135deg,${primary},#0F6E56)` },
                  { val:completedSessions, label:'Sessions done', emoji:'🏕️', grad:'linear-gradient(135deg,#7C4DBA,#4A1B9A)' },
                  { val:totalHours.toFixed(1)+'h', label:'Hours given', emoji:'⏱️', grad:'linear-gradient(135deg,#C9860F,#8B5E0A)' },
                  { val:upcomingRota.length, label:'Upcoming', emoji:'📅', grad:'linear-gradient(135deg,#1B4FA8,#0D2D6E)' },
                ].map(s => (
                  <div key={s.label} style={{ borderRadius:14, overflow:'hidden', position:'relative', height:80, background:s.grad }}>
                    <div style={{ position:'absolute', top:-10, right:-10, width:50, height:50, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
                    <div style={{ padding:'12px 14px', height:'100%', boxSizing:'border-box', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:0.5 }}>{s.emoji} {s.label}</div>
                      <div style={{ fontSize:24, fontWeight:900, color:'#fff', lineHeight:1 }}>{s.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Volunteer journey */}
            <div style={{ background:'#fff', borderRadius:18, border:'1.5px solid #E5E7EB', padding:'16px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#111' }}>🏆 Volunteer Journey</div>
                <span style={{ fontSize:12, fontWeight:800, color:tierColor }}>{tier}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                {['Green','Silver','Gold','Champion'].map((t,i) => {
                  const thresholds=[0,25,50,100], colors=['#4ADE80','#C0C0C0','#F0A500','#F5D000']
                  const isPast = thresholds[i] <= totalHours, isActive = tier === t
                  return (
                    <React.Fragment key={t}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:isPast?colors[i]:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:isActive?`2.5px solid ${colors[i]}`:'none' }}>
                        <span style={{ fontSize:12 }}>{isPast?'🏅':'○'}</span>
                      </div>
                      {i<3 && <div style={{ flex:1, height:3, borderRadius:99, background:totalHours>=thresholds[i+1]?colors[i+1]:'#F3F4F6' }} />}
                    </React.Fragment>
                  )
                })}
              </div>
              <div style={{ background:'#F3F4F6', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#111' }}>{tier==='Champion'?'Maximum level!':`${(nextTier-totalHours).toFixed(1)}h to ${nextTierName}`}</div>
                  <div style={{ fontSize:12, color:'#6B7280' }}>{totalHours.toFixed(1)}/{nextTier}h</div>
                </div>
                <div style={{ background:'#E5E7EB', borderRadius:99, height:8 }}>
                  <div style={{ background:`linear-gradient(90deg,${primary},#6366F1)`, width:`${progress}%`, height:'100%', borderRadius:99, transition:'width 0.5s' }} />
                </div>
              </div>
            </div>

            {/* Achievements */}
            <div style={{ background:'#fff', borderRadius:18, border:'1.5px solid #E5E7EB', padding:'16px' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#111', marginBottom:14 }}>🎖️ Achievements</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'First Session', icon:'⭐', desc:'Completed first session', unlocked:completedSessions>=1, color:'#F5D000' },
                  { label:'5 Hours', icon:'⏱️', desc:'Volunteered 5+ hours', unlocked:totalHours>=5, color:primary },
                  { label:'10 Hours', icon:'❤️', desc:'Volunteered 10+ hours', unlocked:totalHours>=10, color:'#9B59B6' },
                  { label:'Silver Tier', icon:'🥈', desc:'Reached 25 hours', unlocked:totalHours>=25, color:'#C0C0C0' },
                  { label:'5 Sessions', icon:'🏕️', desc:'5 sessions done', unlocked:completedSessions>=5, color:'#16A34A' },
                  { label:'Gold Tier', icon:'🥇', desc:'Reached 50 hours', unlocked:totalHours>=50, color:'#F0A500' },
                ].map(a => (
                  <div key={a.label} style={{ background:a.unlocked?a.color+'15':'#F9FAFB', borderRadius:12, padding:'12px 10px', border:`1.5px solid ${a.unlocked?a.color+'40':'#E5E7EB'}`, opacity:a.unlocked?1:0.6 }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>{a.unlocked?a.icon:'🔒'}</div>
                    <div style={{ fontSize:12, fontWeight:800, color:a.unlocked?'#111':'#6B7280', marginBottom:2 }}>{a.label}</div>
                    <div style={{ fontSize:10, color:'#6B7280', fontWeight:600, lineHeight:1.3 }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div>
            {/* Hero card */}
            <div style={{ background:'linear-gradient(135deg,#0D1B2A,#1B2A4A)', borderRadius:20, padding:'20px', marginBottom:16, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:primary+'18' }} />
              <div style={{ display:'flex', alignItems:'center', gap:14, position:'relative', zIndex:1 }}>
                <div style={{ width:64, height:64, borderRadius:18, background:profile?.photo_url?'transparent':primary, border:'3px solid rgba(255,255,255,0.15)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:22, fontWeight:900, color:'#fff' }}>{initials}</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:'#fff', lineHeight:1.1, marginBottom:4 }}>{profile?.full_name || 'Volunteer'}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8 }}>{profile?.email}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {profile?.availability?.days?.slice(0,3).map(d => (
                      <span key={d} style={{ background:'rgba(255,255,255,0.1)', borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)' }}>{d.slice(0,3)}</span>
                    ))}
                    <span style={{ background:tierColor+'25', borderRadius:99, padding:'3px 10px', fontSize:10, fontWeight:800, color:tierColor }}>{tier}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info cards */}
            {[
              { title:'Contact', items:[{ label:'Phone', val:profile?.phone }, { label:'Email', val:profile?.email }] },
              { title:'Emergency Contact', items:[{ label:'Name', val:profile?.emergency_contact_name }, { label:'Phone', val:profile?.emergency_contact_phone }, { label:'Relationship', val:profile?.emergency_contact_relationship }] },
              { title:'Availability', items:[{ label:'Days', val:profile?.availability?.days?.join(', ')||'Not set' }, { label:'Times', val:profile?.availability?.times?.join(', ')||'Not set' }] },
            ].map(section => (
              <div key={section.title} style={{ background:'#fff', borderRadius:16, border:'1.5px solid #E5E7EB', padding:'14px 16px', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#111', marginBottom:10 }}>{section.title}</div>
                {section.items.filter(i=>i.val).map(item => (
                  <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F3F4F6' }}>
                    <span style={{ fontSize:12, color:'#6B7280', fontWeight:600 }}>{item.label}</span>
                    <span style={{ fontSize:12, color:'#111', fontWeight:700 }}>{item.val}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Interests */}
            {profile?.interests?.length > 0 && (
              <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #E5E7EB', padding:'14px 16px', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#111', marginBottom:10 }}>Interests</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {profile.interests.map(i => (
                    <span key={i} style={{ background:primary+'15', color:primary, borderRadius:99, padding:'5px 12px', fontSize:12, fontWeight:700 }}>{i}</span>
                  ))}
                </div>
              </div>
            )}

            <motion.button whileTap={{ scale:0.98 }} onClick={onSignOut} style={{ width:'100%', padding:14, borderRadius:14, border:'1.5px solid #E5E7EB', background:'#fff', fontSize:14, fontWeight:700, color:'#6B7280', cursor:'pointer', marginTop:8 }}>Sign Out</motion.button>
          </div>
        )}
      </motion.div>
      </AnimatePresence>
      </div>

      {/* ── BOTTOM NAV (floating glass pill) ── */}
      <div style={{ position:'fixed', bottom:14, left:14, right:14, zIndex:100, display:'flex', justifyContent:'center', paddingBottom:'env(safe-area-inset-bottom,0px)' }}>
        <div style={{ display:'flex', gap:2, background:'rgba(13,27,42,0.92)', backdropFilter:'blur(20px)', borderRadius:22, padding:5, boxShadow:'0 16px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)', maxWidth:440, width:'100%' }}>
          {NAV.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)} style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'9px 4px', background:'none', border:'none', cursor:'pointer' }}>
              {tab === t.key && (
                <motion.div
                  layoutId="volunteerNavPill"
                  transition={{ type:'spring', stiffness:420, damping:32 }}
                  style={{ position:'absolute', inset:0, background:primary, borderRadius:16 }}
                />
              )}
              <span style={{ position:'relative', zIndex:1, fontSize:18 }}>{t.icon}</span>
              <span style={{ position:'relative', zIndex:1, fontSize:9, fontWeight:800, color: tab===t.key?'#fff':'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:0.3 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CFC Modal */}
      <AnimatePresence>
      {showCFC && (
        <motion.div
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end' }}
        >
          <motion.div
            initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
            transition={{ type:'spring', stiffness:300, damping:32 }}
            style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto', padding:'20px' }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:900, color:'#111' }}>🛡️ Raise a Concern</div>
              <motion.button whileTap={{ scale:0.9 }} onClick={()=>setShowCFC(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#6B7280' }}>✕</motion.button>
            </div>
            <p style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Please complete this form and your DSL will be notified immediately.</p>
            <textarea rows={5} placeholder="Describe the concern in detail..." style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E5E7EB', fontSize:14, outline:'none', boxSizing:'border-box', resize:'none', marginBottom:12 }} />
            <motion.button whileTap={{ scale:0.98 }} style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:'#C00', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>Submit Concern</motion.button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
