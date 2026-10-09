
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useRealtimeTable } from '../../lib/useRealtimeTable'
import VPToday from './VPToday'
import VPSessions from './VPSessions'
import VPSessionDetail from './VPSessionDetail'
import VPMessages from './VPMessages'
import VPProfile from './VPProfile'
import VPQuickActionMenu from './VPQuickActionMenu'
import VPHours from './VPHours'
import LiveRegister from '../registers/LiveRegister'
import { OrgLogo, orgBrand } from '../shared/OrgPageHero'
import { applyBrandPalette } from '../../lib/brandColors'
import { applyBrandTheme } from '../../lib/brandTheme'
import { todayInLondon } from '../../lib/today'
import { signOne } from '../../lib/storageUrl'
import { uploadStaffPhoto } from '../../lib/staffPhoto'
import Icon from '../../lib/icons'
import { withAlpha } from '../../lib/withAlpha'

const SLUG = window.location.pathname.split('/volunteer/')[1]?.split('/')[0]

const INTERESTS = ['⚽ Football','🏀 Basketball','🎨 Arts & Crafts','🎮 Gaming','🎵 Music','🍳 Cooking','🏕 Trips','📚 Homework Club','🤝 Mentoring','🚌 Transport','🍽 Refreshments','📸 Photography','💻 IT']
const EXPERIENCE_OPTS = ['Youth work','Teaching','Coaching','First Aid','Safeguarding','Healthcare','Administration','Events','Fundraising']
const QUALIFICATIONS = ['DBS Certificate','First Aid','Safeguarding','Driving Licence','Food Hygiene','Minibus Permit']
const AGE_GROUPS = ['4–7','8–11','12–15','16+','Any']
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const TIMES = ['Morning','Afternoon','Evening']

