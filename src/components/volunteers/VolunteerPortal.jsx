import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const SPORTS = ['Football','Basketball','Cricket','Tennis','Swimming','Athletics','Gymnastics','Boxing','Rugby','Cycling']
const LANGUAGES = ['Arabic','French','Spanish','Urdu','Bengali','Somali','Polish','Portuguese','Turkish','Punjabi']
const SPORT_ICONS = { Football:'ti-ball-football',Basketball:'ti-ball-basketball',Cricket:'ti-cricket',Tennis:'ti-tennis',Swimming:'ti-swimming',Athletics:'ti-run',Gymnastics:'ti-stretching',Boxing:'ti-box',Rugby:'ti-rugby',Cycling:'ti-bike' }
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const typeConfig = { activity:{color:'#1B9AAA',icon:'ti-run'}, trip:{color:'#417505',icon:'ti-bus'}, workshop:{color:'#F0A500',icon:'ti-tools'}, holiday:{color:'#9B59B6',icon:'ti-beach'} }

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

function VolunteerProfileSetup({ user, org, onComplete }) {
  const [form, setForm] = useState({ full_name:'', phone:'' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const primary = org?.primary_color || '#1B9AAA'
  const handleSave = async () => {
    if (!form.full_name.trim()) return
    setSaving(true)
    await supabase.from('user_profiles').update({ full_name:form.full_name, phone:form.phone, profile_setup_complete:true }).eq('id', user.id)
    onComplete(); setSaving(false)
  }
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #0D1B2A 0%, #1B2A4A 50%, #9B59B6 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:24, width:'100%', maxWidth:420, padding:28, boxShadow:'0 25px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:64, height:64, borderRadius:20, background:primary, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <i className="ti ti-heart-handshake" style={{ fontSize:30, color:'#fff' }} />
          </div>
          <div style={{ fontSize:22, fontWeight:900, fontFamily:'var(--font-display)', color:'var(--black)', marginBottom:6 }}>Welcome!</div>
          <div style={{ fontSize:14, color:'var(--muted)', fontWeight:600 }}>Set up your volunteer profile to get started.</div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:6 }}>Full Name *</label>
          <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Sarah Jones" style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:15, outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:6 }}>Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="07700900000" style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:15, outline:'none', boxSizing:'border-box' }} />
        </div>
        <button onClick={handleSave} disabled={!form.full_name.trim()||saving} style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:form.full_name.trim()?primary:'var(--muted)', color:'#fff', fontSize:16, fontWeight:900, cursor:form.full_name.trim()?'pointer':'default' }}>
          {saving?'Saving...':"Let's Go →"}
        </button>
      </div>
    </div>
  )
}