const s = {
  wrap: (brand) => ({ minHeight:'100dvh', background: brand?.hero || 'radial-gradient(circle at 15% 10%, #16283d 0%, #0A121D 45%, #060a11 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px)', boxSizing:'border-box', fontFamily:'inherit', position:'relative', overflow:'hidden' }),
  card: { background: 'var(--surface)', borderRadius:28, width:'100%', maxWidth:480, overflow:'hidden', boxShadow:'0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)', position:'relative', zIndex:1 },
  head: (color) => ({ background:`linear-gradient(135deg, ${color||'#1B9AAA'}, ${withAlpha(color||'#1B9AAA', 'dd')})`, padding:'28px 28px 20px', color:'#fff', position:'relative', overflow:'hidden' }),
  body: { padding:'28px 28px 24px' },
  label: { fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, display:'block', marginBottom:6 },
  inp: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:15, outline:'none', boxSizing:'border-box', marginBottom:14, fontFamily:'Inter,sans-serif', transition:'border-color 0.15s, box-shadow 0.15s' },
  btn: (color) => ({ width:'100%', padding:14, borderRadius:14, border:'none', background:`linear-gradient(135deg, ${color||'#1B9AAA'}, ${withAlpha(color||'#1B9AAA', 'cc')})`, color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', marginTop:8, boxShadow:`0 8px 24px ${withAlpha(color||'#1B9AAA', '55')}` }),
  back: { background:'none', border:'none', color:'rgba(255,255,255,0.6)', fontSize:13, cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4, marginBottom:12 },
  chip: (active,color) => ({ padding:'8px 14px', borderRadius:99, border:`1.5px solid ${active?(color||'#1B9AAA'):'var(--border)'}`, background:active?(color||'#1B9AAA')+'18':'var(--surface2)', color:active?(color||'#1B9AAA'):'var(--text3)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }),
  prog: (pct,color) => ({ height:3, background:'rgba(255,255,255,0.2)', borderRadius:2, marginTop:12, overflow:'hidden', children:null }),
}

// Ambient floating gradient orbs used behind auth/onboarding cards — purely decorative
function AmbientOrbs({ color, secondary }) {
  return (
    <>
      <motion.div
        animate={{ y:[0,-18,0], x:[0,10,0] }}
        transition={{ duration:9, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', top:'8%', left:'8%', width:220, height:220, borderRadius:'50%', background:`${withAlpha(color||'#1B9AAA', '22')}`, filter:'blur(50px)', pointerEvents:'none' }}
      />
      <motion.div
        animate={{ y:[0,16,0], x:[0,-12,0] }}
        transition={{ duration:11, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', bottom:'10%', right:'10%', width:260, height:260, borderRadius:'50%', background: withAlpha(secondary || '#ffffff', '33'), filter:'blur(60px)', pointerEvents:'none' }}
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
        style={{ height:'100%', background: 'var(--surface)', borderRadius:2 }}
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
  const [photoPath, setPhotoPath] = useState(null)
  const photoRef = useRef(null)
  const brand = orgBrand(org)
  const primary = brand.ink
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
    try {
      // Keep the path for the profile row and the signed URL only for the
      // preview: writing the signed URL to photo_url would persist something
      // that expires in ten minutes.
      const stored = await uploadStaffPhoto({ userId: user.id, file, previous: photoPath })
      setPhotoPath(stored)
      setPhotoUrl(await signOne('staff-photos', stored))
    } catch (err) {
      alert(err.message)
    }
    setPhotoUploading(false)
  }

  async function finish() {
    setSaving(true)
    const full_name = `${f.first_name} ${f.last_name}`.trim()
    await supabase.from('user_profiles').update({
      first_name: f.first_name, last_name: f.last_name, full_name,
      preferred_name: f.preferred_name, phone: f.phone, date_of_birth: f.date_of_birth||null,
      photo_url: photoPath || null,
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
        <div style={{ fontSize:56, marginBottom:16 }}><Icon name="👋" /></div>
        <div style={{ fontSize:24, fontWeight:900, color:'var(--text)', marginBottom:10 }}>Welcome to {org?.name}!</div>
        <div style={{ fontSize:15, color: 'var(--text3)', lineHeight:1.6, marginBottom:28 }}>Thanks for joining. Let's get you set up so we can match you with the right sessions.<br/><br/>This takes about 2–3 minutes.</div>
        <button onClick={()=>setStep(1)} style={s.btn(primary)}>Let's get started →</button>
      </div>
    </div>,

    // 1: About You
    <div key={1} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>About You</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:20 }}>Tell us a bit about yourself</div>
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
        <div style={{ width:56, height:56, borderRadius:16, background:primary+'22', border:`2px solid var(--org-a20)`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {photoUrl ? <img src={photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:22 }}><Icon name="📷" /></span>}
        </div>
        <button onClick={()=>photoRef.current?.click()} style={{ padding:'8px 16px', borderRadius:10, border:`1.5px solid ${primary}`, background:'transparent', color: 'var(--org-ink)', fontSize:13, fontWeight:700, cursor:'pointer' }}>{photoUploading?'Uploading...':'Upload photo'}</button>
        <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={uploadPhoto} />
      </div>
      <button onClick={()=>setStep(2)} disabled={!f.first_name.trim()||!f.last_name.trim()||!f.phone.trim()} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 2: Emergency Contact
    <div key={2} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Emergency Contact</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:20 }}>Essential for safeguarding — who should we contact in an emergency?</div>
      <label style={s.label}>Contact name *</label>
      <input style={s.inp} value={f.emergency_contact_name} onChange={e=>set('emergency_contact_name',e.target.value)} placeholder="Jane Jones" />
      <label style={s.label}>Relationship</label>
      <input style={s.inp} value={f.emergency_contact_relationship} onChange={e=>set('emergency_contact_relationship',e.target.value)} placeholder="e.g. Partner, Parent, Sibling" />
      <label style={s.label}>Phone number *</label>
      <input style={s.inp} value={f.emergency_contact_phone} onChange={e=>set('emergency_contact_phone',e.target.value)} placeholder="07700900000" type="tel" />
      <button onClick={()=>setStep(3)} disabled={!f.emergency_contact_name.trim()||!f.emergency_contact_phone.trim()} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 3: Address
    <div key={3} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Your Address</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:20 }}>Useful for trips and emergencies</div>
      <label style={s.label}>Postcode</label>
      <input style={s.inp} value={f.postcode} onChange={e=>set('postcode',e.target.value)} placeholder="SW1A 1AA" />
      <label style={s.label}>Address</label>
      <input style={s.inp} value={f.address} onChange={e=>set('address',e.target.value)} placeholder="123 High Street" />
      <label style={s.label}>City</label>
      <input style={s.inp} value={f.city} onChange={e=>set('city',e.target.value)} placeholder="London" />
      <button onClick={()=>setStep(4)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 4: Availability
    <div key={4} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Your Availability</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:16 }}>When are you usually free to volunteer?</div>
      <div style={{ fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Days</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {DAYS.map(d=><button key={d} onClick={()=>togAvail('days',d)} style={s.chip(f.availability.days.includes(d),primary)}>{d}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Times</div>
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {TIMES.map(t=><button key={t} onClick={()=>togAvail('times',t)} style={s.chip(f.availability.times.includes(t),primary)}>{t}</button>)}
      </div>
      <button onClick={()=>setStep(5)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 5: Interests
    <div key={5} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Your Interests</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:16 }}>What would you enjoy helping with?</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {INTERESTS.map(i=><button key={i} onClick={()=>tog('interests',i)} style={s.chip(f.interests.includes(i),primary)}>{i}</button>)}
      </div>
      <button onClick={()=>setStep(6)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 6: Experience
    <div key={6} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Your Experience</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:16 }}>Have you volunteered before?</div>
      <div style={{ display:'flex', gap:10, marginBottom:18 }}>
        {['Yes','No'].map(v=><button key={v} onClick={()=>set('volunteered_before',v==='Yes')} style={{ ...s.chip(f.volunteered_before===(v==='Yes'),primary), flex:1, textAlign:'center' }}>{v}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Relevant experience</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {EXPERIENCE_OPTS.map(e=><button key={e} onClick={()=>tog('experience',e)} style={s.chip(f.experience.includes(e),primary)}>{e}</button>)}
      </div>
      <button onClick={()=>setStep(7)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 7: Qualifications
    <div key={7} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Qualifications</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:16 }}>Select any you currently hold — you can upload documents later</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
        {QUALIFICATIONS.map(q=>(
          <label key={q} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:`1.5px solid ${f.qualifications.includes(q)?primary:'var(--border)'}`, background:f.qualifications.includes(q)?primary+'08':'var(--surface2)', cursor:'pointer' }}>
            <input type="checkbox" checked={f.qualifications.includes(q)} onChange={()=>tog('qualifications',q)} style={{ accentColor:primary, width:16, height:16 }} />
            <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{q}</span>
          </label>
        ))}
      </div>
      <button onClick={()=>setStep(8)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 8: Working Preferences
    <div key={8} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Working Preferences</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:16 }}>What would you like to help with?</div>
      <div style={{ fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Age groups</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:18 }}>
        {AGE_GROUPS.map(a=><button key={a} onClick={()=>tog('age_groups',a)} style={s.chip(f.age_groups.includes(a),primary)}>{a}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Group size</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
        {['One-to-one','Small groups','Large groups','Happy with anything'].map(g=>(
          <button key={g} onClick={()=>set('group_size',g)} style={{ ...s.chip(f.group_size===g,primary), textAlign:'left' }}>{g}</button>
        ))}
      </div>
      <button onClick={()=>setStep(9)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 9: Health & Accessibility
    <div key={9} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Health & Accessibility</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:20 }}>All fields are optional — only share what you are comfortable with</div>
      <label style={s.label}>Medical conditions</label>
      <textarea style={{ ...s.inp, height:72, resize:'none' }} value={f.medical_conditions} onChange={e=>set('medical_conditions',e.target.value)} placeholder="e.g. Asthma, diabetes..." />
      <label style={s.label}>Accessibility requirements</label>
      <textarea style={{ ...s.inp, height:72, resize:'none' }} value={f.accessibility_requirements} onChange={e=>set('accessibility_requirements',e.target.value)} placeholder="e.g. Wheelchair access needed..." />
      <label style={s.label}>Dietary requirements</label>
      <input style={s.inp} value={f.dietary_requirements} onChange={e=>set('dietary_requirements',e.target.value)} placeholder="e.g. Vegetarian, halal..." />
      <label style={s.label}>Languages spoken</label>
      <input style={s.inp} value={f.languages} onChange={e=>set('languages',e.target.value)} placeholder="e.g. English, Urdu, French" />
      <button onClick={()=>setStep(10)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 10: Communication
    <div key={10} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Communication</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:16 }}>How would you like to hear from us?</div>
      <div style={{ fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Preferred contact</div>
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {['Email','SMS','WhatsApp'].map(c=><button key={c} onClick={()=>set('preferred_contact',c)} style={{ ...s.chip(f.preferred_contact===c,primary), flex:1, textAlign:'center' }}>{c}</button>)}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color: 'var(--text3)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 }}>Notifications</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
        {[['session_reminders','Session reminders'],['new_opportunities','New opportunities'],['announcements','Announcements'],['mentoring_updates','Mentoring updates']].map(([k,label])=>(
          <label key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)', background: 'var(--surface2)', cursor:'pointer' }}>
            <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{label}</span>
            <input type="checkbox" checked={f.notification_prefs[k]} onChange={()=>togNotif(k)} style={{ accentColor:primary, width:16, height:16 }} />
          </label>
        ))}
      </div>
      <button onClick={()=>setStep(11)} style={s.btn(primary)}>Continue <Icon name="→" /></button>
    </div>,

    // 11: Agreements
    <div key={11} style={s.body}>
      <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:4 }}>Agreements</div>
      <div style={{ fontSize:13, color: 'var(--text3)', marginBottom:16 }}>Please read and agree to the following</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
        {[['volunteer_agreement','Volunteer agreement'],['safeguarding_policy','Safeguarding policy'],['privacy_policy','Privacy policy'],['photo_consent','Photo consent']].map(([k,label])=>(
          <label key={k} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:`1.5px solid ${f.agreements[k]?primary:'var(--border)'}`, background:f.agreements[k]?primary+'08':'var(--surface2)', cursor:'pointer' }}>
            <input type="checkbox" checked={f.agreements[k]} onChange={()=>togAgree(k)} style={{ accentColor:primary, width:16, height:16 }} />
            <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{label}</span>
          </label>
        ))}
      </div>
      <label style={s.label}>Electronic signature</label>
      <input style={s.inp} value={f.signature} onChange={e=>set('signature',e.target.value)} placeholder="Type your full name to sign" />
      <div style={{ fontSize:12, color: 'var(--text-faint)', marginBottom:14 }}>Date: {new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
      <button onClick={finish} disabled={saving||!f.agreements.volunteer_agreement||!f.agreements.safeguarding_policy||!f.agreements.privacy_policy||!f.signature.trim()} style={s.btn(primary)}>{saving?'Saving...':'Complete setup →'}</button>
    </div>,
  ]

  return (
    <div style={s.wrap(brand)}>
      <AmbientOrbs color={primary} secondary={brand.secondary} />
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
              <div style={{ display:'inline-flex', alignItems:'center', background: 'var(--surface)', borderRadius:9, padding:'4px 10px' }}>
                <img src={org.logo_url} alt={org.name} style={{ height:20, maxWidth:110, objectFit:'contain', display:'block' }}
                  onError={e => { e.target.parentNode.style.display='none' }} />
              </div>
            ) : (
              <span style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:0.8 }}>{org?.name}</span>
            )}
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.55)' }}>{step === 0 ? 'Volunteer Setup' : `Step ${step} of ${TOTAL - 1}`}</span>
          </div>
          {step > 0 && <motion.button whileTap={{ scale:0.95 }} onClick={()=>setStep(s=>s-1)} style={s.back}><Icon name="←" /> Back</motion.button>}
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
  const [forgotSent, setForgotSent] = useState(false)
  const brand = orgBrand(org)
  const primary = brand.ink

  useEffect(() => {
    supabase.from('organisations').select('*').eq('slug', SLUG).single().then(({data}) => {
      setOrg(data)
      // The portal sits outside the dashboard, so it applies the
      // organisation's palette and font itself.
      if (data) { applyBrandPalette(data.primary_color || '#1B9AAA'); applyBrandTheme(data) }
    })
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

  // The same reset email as the main sign-in page, in the organisation's
  // colours, landing back on its password page.
  async function handleForgot() {
    if (!email.trim()) { setError('Type your email address above first, then press Forgotten your password.'); return }
    setError('')
    const { error: err } = await supabase.functions.invoke('send-password-reset-email', {
      body: {
        email: email.trim(), org_name: org?.name, org_slug: org?.slug,
        org_logo: org?.branding_enabled && org?.logo_url ? org.logo_url : window.location.origin + '/logo.png', org_color: org?.primary_color,
        redirect_to: window.location.origin + '/reset-password' + (org?.slug ? '?org=' + encodeURIComponent(org.slug) : ''),
      },
    })
    if (err) { setError('We could not send the reset link. Check your connection and try again.'); return }
    setForgotSent(true)
  }

  async function handleAuth(e) {
    e.preventDefault(); setAuthLoading(true); setError('')
    const {error:err} = await supabase.auth.signInWithPassword({email,password})
    if(err){setError(err.message);setAuthLoading(false);return}
    setAuthLoading(false)
  }

  if(view==='loading') return (
    <div role="status" aria-label="Loading" style={{ minHeight:'100dvh', background: org ? brand.hero : 'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <motion.div
        animate={{ rotate:360 }}
        transition={{ duration:0.8, repeat:Infinity, ease:'linear' }}
        style={{ width:36, height:36, border:`3px solid ${org ? '#fff' : primary}`, borderTop:'3px solid transparent', borderRadius:'50%' }}
      />
    </div>
  )

  if(view==='onboarding') return <OnboardingWizard user={authUser} org={org} onComplete={()=>{ validateAndLoad() }} />

  if(view==='pending') return (
    <div style={s.wrap(brand)}>
      <AmbientOrbs color={primary} secondary={brand.secondary} />
      <motion.div initial={{ opacity:0, y:16, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.35 }} style={{ ...s.card, textAlign:'center' }}>
        <div style={s.head(primary)}><div style={{ fontSize:32 }}>⏳</div><div style={{ fontSize:20, fontWeight:900, marginTop:8 }}>Pending Approval</div></div>
        <div style={s.body}>
          <p style={{ color: 'var(--text3)', lineHeight:1.6, marginBottom:20 }}>Your application has been received. A staff member will review and approve your account shortly.</p>
          <motion.button whileTap={{ scale:0.97 }} onClick={()=>supabase.auth.signOut().then(()=>setView('login'))} style={{ ...s.btn('var(--text3)'), marginTop:0 }}>Sign out</motion.button>
        </div>
      </motion.div>
    </div>
  )

  if(view==='rejected') return (
    <div style={s.wrap(brand)}>
      <AmbientOrbs color="#EF4444" secondary={brand.secondary} />
      <motion.div initial={{ opacity:0, y:16, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.35 }} style={{ ...s.card, textAlign:'center' }}>
        <div style={s.head('#EF4444')}><div style={{ fontSize:32 }}><Icon name="❌" /></div><div style={{ fontSize:20, fontWeight:900, marginTop:8 }}>Application Unsuccessful</div></div>
        <div style={s.body}>
          <p style={{ color: 'var(--text3)', lineHeight:1.6, marginBottom:20 }}>Unfortunately your volunteer application was not approved. Please contact {org?.name} for more information.</p>
          <motion.button whileTap={{ scale:0.97 }} onClick={()=>supabase.auth.signOut().then(()=>setView('login'))} style={{ ...s.btn('var(--text3)'), marginTop:0 }}>Sign out</motion.button>
        </div>
      </motion.div>
    </div>
  )

  if(view==='login') return (
    <div style={s.wrap(brand)}>
      <AmbientOrbs color={primary} secondary={brand.secondary} />
      <motion.div initial={{ opacity:0, y:16, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.35, ease:'easeOut' }} style={s.card}>
        <div style={{ background: brand.hero, padding:'26px 24px 22px', color:'#fff', position:'relative', overflow:'hidden' }}>
          <div aria-hidden="true" style={{ position:'absolute', width:220, height:220, right:-90, top:-120, borderRadius:'50%', border:`2px solid ${withAlpha(brand.secondary, '99')}`, pointerEvents:'none' }} />
          <div style={{ position:'relative', display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
            <OrgLogo org={org} height={48} maxWidth={170} />
            <div style={{ fontSize:15, fontWeight:900, minWidth:0 }}>{org?.name || 'Your organisation'}</div>
          </div>
          <h1 style={{ position:'relative', margin:0, fontSize:24, fontWeight:900 }}>Volunteer sign in</h1>
          <div style={{ position:'relative', fontSize:14, color:'#ffffffd9', fontWeight:600, marginTop:4 }}>Your sessions, your messages and your hours.</div>
        </div>
        <div style={s.body}>
          {error && <div role="alert" style={{ background: 'var(--danger-bg)', border:'1px solid var(--danger-border)', color:'var(--danger-text)', borderRadius:10, padding:'10px 14px', fontSize:13, marginBottom:16, fontWeight:600 }}>{error}</div>}
          <form onSubmit={handleAuth}>
            <label htmlFor="vp-email" style={s.label}>Email address</label>
            <input id="vp-email" style={{ ...s.inp, minHeight:48, fontSize:16 }} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" required autoFocus />
            <label htmlFor="vp-password" style={s.label}>Password</label>
            <input id="vp-password" style={{ ...s.inp, minHeight:48, fontSize:16 }} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
            <motion.button whileTap={{ scale:0.97 }} type="submit" disabled={authLoading} style={{ ...s.btn(primary), minHeight:50 }}>{authLoading?'Signing in...':'Sign in →'}</motion.button>
          </form>
          <div style={{ textAlign:'center', marginTop:16, fontSize:13, color: 'var(--text3)', lineHeight:1.5 }}>
            {forgotSent
              ? <div role="status" style={{ color:'var(--text2)', fontWeight:700 }}>If {email.trim()} has a volunteer account, a link to set a new password is on its way.</div>
              : <button type="button" onClick={handleForgot} style={{ minHeight:44, border:'none', background:'none', padding:'0 8px', color:'var(--org-ink)', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>Forgotten your password?</button>}
            <div style={{ marginTop:8 }}>New volunteer? Ask {org?.name || 'your organisation'} to send you an invite.</div>
          </div>
          {!org?.branding_enabled && <div style={{ textAlign:'center', marginTop:14, fontSize:11.5, color:'var(--text-faint)' }}>Powered by LaunchSession</div>}
        </div>
      </motion.div>
    </div>
  )

  return <VolunteerDashboard user={authUser} profile={profile} org={org} onSignOut={() => supabase.auth.signOut().then(() => { setAuthUser(null); setView('login') })} />
}

// ─── VOLUNTEER DASHBOARD ──────────────────────────────────────────────────────
//
// Built for a phone in one hand: five tabs at the bottom within thumb reach,
// every control at least 44px, and the organisation's own colours and logo
// rather than LaunchSession's, as on the rest of the app.

const TABS = [
  { key: 'today', icon: '🏠', label: 'Today' },
  { key: 'sessions', icon: '📅', label: 'Sessions' },
  { key: 'hours', icon: '⏱️', label: 'Hours' },
  { key: 'messages', icon: '💬', label: 'Messages' },
  { key: 'profile', icon: '👤', label: 'Me' },
]
const tabFromHash = () => {
  const key = (window.location.hash || '').replace('#', '')
  return TABS.some(t => t.key === key) ? key : 'today'
}

export function VolunteerDashboard({ user, profile: initialProfile, org, onSignOut }) {
  const brand = orgBrand(org)
  // Buttons and banners carry white text, so they take the brand's ink, which
  // orgBrand keeps dark enough for it.
  const primary = brand.ink
  const [profile, setProfile] = useState(initialProfile)
  useEffect(() => { setProfile(initialProfile) }, [initialProfile])

  const [tab, setTabState] = useState(tabFromHash)
  const setTab = next => {
    setTabState(next)
    try { window.history.replaceState(null, '', `#${next}`) } catch (e) { /* ignore */ }
    scrollRef.current?.scrollTo?.({ top: 0 })
  }
  const scrollRef = useRef(null)
  const [profileSub, setProfileSub] = useState(null)
  const [sessions, setSessions] = useState([])
  const [teamRows, setTeamRows] = useState([])
  const [sessionsById, setSessionsById] = useState({})
  const [volunteerCounts, setVolunteerCounts] = useState({})
  const [announcements, setAnnouncements] = useState([])
  const [saving, setSaving] = useState(null)
  const [viewingSession, setViewingSession] = useState(null)
  const [registerSession, setRegisterSession] = useState(null)
  const [quickMenuOpen, setQuickMenuOpen] = useState(false)
  const [forceModal, setForceModal] = useState(null)
  const [toast, setToast] = useState('')

  const today = todayInLondon()

  async function loadData() {
    if (!org?.id || !user?.id) return
    const [{ data: sess }, { data: mine }, { data: rota }, { data: ann }] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id', org.id).gte('session_date', today).order('session_date').order('start_time').limit(40),
      supabase.from('session_staff').select('*').eq('org_id', org.id).eq('user_id', user.id),
      supabase.from('session_staff').select('session_id, role').eq('org_id', org.id),
      supabase.from('announcements').select('*').eq('org_id', org.id).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10),
    ])
    const upcoming = sess || []
    const byId = Object.fromEntries(upcoming.map(x => [x.id, x]))
    // Past sessions the volunteer was on, for their hours.
    const missing = [...new Set((mine || []).map(r => r.session_id))].filter(id => !byId[id])
    if (missing.length) {
      const { data: past } = await supabase.from('sessions').select('*').eq('org_id', org.id).in('id', missing)
      ;(past || []).forEach(x => { byId[x.id] = x })
    }
    setSessions(upcoming)
    setSessionsById(byId)
    setTeamRows(mine || [])
    const counts = {}
    ;(rota || []).forEach(r => { if (r.role === 'volunteer') counts[r.session_id] = (counts[r.session_id] || 0) + 1 })
    setVolunteerCounts(counts)
    setAnnouncements(ann || [])
  }

  useEffect(() => { loadData() }, [org?.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useRealtimeTable('sessions', loadData, { filter: org?.id ? `org_id=eq.${org.id}` : undefined, enabled: !!org?.id, pollInterval: 15000 })
  useRealtimeTable('session_staff', loadData, { filter: org?.id ? `org_id=eq.${org.id}` : undefined, enabled: !!org?.id, pollInterval: 10000 })

  const flash = message => { setToast(message); setTimeout(() => setToast(''), 3200) }

  const myBookings = Object.fromEntries(teamRows.map(r => [r.session_id, r]))

  // Booking puts the volunteer on the session's team. Cancelling takes them
  // off again, but only before they have been signed in: after that the row
  // is their hours.
  async function handleBook(session) {
    setSaving(session.id)
    const mineRow = myBookings[session.id]
    const { error } = mineRow
      ? await supabase.from('session_staff').delete().eq('id', mineRow.id).eq('user_id', user.id).is('signed_in_at', null)
      : await supabase.from('session_staff').insert({ session_id: session.id, user_id: user.id, org_id: org.id, role: 'volunteer' })
    setSaving(null)
    if (error) {
      flash(/COMPLIANCE_EXPIRED/.test(error.message || '') ? 'Your checks have expired, so the team needs to update them before you can book.' : 'That did not save. Check your connection and try again.')
      return
    }
    flash(mineRow ? `You are no longer down for ${session.title}.` : `You are down to help at ${session.title}. Thank you!`)
    loadData()
  }

  const todaySessions = sessions.filter(x => x.session_date === today)
  const futureSessions = sessions.filter(x => x.session_date > today)
  const myToday = todaySessions.filter(x => myBookings[x.id])

  const goTab = (t, sub) => { setTab(t); if (sub) setProfileSub(sub) }
  const openQuickModal = (key) => { setForceModal(key); setQuickMenuOpen(true) }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-hover)', display: 'flex', justifyContent: 'center' }}>
    <div style={{ width: '100%', maxWidth: 520, height: '100dvh', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', fontFamily: 'inherit', overflow: 'hidden', position: 'relative', boxShadow: '0 0 70px rgba(15,23,42,0.10)' }}>
      {/* Org bar: the organisation's logo and name, in its colour. */}
      <header style={{ flexShrink: 0, background: brand.hero, color: '#fff', padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <OrgLogo org={org} height={36} maxWidth={120} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org?.name}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffffd9' }}>Volunteer</div>
        </div>
        <button onClick={() => { setForceModal(null); setQuickMenuOpen(true) }} aria-label="Quick actions"
          style={{ width: 44, height: 44, borderRadius: 14, border: '1px solid #ffffff40', background: '#ffffff1f', color: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+</button>
      </header>

      <main ref={scrollRef} className="ls-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'today' && (
          <VPToday
            org={org} user={user} profile={profile} todaySessions={myToday} futureSessions={futureSessions.filter(x => myBookings[x.id])}
            announcements={announcements} primary={primary} teamRows={teamRows} sessionsById={sessionsById}
            onOpenSession={setViewingSession} onNavigate={goTab} onRaiseConcern={() => openQuickModal('concern')}
            onOpenRegister={setRegisterSession}
          />
        )}
        {tab === 'sessions' && (
          <VPSessions sessions={sessions} myBookings={myBookings} volunteerCounts={volunteerCounts} todayStr={today} onOpenSession={setViewingSession} onBook={handleBook} saving={saving} />
        )}
        {tab === 'hours' && <VPHours org={org} profile={profile} teamRows={teamRows} sessionsById={sessionsById} onNavigate={goTab} />}
        {tab === 'messages' && <VPMessages org={org} user={user} primary={primary} />}
        {tab === 'profile' && (
          <VPProfile org={org} user={user} profile={profile} teamRows={teamRows} sessionsById={sessionsById} primary={primary} initialSub={profileSub}
            onSignOut={onSignOut} onProfileUpdated={setProfile} onNavigate={goTab} />
        )}
        {!org?.branding_enabled && <div style={{ textAlign: 'center', padding: '0 0 20px', fontSize: 11.5, color: 'var(--text-faint)' }}>Powered by LaunchSession</div>}
      </main>

      {/* Tab bar */}
      <nav aria-label="Volunteer portal" style={{ flexShrink: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -10px 24px -20px rgba(15,23,42,0.35)', padding: '6px 6px calc(env(safe-area-inset-bottom, 0px) + 6px)', display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`, gap: 2 }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} aria-current={active ? 'page' : undefined}
              style={{ position: 'relative', minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', borderRadius: 14, background: 'none', cursor: 'pointer', color: active ? 'var(--org-ink)' : 'var(--text3)', fontFamily: 'inherit' }}>
              {active && <motion.span layoutId="vpTabPill" aria-hidden="true" style={{ position: 'absolute', inset: '2px 4px', borderRadius: 14, background: 'var(--org-a10, #1B9AAA1a)' }} />}
              <span aria-hidden="true" style={{ position: 'relative', fontSize: 20, lineHeight: 1 }}><Icon name={t.icon} /></span>
              <span style={{ position: 'relative', fontSize: 11.5, fontWeight: 800 }}>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {toast && (
        <div role="status" style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)', background: '#111827', color: '#fff', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, fontWeight: 600, zIndex: 400, boxShadow: '0 12px 30px -12px rgba(0,0,0,0.5)' }}>{toast}</div>
      )}

      <AnimatePresence>
        {viewingSession && (
          <VPSessionDetail session={viewingSession} org={org} user={user} booking={myBookings[viewingSession.id]} volunteerCount={volunteerCounts[viewingSession.id] || 0}
            saving={saving === viewingSession.id} onBook={() => handleBook(viewingSession)}
            onClose={() => setViewingSession(null)} onNavigateTab={t => { setViewingSession(null); goTab(t) }}
            onOpenRegister={() => { setRegisterSession(viewingSession); setViewingSession(null) }} />
        )}
      </AnimatePresence>

      {registerSession && (
        <LiveRegister session={registerSession} org={org} authUserId={user.id} userRole="volunteer"
          backLabel="Back to the portal" onClose={() => { setRegisterSession(null); loadData() }} />
      )}

      <VPQuickActionMenu
        open={quickMenuOpen} onClose={() => { setQuickMenuOpen(false); setForceModal(null) }} forceModal={forceModal}
        org={org} user={user} profile={profile} todaySession={myToday[0] || null} onNavigate={goTab}
        onGoRegister={myToday[0] ? () => setRegisterSession(myToday[0]) : null} onGoMessage={() => setTab('messages')}
      />
    </div>
    </div>
  )
}