function VolunteerProfileTab({ user, profile, org, onRefresh }) {
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ full_name:profile?.full_name||'', phone:profile?.phone||'', emergency_contact_name:profile?.emergency_contact_name||'', emergency_contact_phone:profile?.emergency_contact_phone||'', availability:profile?.availability||[], skills:profile?.skills||[], age_groups:profile?.age_groups||[] })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [showPrivate, setShowPrivate] = useState(false)
  const [customSkill, setCustomSkill] = useState('')
  const [hours, setHours] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url||null)
  const photoInputRef = useRef(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    setForm({ full_name:profile?.full_name||'', phone:profile?.phone||'', emergency_contact_name:profile?.emergency_contact_name||'', emergency_contact_phone:profile?.emergency_contact_phone||'', availability:profile?.availability||[], skills:profile?.skills||[], age_groups:profile?.age_groups||[] })
    setPhotoUrl(profile?.photo_url||null)
  }, [profile?.full_name, profile?.phone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) return
    supabase.from('session_staff').select('signed_in_at, signed_out_at').eq('user_id', user.id).then(({ data }) => {
      const signed = (data||[]).filter(r => r.signed_in_at)
      setSessionCount(signed.length)
      const h = signed.reduce((sum, r) => r.signed_in_at&&r.signed_out_at ? sum+(new Date(r.signed_out_at)-new Date(r.signed_in_at))/3600000 : sum+2, 0)
      setHours(Math.round(h*10)/10)
      const weeks = new Set(signed.map(r => { const d=new Date(r.signed_in_at); return Math.floor((d-new Date(d.getFullYear(),0,1))/(7*24*60*60*1000)) }))
      let s=0; const cw=Math.floor((new Date()-new Date(new Date().getFullYear(),0,1))/(7*24*60*60*1000))
      for (let w=cw; weeks.has(w); w--) s++
      setStreak(s)
    })
  }, [user?.id])

  const tier = hours>=100?'Champion':hours>=50?'Gold':hours>=25?'Silver':'Green'
  const tierColor = hours>=100?'#F5D000':hours>=50?'#F0A500':hours>=25?'#C0C0C0':'#4ADE80'
  const nextTierHours = hours>=100?100:hours>=50?100:hours>=25?50:25
  const progress = Math.min((hours/nextTierHours)*100, 100)
  const sports = (form.skills||[]).filter(s => SPORTS.includes(s))
  const languages = (form.skills||[]).filter(s => LANGUAGES.includes(s))
  const customSkills = (form.skills||[]).filter(s => !SPORTS.includes(s)&&!LANGUAGES.includes(s))
  const MESSAGES = ["Every child deserves happiness 💛","Today's memories start with you 🌟","Adventures are possible because of you 🏕","Thank you for being part of our family 😊","You are making a real difference 🎯"]
  const rotatingMsg = MESSAGES[new Date().getDay()%MESSAGES.length]

  const handlePhotoUpload = async (e) => {
    const file=e.target.files[0]; if(!file) return
    const ext=file.name.split('.').pop()
    const { data } = await supabase.storage.from('avatars').upload(`volunteers/${user.id}.${ext}`, file, { upsert:true })
    if (data) {
      const { data:urlData } = supabase.storage.from('avatars').getPublicUrl(`volunteers/${user.id}.${ext}`)
      await supabase.from('user_profiles').update({ photo_url:urlData.publicUrl }).eq('id', user.id)
      setPhotoUrl(urlData.publicUrl); onRefresh()
    }
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) return
    setSaving(true)
    await supabase.from('user_profiles').update({ full_name:form.full_name, phone:form.phone, emergency_contact_name:form.emergency_contact_name, emergency_contact_phone:form.emergency_contact_phone, availability:form.availability, skills:form.skills, age_groups:form.age_groups }).eq('id', user.id)
    setSaving(false); setEditMode(false); setToast(true); setTimeout(()=>setToast(false),3000); onRefresh()
  }

  const toggleSkill = s => set('skills', form.skills.includes(s)?form.skills.filter(x=>x!==s):[...form.skills,s])
  const toggleDay = d => set('availability', form.availability.includes(d)?form.availability.filter(x=>x!==d):[...form.availability,d])
  const toggleAge = a => set('age_groups', (form.age_groups||[]).includes(a)?(form.age_groups||[]).filter(x=>x!==a):[...(form.age_groups||[]),a])
  const addCustomSkill = () => { const s=customSkill.trim(); if(s&&!form.skills.includes(s)){set('skills',[...form.skills,s]);setCustomSkill('')} }

  if (!editMode) return (
    <div>
      {toast&&<div style={{ background:'linear-gradient(135deg,#1B9AAA,#0F6E56)', borderRadius:14, padding:'14px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}><i className="ti ti-circle-check" style={{ fontSize:22, color:'#fff' }} /><div><div style={{ fontSize:13, fontWeight:900, color:'#fff' }}>Profile saved!</div><div style={{ fontSize:11, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>Thank you for being part of our volunteer family</div></div></div>}
      <div style={{ background:'#0D1B2A', borderRadius:22, overflow:'hidden', marginBottom:14 }}>
        <div style={{ background:'linear-gradient(135deg,#1B2A4A 0%,#2D1B69 60%,#9B59B6 100%)', padding:'22px 18px 18px', position:'relative' }}>
          <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(245,208,0,0.1)' }} />
          <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1.5, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}><i className="ti ti-heart" style={{ fontSize:12 }} />{org?.name||'LaunchSession'} · Volunteer Journey</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600, marginBottom:12, fontStyle:'italic' }}>{rotatingMsg}</div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <div style={{ width:72, height:72, borderRadius:20, background:'#9B59B6', border:'3px solid rgba(245,208,0,0.4)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {photoUrl?<img src={photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />:<span style={{ fontSize:24, fontWeight:900, color:'#fff' }}>{(form.full_name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</span>}
              </div>
              <button onClick={()=>photoInputRef.current?.click()} style={{ position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'#F5D000', border:'2px solid #1B2A4A', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-camera" style={{ fontSize:11, color:'#0D1B2A' }} /></button>
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoUpload} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:3 }}>{form.full_name||'Volunteer'}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginBottom:10 }}>{profile?.email}</div>
              <span style={{ background:'rgba(245,208,0,0.2)', borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:800, color:'#F5D000' }}>{tier} Volunteer</span>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
            {[{val:hours.toFixed(1),label:'Hours',color:'#F5D000'},{val:sessionCount,label:'Sessions',color:'#9FE1CB'},{val:streak,label:'Streak',color:'#CECBF6'}].map(s=>(
              <div key={s.label} style={{ background:'rgba(255,255,255,0.07)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:900, color:s.color, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5, marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>{tier==='Champion'?'Legendary!':((nextTierHours-hours).toFixed(1))+'h to '+(tier==='Green'?'Silver':tier==='Silver'?'Gold':'Champion')}</div>
              <div style={{ fontSize:11, color:tierColor, fontWeight:700 }}>{tier}</div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:99, height:6 }}><div style={{ background:'linear-gradient(90deg,#F5D000,#1B9AAA)', width:progress+'%', height:'100%', borderRadius:99 }} /></div>
          </div>
        </div>
      </div>
      {sports.length>0&&<div style={{ background:'#fff', borderRadius:18, border:'1.5px solid var(--border)', padding:'16px', marginBottom:12 }}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}><div style={{ width:30, height:30, borderRadius:9, background:'#F5F0FF', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-bolt" style={{ fontSize:15, color:'#9B59B6' }} /></div><span style={{ fontSize:13, fontWeight:900, color:'var(--black)' }}>My sporting superpowers</span></div><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{sports.map(s=><span key={s} style={{ display:'flex', alignItems:'center', gap:5, background:'#F5F0FF', color:'#534AB7', borderRadius:99, padding:'6px 14px', fontSize:12, fontWeight:800, border:'1.5px solid #AFA9EC' }}>{SPORT_ICONS[s]&&<i className={'ti '+SPORT_ICONS[s]} style={{ fontSize:13 }} />}{s}</span>)}</div></div>}
      {languages.length>0&&<div style={{ background:'#fff', borderRadius:18, border:'1.5px solid var(--border)', padding:'16px', marginBottom:12 }}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}><div style={{ width:30, height:30, borderRadius:9, background:'#E1F5EE', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-world" style={{ fontSize:15, color:'#0F6E56' }} /></div><span style={{ fontSize:13, fontWeight:900, color:'var(--black)' }}>Languages I speak</span></div><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{languages.map(l=><span key={l} style={{ display:'flex', alignItems:'center', gap:5, background:'#E1F5EE', color:'#085041', borderRadius:99, padding:'6px 14px', fontSize:12, fontWeight:800, border:'1.5px solid #5DCAA5' }}><i className="ti ti-language" style={{ fontSize:13 }} />{l}</span>)}</div></div>}
      {customSkills.length>0&&<div style={{ background:'#fff', borderRadius:18, border:'1.5px solid var(--border)', padding:'16px', marginBottom:12 }}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}><div style={{ width:30, height:30, borderRadius:9, background:'#FFF8E6', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-sparkles" style={{ fontSize:15, color:'#F0A500' }} /></div><span style={{ fontSize:13, fontWeight:900, color:'var(--black)' }}>Other skills</span></div><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{customSkills.map(s=><span key={s} style={{ background:'#FFF8E6', color:'#B8860B', borderRadius:99, padding:'6px 14px', fontSize:12, fontWeight:800, border:'1.5px solid #FAC775' }}>{s}</span>)}</div></div>}
      {(form.availability||[]).length>0&&<div style={{ background:'#fff', borderRadius:18, border:'1.5px solid var(--border)', padding:'16px', marginBottom:12 }}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}><div style={{ width:30, height:30, borderRadius:9, background:'#E8F7F9', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-calendar-heart" style={{ fontSize:15, color:'#1B9AAA' }} /></div><span style={{ fontSize:13, fontWeight:900, color:'var(--black)' }}>When I can help</span></div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{(form.availability||[]).map(d=><div key={d} style={{ display:'flex', alignItems:'center', gap:5, background:'#E8F7F9', border:'1.5px solid #1B9AAA', borderRadius:12, padding:'7px 14px' }}><i className="ti ti-sun" style={{ fontSize:13, color:'#1B9AAA' }} /><span style={{ fontSize:12, fontWeight:700, color:'#085041' }}>{d.slice(0,3)}</span></div>)}</div></div>}
      <div style={{ background:'#fff', borderRadius:18, border:'1.5px solid '+(form.emergency_contact_name?'#9FE1CB':'#FFB3B3'), padding:'16px', marginBottom:14 }}>
        <button onClick={()=>setShowPrivate(!showPrivate)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', padding:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:30, height:30, borderRadius:9, background:form.emergency_contact_name?'#EDFAED':'#FFF0F0', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-shield-heart" style={{ fontSize:15, color:form.emergency_contact_name?'#417505':'#C00' }} /></div><div><span style={{ fontSize:13, fontWeight:900, color:'var(--black)' }}>Safeguarding contact</span>{!form.emergency_contact_name&&<div style={{ fontSize:10, color:'#C00', fontWeight:600 }}>Please add a trusted contact</div>}</div></div>
          <i className={'ti ti-chevron-'+(showPrivate?'up':'down')} style={{ fontSize:15, color:'var(--muted)' }} />
        </button>
        {showPrivate&&<div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>{form.emergency_contact_name?<div style={{ background:'#EDFAED', borderRadius:12, padding:'12px 14px', border:'1.5px solid #9FE1CB' }}><div style={{ fontSize:14, fontWeight:800, color:'var(--black)', marginBottom:2 }}>{form.emergency_contact_name}</div><div style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>{form.emergency_contact_phone}</div></div>:<div style={{ fontSize:12, color:'#C00', fontWeight:600, padding:'8px 0' }}>No safeguarding contact added yet.</div>}</div>}
      </div>
      <div style={{ background:'#0D1B2A', borderRadius:18, padding:'16px', marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1.5, marginBottom:12 }}><i className="ti ti-heart" style={{ marginRight:5 }} />Memory Moments</div>
        {[{icon:'ti-beach',color:'#1B9AAA',text:'18 young people enjoyed a beach adventure this week thanks to our volunteers.'},{icon:'ti-ball-football',color:'#417505',text:'42 young people joined our football festival — a record turnout!'},{icon:'ti-mountain',color:'#9B59B6',text:'Our first ski trip gave 12 children their first snow experience.'}].map((m,i)=>(
          <div key={i} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:i<2?'1px solid rgba(255,255,255,0.08)':'none' }}><div style={{ width:34, height:34, borderRadius:10, background:m.color+'30', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={'ti '+m.icon} style={{ fontSize:15, color:m.color }} /></div><div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:600, lineHeight:1.5, flex:1 }}>{m.text}</div></div>
        ))}
      </div>
      <button onClick={()=>setEditMode(true)} style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:'linear-gradient(135deg,#9B59B6,#7B2D8B)', color:'#fff', fontSize:15, fontWeight:900, cursor:'pointer', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><i className="ti ti-pencil" style={{ fontSize:16 }} />Edit my profile</button>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}><div style={{ fontSize:16, fontWeight:900, color:'var(--black)' }}>Edit Profile</div><button onClick={()=>setEditMode(false)} style={{ background:'var(--grey-bg)', border:'none', borderRadius:10, padding:'7px 14px', fontSize:12, fontWeight:700, color:'var(--muted)', cursor:'pointer' }}>Cancel</button></div>
      <SectionCard>
        <SectionHead icon="ti-id-badge" title="About me" filled={!!(form.full_name&&form.phone)} />
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'#9B59B6', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>{photoUrl?<img src={photoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />:<span style={{ fontSize:18, fontWeight:900, color:'#fff' }}>{(form.full_name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</span>}</div>
            <button onClick={()=>photoInputRef.current?.click()} style={{ position:'absolute', bottom:-3, right:-3, width:20, height:20, borderRadius:'50%', background:'#1B9AAA', border:'2px solid #fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-camera" style={{ fontSize:9, color:'#fff' }} /></button>
          </div>
          <div style={{ flex:1 }}><div style={{ fontSize:11, color:'var(--muted)', marginBottom:2 }}>Tap camera to change photo</div><div style={{ fontSize:12, fontWeight:600, color:'var(--muted)' }}>{profile?.email}</div></div>
        </div>
        <div style={{ marginBottom:10 }}><label style={{ fontSize:10, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Your name *</label><input value={form.full_name} onChange={e=>set('full_name',e.target.value)} style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:14, outline:'none', boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Phone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="07700900000" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:14, outline:'none', boxSizing:'border-box' }} /></div>
      </SectionCard>
      <SectionCard borderColor={form.emergency_contact_name&&form.emergency_contact_phone?'#9FE1CB':'#FFB3B3'}>
        <SectionHead icon="ti-heart" title="Backup contact" filled={!!(form.emergency_contact_name&&form.emergency_contact_phone)} />
        <div style={{ marginBottom:10 }}><label style={{ fontSize:10, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Contact name</label><input value={form.emergency_contact_name} onChange={e=>set('emergency_contact_name',e.target.value)} placeholder="e.g. Jane Smith" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:14, outline:'none', boxSizing:'border-box' }} /></div>
        <div><label style={{ fontSize:10, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Their number</label><input value={form.emergency_contact_phone} onChange={e=>set('emergency_contact_phone',e.target.value)} placeholder="07700900000" style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:14, outline:'none', boxSizing:'border-box' }} /></div>
      </SectionCard>
      <SectionCard>
        <SectionHead icon="ti-calendar-time" title="When I show up" filled={(form.availability||[]).length>0} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{DAYS.map(d=>{const on=form.availability.includes(d);return<button key={d} onClick={()=>toggleDay(d)} style={{ padding:'8px 14px', borderRadius:99, border:on?'2px solid #1B9AAA':'1.5px solid var(--border)', background:on?'#E8F7F9':'#fff', fontSize:12, fontWeight:700, color:on?'#1B9AAA':'var(--muted)', cursor:'pointer' }}>{d.slice(0,3)}</button>})}</div>
      </SectionCard>
      <SectionCard>
        <SectionHead icon="ti-users-group" title="Age groups I love" filled={(form.age_groups||[]).length>0} />
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>{['4-6','7-9','10-12','All ages'].map(a=>{const on=(form.age_groups||[]).includes(a);return<button key={a} onClick={()=>toggleAge(a)} style={{ padding:'8px 16px', borderRadius:99, border:on?'2px solid #F0A500':'1.5px solid var(--border)', background:on?'#FFF8E6':'#fff', fontSize:12, fontWeight:700, color:on?'#B8860B':'var(--muted)', cursor:'pointer' }}>{a}</button>})}</div>
      </SectionCard>
      <SectionCard>
        <SectionHead icon="ti-trophy" title="Skills & languages" filled={(form.skills||[]).length>0} />
        <div style={{ fontSize:10, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Sports</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>{SPORTS.map(s=>{const on=form.skills.includes(s);return<button key={s} onClick={()=>toggleSkill(s)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:99, border:on?'2px solid #9B59B6':'1.5px solid var(--border)', background:on?'#F5F0FF':'#fff', fontSize:12, fontWeight:700, color:on?'#9B59B6':'var(--muted)', cursor:'pointer' }}>{SPORT_ICONS[s]&&<i className={'ti '+SPORT_ICONS[s]} style={{ fontSize:13 }} />}{s}</button>})}</div>
        <div style={{ fontSize:10, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Languages</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>{LANGUAGES.map(l=>{const on=form.skills.includes(l);return<button key={l} onClick={()=>toggleSkill(l)} style={{ padding:'6px 12px', borderRadius:99, border:on?'2px solid #1B9AAA':'1.5px solid var(--border)', background:on?'#E8F7F9':'#fff', fontSize:12, fontWeight:700, color:on?'#1B9AAA':'var(--muted)', cursor:'pointer' }}>{l}</button>})}</div>
        <div style={{ display:'flex', gap:8 }}><input value={customSkill} onChange={e=>setCustomSkill(e.target.value)} placeholder="Add another skill..." onKeyDown={e=>e.key==='Enter'&&addCustomSkill()} style={{ flex:1, padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--border)', fontSize:13, outline:'none' }} /><button onClick={addCustomSkill} style={{ padding:'8px 16px', borderRadius:10, border:'none', background:'#9B59B6', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Add</button></div>
        {customSkills.length>0&&<div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>{customSkills.map(s=><div key={s} style={{ display:'flex', alignItems:'center', gap:4, background:'#F5F0FF', border:'1.5px solid #D4B8F0', borderRadius:99, padding:'4px 10px', fontSize:12, fontWeight:700, color:'#9B59B6' }}>{s}<button onClick={()=>toggleSkill(s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B59B6', fontSize:14, padding:0, lineHeight:1 }}>×</button></div>)}</div>}
      </SectionCard>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginBottom:20 }}>
        <button onClick={()=>setEditMode(false)} style={{ padding:14, borderRadius:14, border:'1.5px solid var(--border)', background:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', color:'var(--muted)' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving||!form.full_name.trim()} style={{ padding:14, borderRadius:14, border:'none', background:!form.full_name.trim()?'var(--muted)':'#9B59B6', color:'#fff', fontSize:15, fontWeight:900, cursor:form.full_name.trim()?'pointer':'default' }}>{saving?'Saving...':'Save my profile'}</button>
      </div>
    </div>
  )
}

function BookTab({ futureSessions, sessionSignups, volunteerCounts, saving, handleBook, today }) {
  const [bookFilter, setBookFilter] = useState('all')
  const [bookConfirm, setBookConfirm] = useState(null)
  const [bookSuccess, setBookSuccess] = useState(null)
  const filteredSessions = futureSessions.filter(s => { if(bookFilter==='all') return true; if(bookFilter==='today') return s.date===today; if(bookFilter==='week'){const d=new Date(s.date+'T00:00:00');return(d-new Date())/(1000*60*60*24)<=7} return s.session_type===bookFilter })
  const confirmedBookings = futureSessions.filter(s => sessionSignups[s.id]==='confirmed')
  const pendingBookings = futureSessions.filter(s => sessionSignups[s.id]==='pending')
  const available = filteredSessions.filter(s => !sessionSignups[s.id])
  const doBook = async s => { setBookConfirm(null); await handleBook(s); setBookSuccess(s); setTimeout(()=>setBookSuccess(null),3500) }
  const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}):''

  return (
    <div>
      {bookSuccess&&<div style={{ background:'linear-gradient(135deg,#417505,#1B9AAA)', borderRadius:16, padding:'16px 18px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}><div style={{ width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className="ti ti-confetti" style={{ fontSize:22, color:'#fff' }} /></div><div><div style={{ fontSize:15, fontWeight:900, color:'#fff' }}>Session booked!</div><div style={{ fontSize:11, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>Thank you for helping create happy memories</div></div></div>}
      <div style={{ marginBottom:16 }}><div style={{ fontSize:20, fontWeight:900, color:'var(--black)', marginBottom:4 }}>Find Your Next Session</div><div style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>Join a session and help create happy memories</div></div>
      <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4, marginBottom:16, scrollbarWidth:'none' }}>
        {[{key:'all',label:'All',icon:'ti-heart'},{key:'today',label:'Today',icon:'ti-sun'},{key:'week',label:'This Week',icon:'ti-calendar-week'},{key:'activity',label:'Sports',icon:'ti-ball-football'},{key:'trip',label:'Trips',icon:'ti-bus'},{key:'workshop',label:'Creative',icon:'ti-palette'}].map(f=>(
          <button key={f.key} onClick={()=>setBookFilter(f.key)} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:99, border:bookFilter===f.key?'2px solid #1B9AAA':'1.5px solid var(--border)', background:bookFilter===f.key?'#E8F7F9':'#fff', fontSize:12, fontWeight:700, color:bookFilter===f.key?'#085041':'var(--muted)', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}><i className={'ti '+f.icon} style={{ fontSize:13 }} />{f.label}</button>
        ))}
      </div>
      {confirmedBookings.length>0&&<div style={{ marginBottom:20 }}><div style={{ fontSize:12, fontWeight:900, color:'#417505', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>✅ My Confirmed Sessions</div>{confirmedBookings.map(s=>{const cfg=typeConfig[s.session_type]||typeConfig.activity;const days=Math.ceil((new Date(s.date+'T00:00:00')-new Date())/(1000*60*60*24));return(<div key={s.id} style={{ background:'linear-gradient(135deg,#EDFAED,#E8F7F9)', borderRadius:14, border:'2px solid #417505', padding:'13px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}><div style={{ width:42, height:42, borderRadius:12, background:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={'ti '+cfg.icon} style={{ fontSize:18, color:'#fff' }} /></div><div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:800, color:'var(--black)', marginBottom:2 }}>{s.title}</div><div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>{fmtDate(s.date)} · {s.start_time}</div></div><div style={{ textAlign:'center', flexShrink:0 }}><div style={{ fontSize:18, fontWeight:900, color:'#417505', lineHeight:1 }}>{days<=0?'Today!':days}</div>{days>0&&<div style={{ fontSize:9, color:'#417505', fontWeight:700, textTransform:'uppercase' }}>days</div>}</div></div>)})}</div>}
      {pendingBookings.length>0&&<div style={{ marginBottom:20 }}><div style={{ fontSize:12, fontWeight:900, color:'#B8860B', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>⏳ Awaiting Confirmation</div>{pendingBookings.map(s=>{const cfg=typeConfig[s.session_type]||typeConfig.activity;return(<div key={s.id} style={{ background:'#FFFBE6', borderRadius:14, border:'1.5px solid #F5D000', padding:'13px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}><div style={{ width:42, height:42, borderRadius:12, background:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={'ti '+cfg.icon} style={{ fontSize:18, color:'#fff' }} /></div><div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:800, color:'var(--black)', marginBottom:2 }}>{s.title}</div><div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>{fmtDate(s.date)} · {s.start_time}</div></div><span style={{ background:'#FFF8E6', color:'#B8860B', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:800, border:'1.5px solid #F5D000' }}>Pending</span></div>)})}</div>}
      <div style={{ fontSize:12, fontWeight:900, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:12 }}>🧭 Available ({available.length})</div>
      {available.length===0?<div style={{ background:'#0D1B2A', borderRadius:18, padding:'28px 20px', textAlign:'center' }}><div style={{ fontSize:15, fontWeight:900, color:'#fff', marginBottom:6 }}>No sessions here!</div><div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600 }}>Try a different filter.</div></div>:available.map((s,idx)=>{const cfg=typeConfig[s.session_type]||typeConfig.activity;const isSaving=saving===s.id;const dateLabel=s.date===today?'Today':fmtDate(s.date);const count=volunteerCounts[s.id]||0;const limit=s.volunteer_limit;const isFull=limit&&count>=limit;const spotsLeft=limit?limit-count:null;const isFeatured=idx===0;return(<div key={s.id} style={{ background:isFeatured?'#0D1B2A':'#fff', borderRadius:18, border:isFeatured?'none':'1.5px solid var(--border)', padding:'16px', marginBottom:12, overflow:'hidden', position:'relative' }}>{isFeatured&&<div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#F5D000,#1B9AAA)' }} />}<div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}><div style={{ width:52, height:52, borderRadius:14, background:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={'ti '+cfg.icon} style={{ fontSize:24, color:'#fff' }} /></div><div style={{ flex:1 }}>{isFeatured&&<div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Featured Session</div>}<div style={{ fontSize:16, fontWeight:900, color:isFeatured?'#fff':'var(--black)', marginBottom:6 }}>{s.title}</div><div style={{ display:'flex', flexDirection:'column', gap:3 }}><div style={{ fontSize:12, color:isFeatured?'rgba(255,255,255,0.7)':'var(--muted)' }}>📅 {dateLabel}</div>{s.start_time&&<div style={{ fontSize:12, color:isFeatured?'rgba(255,255,255,0.7)':'var(--muted)' }}>🕐 {s.start_time}{s.end_time?` – ${s.end_time}`:''}</div>}{s.location&&<div style={{ fontSize:12, color:isFeatured?'rgba(255,255,255,0.7)':'var(--muted)' }}>📍 {s.location.split(',')[0]}</div>}</div></div></div>{spotsLeft!==null&&<div style={{ marginBottom:12 }}><span style={{ background:isFull?'#FFF0F0':'#EDFAED', color:isFull?'#C00':'#417505', borderRadius:99, padding:'4px 10px', fontSize:11, fontWeight:800 }}>{isFull?'Full':`${spotsLeft} spot${spotsLeft!==1?'s':''} left`}</span></div>}<button onClick={()=>!isFull&&setBookConfirm(s)} disabled={isSaving||isFull} style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background:isFull?(isFeatured?'rgba(255,255,255,0.1)':'#f0f0f0'):isFeatured?'#F5D000':'#9B59B6', color:isFull?(isFeatured?'rgba(255,255,255,0.4)':'var(--muted)'):isFeatured?'#0D1B2A':'#fff', fontSize:14, fontWeight:900, cursor:isFull?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>{isSaving?'...':(isFull?'Session Full':<><i className="ti ti-heart-plus" style={{ fontSize:15 }} />{isFeatured?'Join This Session':'Join Session'}</>)}</button></div>)})}
      {bookConfirm&&<div onClick={()=>setBookConfirm(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'flex-end' }}><div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', padding:'20px 20px 32px' }}><div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 16px' }} /><div style={{ fontSize:16, fontWeight:900, marginBottom:8 }}>Book this session?</div><div style={{ fontSize:14, color:'var(--muted)', fontWeight:600, marginBottom:20 }}>{bookConfirm.title} · {fmtDate(bookConfirm.date)}</div><button onClick={()=>doBook(bookConfirm)} style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#9B59B6,#1B9AAA)', color:'#fff', fontSize:15, fontWeight:900, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}><i className="ti ti-heart-plus" style={{ fontSize:16 }} />Confirm Booking</button><button onClick={()=>setBookConfirm(null)} style={{ width:'100%', padding:'12px', borderRadius:14, border:'1.5px solid var(--border)', background:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', color:'var(--muted)' }}>Cancel</button></div></div>}
    </div>
  )
}

function RegisterTab({ userId }) {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(null)
  const today = new Date().toISOString().split('T')[0]
  const fetchAttendance = async () => {
    const { data } = await supabase.from('session_staff').select('*, session:sessions(title, date, start_time, end_time)').eq('user_id', userId).order('created_at',{ascending:false}).limit(20)
    setAttendance(data||[]); setLoading(false)
  }
  useEffect(() => { if(!userId) return; fetchAttendance(); const iv=setInterval(fetchAttendance,5000); return ()=>clearInterval(iv) }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalHours = attendance.reduce((sum,a)=>a.signed_in_at&&a.signed_out_at?sum+(new Date(a.signed_out_at)-new Date(a.signed_in_at))/3600000:sum+(a.signed_in_at?2:0),0)
  const youngPeople = Math.round(totalHours*2)
  const completed = attendance.filter(a=>a.signed_in_at)
  const handleSignIn = async r => { setSigningIn(r.id); await supabase.from('session_staff').update({signed_in_at:new Date().toISOString()}).eq('id',r.id); await fetchAttendance(); setSigningIn(null) }
  const handleSignOut = async r => { setSigningIn(r.id); await supabase.from('session_staff').update({signed_out_at:new Date().toISOString()}).eq('id',r.id); await fetchAttendance(); setSigningIn(null) }
  const fmtTime = ts => ts?new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):null
  const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}):''
  if (loading) return <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>Loading...</div>
  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#0D1B2A 0%,#1B2A4A 100%)', borderRadius:20, padding:'20px', marginBottom:20, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'rgba(27,154,170,0.15)' }} />
        <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1.5, marginBottom:12, display:'flex', alignItems:'center', gap:5 }}><i className="ti ti-heart" style={{ fontSize:11 }} />MY IMPACT</div>
        <div style={{ marginBottom:14 }}><div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4 }}><div style={{ fontSize:48, fontWeight:900, color:'#F5D000', lineHeight:1 }}>{youngPeople}</div><div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.6)' }}>young people</div></div><div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', fontWeight:500, lineHeight:1.5 }}>Thanks to your support, you've helped create happy memories for young people. ❤️</div></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:12, padding:'12px' }}><div style={{ fontSize:22, fontWeight:900, color:'#1B9AAA', lineHeight:1, marginBottom:4 }}>{totalHours.toFixed(1)}</div><div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5 }}>⏱️ Hours Given</div></div>
          <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:12, padding:'12px' }}><div style={{ fontSize:22, fontWeight:900, color:'#C9860F', lineHeight:1, marginBottom:4 }}>{completed.length}</div><div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5 }}>✅ Sessions Done</div></div>
        </div>
        <div style={{ background:'rgba(27,154,170,0.15)', borderRadius:12, padding:'10px 12px', border:'1px solid rgba(27,154,170,0.3)' }}><div style={{ fontSize:10, fontWeight:800, color:'#1B9AAA', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>💬 Impact moment</div><div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', fontWeight:500, lineHeight:1.5, fontStyle:'italic' }}>"Every hour you give helps children build confidence, friendships and lifelong memories."</div></div>
      </div>
      <div style={{ fontSize:14, fontWeight:900, color:'var(--black)', marginBottom:14, textTransform:'uppercase', letterSpacing:0.8 }}>Session Log</div>
      {attendance.length===0?<div style={{ background:'#fff', borderRadius:16, border:'1.5px solid var(--border)', padding:'32px', textAlign:'center', color:'var(--muted)' }}><i className="ti ti-clock-off" style={{ fontSize:36, display:'block', marginBottom:8 }} /><div style={{ fontSize:14, fontWeight:700 }}>No hours logged yet</div><div style={{ fontSize:12, marginTop:4 }}>Book sessions to start logging hours</div></div>:attendance.map(a=>{const sIn=!!a.signed_in_at;const sOut=!!a.signed_out_at;const hrs=sIn&&sOut?((new Date(a.signed_out_at)-new Date(a.signed_in_at))/3600000).toFixed(1):null;return(<div key={a.id} style={{ background:'#fff', borderRadius:14, border:'1.5px solid var(--border)', padding:'14px 16px', marginBottom:10 }}><div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}><div><div style={{ fontSize:15, fontWeight:800, color:'var(--black)', marginBottom:2 }}>{a.session?.title||'Session'}</div><div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', display:'flex', gap:8 }}>{a.session?.date&&<span>📅 {fmtDate(a.session.date)}</span>}{a.session?.start_time&&<span>🕐 {a.session.start_time}</span>}</div></div>{hrs&&<div style={{ background:'#E8F7F9', borderRadius:10, padding:'6px 12px', textAlign:'center' }}><div style={{ fontSize:16, fontWeight:900, color:'#1B9AAA' }}>{hrs}h</div></div>}</div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{sIn&&<span style={{ fontSize:11, fontWeight:700, color:'#417505', background:'#EDFAED', borderRadius:20, padding:'3px 10px' }}>✓ In {fmtTime(a.signed_in_at)}</span>}{sOut&&<span style={{ fontSize:11, fontWeight:700, color:'#1B9AAA', background:'#E8F7F9', borderRadius:20, padding:'3px 10px' }}>✓ Out {fmtTime(a.signed_out_at)}</span>}{!sIn&&a.session?.date===today&&<button onClick={()=>handleSignIn(a)} disabled={signingIn===a.id} style={{ padding:'6px 14px', borderRadius:20, border:'none', background:'#417505', color:'#fff', fontSize:11, fontWeight:800, cursor:'pointer' }}>{signingIn===a.id?'...':'Sign In'}</button>}{sIn&&!sOut&&<button onClick={()=>handleSignOut(a)} disabled={signingIn===a.id} style={{ padding:'6px 14px', borderRadius:20, border:'none', background:'#1B9AAA', color:'#fff', fontSize:11, fontWeight:800, cursor:'pointer' }}>{signingIn===a.id?'...':'Sign Out'}</button>}</div></div>)})}
    </div>
  )
}

function RotaTab({ rota, today }) {
  const upcoming = rota.filter(r => r.session?.date >= today)
  const past = rota.filter(r => r.session?.date < today)
  const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}):''
  return (
    <div>
      <div style={{ fontSize:20, fontWeight:900, color:'var(--black)', marginBottom:4 }}>My Rota</div>
      <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:16 }}>Sessions you are booked into</div>
      {upcoming.length===0&&past.length===0?<div style={{ background:'#0D1B2A', borderRadius:18, padding:'28px 20px', textAlign:'center' }}><div style={{ fontSize:15, fontWeight:900, color:'#fff', marginBottom:6 }}>No sessions booked yet</div><div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600 }}>Head to the Book tab to find sessions.</div></div>:<div>{upcoming.length>0&&<div style={{ marginBottom:24 }}><div style={{ fontSize:12, fontWeight:900, color:'#417505', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>📅 Upcoming ({upcoming.length})</div>{upcoming.map(r=>{const cfg=typeConfig[r.session?.session_type]||typeConfig.activity;const days=Math.ceil((new Date(r.session?.date+'T00:00:00')-new Date())/(1000*60*60*24));return(<div key={r.id} style={{ background:'#fff', borderRadius:16, border:'1.5px solid var(--border)', padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12 }}><div style={{ width:46, height:46, borderRadius:13, background:cfg.color+'20', border:'1.5px solid '+cfg.color+'40', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={'ti '+cfg.icon} style={{ fontSize:20, color:cfg.color }} /></div><div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:800, color:'var(--black)', marginBottom:3 }}>{r.session?.title}</div><div style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>{fmtDate(r.session?.date)}</div><div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>🕐 {r.session?.start_time} – {r.session?.end_time}</div></div><div style={{ textAlign:'center', flexShrink:0 }}><div style={{ fontSize:20, fontWeight:900, color:days<=1?'#C00':'#417505', lineHeight:1 }}>{days<=0?'Today!':days}</div>{days>0&&<div style={{ fontSize:9, color:'var(--muted)', fontWeight:700, textTransform:'uppercase' }}>days</div>}</div></div>)})}</div>}{past.length>0&&<div><div style={{ fontSize:12, fontWeight:900, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 }}>Past Sessions</div>{past.slice(0,5).map(r=><div key={r.id} style={{ background:'#F9F9F9', borderRadius:14, border:'1.5px solid var(--border)', padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, opacity:0.7 }}><i className="ti ti-calendar-check" style={{ fontSize:18, color:'var(--muted)' }} /><div><div style={{ fontSize:13, fontWeight:700, color:'var(--black)' }}>{r.session?.title}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{fmtDate(r.session?.date)}</div></div></div>)}</div>}</div>}
    </div>
  )
}

export default function VolunteerPortal() {
  const [authUser, setAuthUser] = useState(null)
  const [org, setOrg] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('login')
  const [navTab, setNavTab] = useState('today')
  const [form, setForm] = useState({ email:'', password:'', full_name:'', confirm:'' })
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [todaySessions, setTodaySessions] = useState([])
  const [futureSessions, setFutureSessions] = useState([])
  const [sessionSignups, setSessionSignups] = useState({})
  const [volunteerCounts, setVolunteerCounts] = useState({})
  const [sessionVolCounts, setSessionVolCounts] = useState({})
  const [rota, setRota] = useState([])
  const [volunteerHours, setVolunteerHours] = useState(0)
  const [volunteerSessions, setVolunteerSessions] = useState(0)
  const [streak, setStreak] = useState(0)
  const [saving, setSaving] = useState(null)
  const [imgFailed, setImgFailed] = useState(false)
  const [localPhotoUrl] = useState(null)
  const [showCFC, setShowCFC] = useState(false)

  const slug = window.location.pathname.split('/volunteer/')[1]?.split('/')[0]
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'Organisation'
  const today = new Date().toISOString().split('T')[0]
  const currentPhotoUrl = localPhotoUrl || profile?.photo_url

  useEffect(() => { if(slug) supabase.from('organisations').select('*').eq('slug',slug).single().then(({data})=>{if(data) setOrg(data)}) }, [slug])
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}})=>{setAuthUser(session?.user||null);setLoading(false)})
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e,s)=>setAuthUser(s?.user||null))
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => { if(authUser&&org) validateAndLoad() }, [authUser, org]) // eslint-disable-line react-hooks/exhaustive-deps

  async function validateAndLoad() {
    const {data:p} = await supabase.from('user_profiles').select('*').eq('id',authUser.id).eq('org_id',org.id).eq('role','volunteer').single()
    if(!p){await supabase.auth.signOut();setAuthUser(null);setView('login');setError('This account does not have volunteer access for this organisation.');return}
    if(p.status==='pending'){setProfile(p);setView('pending');return}
    setProfile(p);setView('dashboard');loadDashboardData(p)
  }

  async function loadDashboardData(p) {
    const uid=p?.id||authUser?.id; const orgId=p?.org_id||org?.id
    const [{data:todaySess},{data:future},{data:ss}] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id',orgId).eq('date',today).order('start_time'),
      supabase.from('sessions').select('*').eq('org_id',orgId).gte('date',today).order('date').limit(30),
      supabase.from('session_staff').select('*, session:sessions(title, date, start_time, end_time, location)').eq('user_id',uid),
    ])
    setTodaySessions(todaySess||[]); setFutureSessions(future||[])
    const signupMap={}; const rotaList=[]
    ;(ss||[]).forEach(r=>{signupMap[r.session_id]=r.status||'confirmed';rotaList.push(r)})
    setSessionSignups(signupMap); setRota(rotaList)
    if(future?.length){const ids=future.map(s=>s.id);const{data:vc}=await supabase.from('session_staff').select('session_id').in('session_id',ids);const counts={};(vc||[]).forEach(r=>{counts[r.session_id]=(counts[r.session_id]||0)+1});setVolunteerCounts(counts)}
    const signed=(ss||[]).filter(r=>r.signed_in_at)
    setVolunteerSessions(signed.length)
    const h=signed.reduce((sum,r)=>r.signed_in_at&&r.signed_out_at?sum+(new Date(r.signed_out_at)-new Date(r.signed_in_at))/3600000:sum+2,0)
    setVolunteerHours(Math.round(h*10)/10)
    const weeks=new Set(signed.map(r=>{const d=new Date(r.signed_in_at);return Math.floor((d-new Date(d.getFullYear(),0,1))/(7*24*60*60*1000))}))
    let s=0;const cw=Math.floor((new Date()-new Date(new Date().getFullYear(),0,1))/(7*24*60*60*1000));for(let w=cw;weeks.has(w);w--)s++;setStreak(s)
    if(todaySess?.length){const ids=todaySess.map(s=>s.id);const{data:vc2}=await supabase.from('session_staff').select('session_id').in('session_id',ids);const c={};(vc2||[]).forEach(r=>{c[r.session_id]=(c[r.session_id]||0)+1});setSessionVolCounts(c)}
  }

  const refreshProfile = async () => { const{data}=await supabase.from('user_profiles').select('*').eq('id',authUser.id).single(); if(data) setProfile(data) }
  const handleBook = async (session) => {
    setSaving(session.id); const booked=sessionSignups[session.id]
    if(booked){await supabase.from('session_staff').delete().eq('session_id',session.id).eq('user_id',authUser.id);setSessionSignups(prev=>{const n={...prev};delete n[session.id];return n})}
    else{await supabase.from('session_staff').insert({session_id:session.id,user_id:authUser.id,org_id:org.id,status:'pending'});setSessionSignups(prev=>({...prev,[session.id]:'pending'}))}
    setSaving(null)
  }
  const handleSignOut = async () => { await supabase.auth.signOut(); setAuthUser(null); setProfile(null); setView('login') }

  async function handleLogin(e) {
    e.preventDefault();setAuthLoading(true);setError('')
    const{error}=await supabase.auth.signInWithPassword({email:form.email,password:form.password})
    if(error){setError(error.message);setAuthLoading(false)}
  }
  async function handleRegister(e) {
    e.preventDefault()
    if(form.password!==form.confirm){setError('Passwords do not match');return}
    if(form.password.length<6){setError('Password must be at least 6 characters');return}
    setAuthLoading(true);setError('')
    const{data,error}=await supabase.auth.signUp({email:form.email,password:form.password})
    if(error){if(error.message.toLowerCase().includes('already registered')||error.message.toLowerCase().includes('already exists')){setAuthLoading(false);setView('login');setError('You already have an account. Please sign in.');return}setError(error.message);setAuthLoading(false);return}
    if(data.user){await supabase.from('user_profiles').upsert({id:data.user.id,full_name:form.full_name,email:form.email,org_id:org.id,role:'volunteer',status:'pending',onboarding_complete:true})}
    setAuthLoading(false);setView('pending')
  }

  const iS = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginTop:6 }
  const lS = { fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)', display:'block' }

  const OrgBadge = () => (
    <div style={{ textAlign:'center', marginBottom:32 }}>
      <div style={{ width:64, height:64, borderRadius:18, background:`linear-gradient(135deg,${primary},${primary}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 14px', overflow:'hidden' }}>
        {org?.logo_url?<img src={org.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />:'🚀'}
      </div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', margin:'0 0 4px' }}>{orgName}</h1>
      <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', margin:0 }}>Volunteer Portal</p>
    </div>
  )

  if(loading) return <div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:36, height:36, border:`3px solid ${primary}`, borderTop:'3px solid transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  if(view==='pending') return (<div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}><div style={{ width:'100%', maxWidth:400, textAlign:'center' }}><OrgBadge /><div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:20, padding:28 }}><div style={{ fontSize:36, marginBottom:12 }}>⏳</div><div style={{ fontSize:18, fontWeight:800, color:'#f1f5f9', marginBottom:8 }}>Awaiting approval</div><div style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.6 }}>Your volunteer request has been sent to {orgName}. You'll receive access once an admin approves your account.</div></div><button onClick={handleSignOut} style={{ marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>Sign out</button></div></div>)

  if(view==='register') return (
    <div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400 }}><OrgBadge />
        <form onSubmit={handleRegister} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:28 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#f1f5f9', marginBottom:4 }}>Create volunteer account</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:20 }}>Your request will be reviewed by {orgName} before you can access sessions.</div>
          {[['Full name','text','full_name','Jane Smith'],['Email','email','email','jane@email.com'],['Password','password','password','••••••••'],['Confirm password','password','confirm','••••••••']].map(([label,type,key,ph])=>(<div key={key} style={{ marginBottom:14 }}><label style={lS}>{label}</label><input type={type} placeholder={ph} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required style={iS} /></div>))}
          {error&&<div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#FCA5A5', marginBottom:14 }}>{error}</div>}
          <button type="submit" disabled={authLoading} style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:`linear-gradient(135deg,${primary},${primary}bb)`, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', marginTop:4, opacity:authLoading?0.7:1 }}>{authLoading?'Registering...':'Request access →'}</button>
          <button type="button" onClick={()=>{setView('login');setError('')}} style={{ width:'100%', marginTop:10, padding:10, background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:13, cursor:'pointer' }}>Already have an account? Sign in</button>
        </form>
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.15)', marginTop:20 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  if(view==='login') return (
    <div style={{ minHeight:'100vh', background:'#080D1A', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:400 }}><OrgBadge />
        <form onSubmit={handleLogin} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:28 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'#f1f5f9', marginBottom:4 }}>Welcome back</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:20 }}>Sign in to your volunteer account</div>
          <div style={{ marginBottom:14 }}><label style={lS}>Email</label><input type="email" placeholder="your@email.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required style={iS} /></div>
          <div style={{ marginBottom:20 }}><label style={lS}>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required style={iS} /></div>
          {error&&<div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#FCA5A5', marginBottom:14 }}>{error}</div>}
          <button type="submit" disabled={authLoading} style={{ width:'100%', padding:13, borderRadius:12, border:'none', background:`linear-gradient(135deg,${primary},${primary}bb)`, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', opacity:authLoading?0.7:1 }}>{authLoading?'Signing in...':'Sign in →'}</button>
          <button type="button" onClick={()=>{setView('register');setError('')}} style={{ width:'100%', marginTop:10, padding:10, background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:13, cursor:'pointer' }}>New volunteer? Register here</button>
        </form>
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.15)', marginTop:20 }}>Powered by LaunchSession</p>
      </div>
    </div>
  )

  if(profile&&!profile.profile_setup_complete) return <VolunteerProfileSetup user={authUser} org={org} onComplete={()=>{refreshProfile();setNavTab('today')}} />

  const greetingWord = (()=>{const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'})()
  const dayMsg = ["Every child deserves happiness 💛","Today's adventure starts with you.","You're helping create memories that last forever.","Thank you for being part of our family.","Small acts of kindness change lives."][new Date().getDay()%5]

  return (
    <div style={{ minHeight:'100vh', background:'#F5F5F5', display:'flex', flexDirection:'column', paddingTop:'calc(env(safe-area-inset-top) + 6px)', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ height:4, display:'flex' }}>{['#1B9AAA','#F5D000','#417505','#9B59B6','#E91E8C'].map((c,i)=><div key={i} style={{ flex:1, background:c }} />)}</div>
      <div style={{ background:'#0D1B2A', padding:'12px 18px 0', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(245,208,0,0.06)' }} />
        <div style={{ position:'absolute', bottom:20, left:-30, width:100, height:100, borderRadius:'50%', background:'rgba(27,154,170,0.1)' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            {!imgFailed?<img src={org?.logo_url||'/logo-horizontal.png'} alt={orgName} style={{ height:26 }} onError={()=>setImgFailed(true)} />:<div style={{ fontWeight:900, fontSize:12, color:'#F5D000', letterSpacing:1 }}>{orgName.toUpperCase()}</div>}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div onClick={()=>setNavTab('profile')} style={{ width:40, height:40, borderRadius:'50%', background:currentPhotoUrl?'transparent':'#9B59B6', border:'2px solid rgba(245,208,0,0.4)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                {currentPhotoUrl?<img src={currentPhotoUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />:<span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{(profile?.full_name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</span>}
              </div>
              <button onClick={handleSignOut} style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', background:'transparent', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, padding:'5px 12px', cursor:'pointer' }}>Sign Out</button>
            </div>
          </div>
          <div style={{ marginBottom:6 }}>
            <div style={{ fontSize:24, fontWeight:900, color:'#fff', lineHeight:1.1, marginBottom:6 }}>{greetingWord}, {profile?.full_name?.split(' ')[0]||'there'}! 👋</div>
            <div style={{ fontSize:12, color:'#F5D000', fontWeight:700, marginBottom:12 }}>{dayMsg}</div>
          </div>
          <div style={{ display:'flex', gap:0, margin:'16px -18px 0', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
            {[{val:todaySessions.length||0,label:'Today',color:'#F5D000'},{val:Object.keys(sessionSignups).length,label:'Booked',color:'#fff'},{val:rota.filter(r=>r.session?.date>=today).length,label:'Upcoming',color:'#9FE1CB'}].map((s,i)=>(
              <div key={s.label} style={{ flex:1, padding:'12px 0', textAlign:'center', borderRight:i<2?'1px solid rgba(255,255,255,0.08)':'none' }}>
                <div style={{ fontSize:20, fontWeight:900, color:s.color, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5, marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid var(--border)', display:'flex', zIndex:100, paddingBottom:'env(safe-area-inset-bottom,0px)' }}>
        {[{key:'today',icon:'ti-home',label:'Today'},{key:'sessions',icon:'ti-calendar-event',label:'Book'},{key:'rota',icon:'ti-clipboard-list',label:'My Rota'},{key:'register',icon:'ti-heart',label:'Impact'},{key:'profile',icon:'ti-user-circle',label:'Profile'}].map(t=>(
          <button key={t.key} onClick={()=>setNavTab(t.key)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'10px 8px', background:'none', border:'none', cursor:'pointer', borderTop:navTab===t.key?`2px solid ${primary}`:'2px solid transparent' }}>
            <i className={'ti '+t.icon} style={{ fontSize:22, color:navTab===t.key?primary:'var(--muted)' }} />
            <span style={{ fontSize:9, fontWeight:800, color:navTab===t.key?primary:'var(--muted)', textTransform:'uppercase', letterSpacing:0.3 }}>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 100px' }}>
        {navTab==='today'&&(
          <div>
            <button onClick={()=>setShowCFC(true)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#FFF0F0', border:'1.5px solid #FFB3B3', borderRadius:14, cursor:'pointer', marginBottom:16, textAlign:'left' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#C00', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className="ti ti-shield-exclamation" style={{ fontSize:18, color:'#fff' }} /></div>
              <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:900, color:'#C00' }}>Cause for Concern</div><div style={{ fontSize:11, color:'#C00', fontWeight:600, opacity:0.8 }}>Report a safeguarding concern immediately</div></div>
              <i className="ti ti-chevron-right" style={{ fontSize:16, color:'#C00' }} />
            </button>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
              {[{val:volunteerHours.toFixed(1),label:'Hours given',color:'#F5D000',bg:'#0D1B2A'},{val:volunteerSessions,label:'Adventures',color:'#9FE1CB',bg:'#0F6E56'},{val:Math.round(volunteerHours*2),label:'Young people',color:'#CECBF6',bg:'#2D1B69'},{val:streak,label:'Week streak',color:'#FAC775',bg:'#633806'}].map(s=>(
                <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:'12px 14px' }}><div style={{ fontSize:24, fontWeight:900, color:s.color, lineHeight:1, marginBottom:3 }}>{s.val}</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.4 }}>{s.label}</div></div>
              ))}
            </div>
            <div style={{ background:'#fff', borderRadius:18, border:'1.5px solid var(--border)', padding:'14px 16px', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:28, height:28, borderRadius:8, background:'#FFF8E6', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-trophy" style={{ fontSize:14, color:'#F0A500' }} /></div><span style={{ fontSize:13, fontWeight:900, color:'var(--black)' }}>Volunteer Journey</span></div>
                <span style={{ fontSize:12, fontWeight:800, color:volunteerHours>=100?'#F5D000':volunteerHours>=50?'#F0A500':volunteerHours>=25?'#C0C0C0':'#4ADE80' }}>{volunteerHours>=100?'Champion':volunteerHours>=50?'Gold':volunteerHours>=25?'Silver':'Green'}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                {['Green','Silver','Gold','Champion'].map((t,i)=>{const thresholds=[0,25,50,100];const colors=['#4ADE80','#C0C0C0','#F0A500','#F5D000'];const isPast=thresholds[i]<=volunteerHours;const isActive=(volunteerHours>=100?'Champion':volunteerHours>=50?'Gold':volunteerHours>=25?'Silver':'Green')===t;return(<React.Fragment key={t}><div style={{ width:24, height:24, borderRadius:'50%', background:isPast?colors[i]:'var(--grey-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:isActive?'2px solid '+colors[i]:'none' }}><i className="ti ti-medal" style={{ fontSize:11, color:isPast?'#fff':'var(--muted)' }} /></div>{i<3&&<div style={{ flex:1, height:3, borderRadius:99, background:volunteerHours>=thresholds[i+1]?colors[i+1]:'var(--grey-bg)' }} />}</React.Fragment>)})}
              </div>
              <div style={{ background:'var(--grey-bg)', borderRadius:8, height:6, marginBottom:6 }}><div style={{ background:'linear-gradient(90deg,#1B9AAA,#F5D000)', width:Math.min((volunteerHours/(volunteerHours>=100?100:volunteerHours>=50?100:volunteerHours>=25?50:25))*100,100)+'%', height:'100%', borderRadius:8 }} /></div>
              <div style={{ fontSize:11, color:'#9B59B6', fontWeight:700 }}>{volunteerHours>=100?'You have reached the top!':((volunteerHours>=50?100:volunteerHours>=25?50:25)-volunteerHours).toFixed(1)+'h until '+(volunteerHours>=50?'Champion':volunteerHours>=25?'Gold':'Silver')}</div>
            </div>
            <div style={{ background:'#0D1B2A', borderRadius:18, padding:'16px', marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#F5D000', textTransform:'uppercase', letterSpacing:1.5, marginBottom:12 }}><i className="ti ti-heart" style={{ marginRight:5 }} />Memory Moments</div>
              {[{icon:'ti-beach',color:'#1B9AAA',text:'18 young people enjoyed a beach adventure this week thanks to our volunteers.'},{icon:'ti-ball-football',color:'#417505',text:'42 young people joined our football festival — a record turnout!'},{icon:'ti-mountain',color:'#9B59B6',text:'Our first ever ski trip gave 12 children their first snow experience.'}].map((m,i)=>(
                <div key={i} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:i<2?'1px solid rgba(255,255,255,0.08)':'none' }}><div style={{ width:36, height:36, borderRadius:10, background:m.color+'30', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={'ti '+m.icon} style={{ fontSize:16, color:m.color }} /></div><div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', fontWeight:600, lineHeight:1.5, flex:1 }}>{m.text}</div></div>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}><div style={{ width:28, height:28, borderRadius:8, background:'#F0A500', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-sun" style={{ fontSize:14, color:'#fff' }} /></div><div style={{ fontSize:13, fontWeight:900, color:'var(--black)', textTransform:'uppercase', letterSpacing:0.8 }}>Today's Sessions</div></div>
            {todaySessions.length===0?<div style={{ background:'#0D1B2A', borderRadius:18, padding:'28px 20px', textAlign:'center' }}><div style={{ width:60, height:60, borderRadius:18, background:'rgba(245,208,0,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', border:'1.5px solid rgba(245,208,0,0.2)' }}><i className="ti ti-star" style={{ fontSize:28, color:'#F5D000' }} /></div><div style={{ fontSize:17, fontWeight:900, color:'#fff', marginBottom:6 }}>Rest day!</div><div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600, lineHeight:1.5 }}>No sessions today — enjoy the break!</div></div>:todaySessions.map(s=>{const cfg=typeConfig[s.session_type]||typeConfig.activity;const count=sessionVolCounts[s.id]||0;const isFull=s.volunteer_limit&&count>=s.volunteer_limit;return(<div key={s.id} style={{ background:'#fff', borderRadius:18, border:'1.5px solid var(--border)', padding:'16px', marginBottom:12, overflow:'hidden', position:'relative' }}><div style={{ position:'absolute', top:0, left:0, width:4, height:'100%', background:cfg.color, borderRadius:'4px 0 0 4px' }} /><div style={{ paddingLeft:8 }}><div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}><div style={{ width:46, height:46, borderRadius:14, background:cfg.color+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1.5px solid '+cfg.color+'40' }}><i className={'ti '+cfg.icon} style={{ fontSize:22, color:cfg.color }} /></div><div style={{ flex:1 }}><div style={{ fontSize:16, fontWeight:900, color:'var(--black)', marginBottom:4 }}>{s.title}</div><div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', display:'flex', gap:10, flexWrap:'wrap' }}><span>🕐 {s.start_time} – {s.end_time}</span>{s.location&&<span>📍 {s.location.split(',')[0]}</span>}</div></div></div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><span style={{ fontSize:11, fontWeight:800, background:'#F5F0FF', color:'#9B59B6', borderRadius:99, padding:'4px 12px' }}>❤️ {count} volunteer{count!==1?'s':''}</span>{s.volunteer_limit&&<span style={{ fontSize:11, fontWeight:700, background:isFull?'#FFF0F0':'#EDFAED', color:isFull?'#C00':'#417505', borderRadius:99, padding:'4px 12px' }}>{isFull?'Full':`${s.volunteer_limit-count} spots left`}</span>}</div></div></div>)})}
          </div>
        )}
        {navTab==='sessions'&&<BookTab futureSessions={futureSessions} sessionSignups={sessionSignups} volunteerCounts={volunteerCounts} saving={saving} handleBook={handleBook} today={today} />}
        {navTab==='register'&&<RegisterTab userId={authUser?.id} />}
        {navTab==='profile'&&<VolunteerProfileTab user={authUser} profile={profile} org={org} onRefresh={refreshProfile} />}
        {navTab==='rota'&&<RotaTab rota={rota} today={today} />}
      </div>
      {showCFC&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end' }}>
          <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}><div style={{ fontSize:16, fontWeight:900, color:'var(--black)' }}>Cause for Concern</div><button onClick={()=>setShowCFC(false)} style={{ background:'var(--grey-bg)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', fontSize:18, color:'var(--muted)' }}>×</button></div>
            <div style={{ padding:20 }}><p style={{ fontSize:14, color:'var(--muted)', marginBottom:16 }}>Use this form to report any safeguarding concerns. Your submission will be sent to the DSL immediately.</p><textarea rows={6} placeholder="Describe the concern in detail..." style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)', fontSize:14, outline:'none', boxSizing:'border-box', resize:'none', marginBottom:14 }} /><button onClick={()=>setShowCFC(false)} style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:'#C00', color:'#fff', fontSize:15, fontWeight:900, cursor:'pointer' }}>Submit Concern</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
