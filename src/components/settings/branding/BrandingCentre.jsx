import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Copy, Download, Eye, Image as ImageIcon, LayoutDashboard, Mail, Monitor, Palette, RotateCcw, Smartphone, Sparkles, Type, Upload, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { useTerms } from '../../../context/OrgContext'
import { BRAND_FONTS, DENSITIES, fontByKey, loadBrandFont, applyBrandTheme } from '../../../lib/brandTheme'
import { applyBrandPalette, brandPalette, contrastRatio } from '../../../lib/brandColors'
import { BRAND_IMAGE_TYPES, prepareBrandImage, extensionFor } from '../../../lib/brandImage'
import BrandPreview, { BrandMark } from './BrandPreview'
import { ASSETS, DEFAULTS, PRESETS, brandText, downloadGuide, draftFromOrg, readableInk, validateBrand } from './brandingModel'
import { extractDominantColors } from './logoColours'

const C = { ink: 'var(--text, #1C2B25)', muted: 'var(--text2, #68766D)', line: 'var(--border, #DFE5DF)', paper: 'var(--surface, #FFFFFF)', wash: 'var(--surface2, #F5F6F2)' }
const buttonStyle = { minHeight: 44, padding: '10px 15px', borderRadius: 10, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }
const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '12px 13px', border: `1px solid ${C.line}`, borderRadius: 10, font: 'inherit', fontSize: 13, color: C.ink, background: C.paper }
const tabs = [['overview', 'Overview', Sparkles], ['identity', 'Identity', ImageIcon], ['colours', 'Colours', Palette], ['type', 'Typography', Type], ['touchpoints', 'Touchpoints', Monitor], ['kit', 'Brand kit', Download]]
const surfaces = [['workspace', 'Workspace', LayoutDashboard], ['login', 'Sign-in', Monitor], ['email', 'Email', Mail], ['icon', 'App icon', Smartphone]]
const premiumValue = [
  ['Workspace', 'Navigation, Home, actions and app chrome'],
  ['Sign-in', 'First impression before every login'],
  ['Forms & email', 'Supported invitations, forms and broadcasts'],
  ['Handover', 'Downloadable guide for print and comms'],
]

function Button({ children, style, disabled, ...props }) { return <button type="button" disabled={disabled} {...props} style={{ ...buttonStyle, ...style, opacity: disabled ? .45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>{children}</button> }
function Section({ title, subtitle, children }) { return <section style={{ marginBottom: 25 }}><h2 style={{ fontSize: 19, letterSpacing: -.4, margin: '0 0 7px', color: C.ink }}>{title}</h2>{subtitle && <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: '0 0 19px' }}>{subtitle}</p>}{children}</section> }
function TextField({ label, hint, value, onChange, maxLength = 80, multiline = false }) { const Tag = multiline ? 'textarea' : 'input'; return <label style={{ display: 'block', marginBottom: 18 }}><span style={{ display: 'block', color: C.ink, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{label}</span><Tag style={{ ...inputStyle, ...(multiline ? { minHeight: 86, resize: 'vertical' } : {}) }} value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} />{hint && <span style={{ display: 'block', fontSize: 11, lineHeight: 1.6, color: C.muted, marginTop: 7 }}>{hint}</span>}</label> }
function AssetUpload({ asset, value, fallback, name, onChange, onRemove, busy }) {
  return <div style={{ border: `1px solid ${C.line}`, borderRadius: 13, padding: 16, marginBottom: 14 }}><div style={{ display: 'flex', gap: 15, alignItems: 'center' }}><BrandMark src={value || fallback} name={name} size={62} /><div style={{ minWidth: 0 }}><strong style={{ fontSize: 13, color: C.ink }}>{asset.label}</strong><p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, margin: '5px 0 0' }}>{asset.note}</p></div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 13, flexWrap: 'wrap' }}><label style={{ ...buttonStyle, position: 'relative', overflow: 'hidden' }}><Upload size={14} />{busy ? 'Preparing…' : value ? 'Replace image' : 'Upload image'}<input aria-label={`Upload ${asset.label.toLowerCase()}`} type="file" accept={BRAND_IMAGE_TYPES.join(',')} disabled={busy} onChange={onChange} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} /></label>{value && <Button aria-label={`Remove ${asset.label.toLowerCase()}`} onClick={onRemove}><X size={14} />Remove</Button>}</div></div>
}

export default function BrandingCentre({ org, refreshOrg }) {
  const isMobile = useIsMobile(), stacked = useIsMobile(1180)
  const terms = useTerms()
  const [draft, setDraft] = useState(() => draftFromOrg(org))
  const [published, setPublished] = useState(() => draftFromOrg(org))
  const [files, setFiles] = useState({})
  const [tab, setTab] = useState('overview'), [surface, setSurface] = useState('workspace')
  const [device, setDevice] = useState('desktop'), [compare, setCompare] = useState(false)
  const [saving, setSaving] = useState(false), [preparing, setPreparing] = useState(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(null), [suggestions, setSuggestions] = useState([])
  const [recentColors, setRecentColors] = useState(org?.recent_colors || [])
  const [copied, setCopied] = useState(false)
  const objectUrls = useRef(new Set()), busyRef = useRef(false), previewRef = useRef(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(published)
  const palette = brandPalette(draft.primary_color)
  // The editor itself stays readable while an admin experiments with extreme colours.
  const livePalette = brandPalette(published.primary_color)
  const primaryButton = { background: livePalette.ink, borderColor: livePalette.ink, color: '#fff' }
  const update = (key, value) => { setDraft(d => ({ ...d, [key]: value })); setNotice(''); setCompare(false) }
  const remember = color => { if (/^#[\da-f]{6}$/i.test(color)) setRecentColors(old => [color, ...old.filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, 8)) }
  useEffect(() => { loadBrandFont(draft.brand_font) }, [draft.brand_font])
  useEffect(() => {
    let cancelled = false
    setSuggestions([])
    if (draft.logo_url) extractDominantColors(draft.logo_url).then(colors => { if (!cancelled) setSuggestions(colors) })
    return () => { cancelled = true }
  }, [draft.logo_url])
  useEffect(() => {
    if (!dirty) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    const urls = objectUrls.current
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [])

  const chooseFile = asset => async e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || busyRef.current) return
    busyRef.current = true; setPreparing(asset.key); setError('')
    try {
      const prepared = await prepareBrandImage(file, asset.options)
      const url = URL.createObjectURL(prepared); objectUrls.current.add(url)
      setFiles(f => ({ ...f, [asset.key]: prepared })); update(asset.key, url)
    } catch (err) { setError(err.message || 'That image could not be prepared. Try a PNG, JPEG or WebP.') }
    finally { busyRef.current = false; setPreparing(null) }
  }
  const assetControl = asset => <AssetUpload key={asset.key} asset={asset} value={draft[asset.key]} fallback={asset.key !== 'logo_url' && asset.key !== 'login_background_url' ? draft.logo_url : ''} name={draft.name} busy={preparing !== null || saving} onChange={chooseFile(asset)} onRemove={() => { update(asset.key, ''); setFiles(f => ({ ...f, [asset.key]: null })) }} />

  async function publish() {
    if (busyRef.current || !dirty) return
    const invalid = validateBrand(draft)
    if (invalid) { setError(invalid); return }
    busyRef.current = true; setSaving(true); setError(''); setNotice('')
    const next = { ...draft, name: draft.name.trim() }
    try {
      for (const asset of ASSETS) {
        const file = files[asset.key]
        if (file) {
          // A failed database save must not replace the image still used by the published brand.
          const path = `${org.id}/${asset.suffix}-${crypto.randomUUID()}.${extensionFor(file)}`
          const bucket = supabase.storage.from('org-logos')
          const { error: uploadError } = await bucket.upload(path, file, { contentType: file.type, upsert: false })
          if (uploadError) throw new Error(`Could not upload ${asset.label.toLowerCase()}: ${uploadError.message}`)
          next[asset.key] = bucket.getPublicUrl(path).data.publicUrl
        }
      }
      const payload = { ...next, recent_colors: recentColors }
      ASSETS.forEach(a => { if (!payload[a.key]) payload[a.key] = null })
      const { data, error: saveError } = await supabase.from('organisations').update(payload).eq('id', org.id).select('id')
      if (saveError) throw saveError
      if (!data?.length) throw new Error('Your changes were not saved. Check that you are still signed in as an administrator, then try again.')
      setDraft(next); setPublished(next); setFiles({}); setCompare(false)
      applyBrandPalette(next.primary_color); applyBrandTheme(next)
      const favicon = next.icon_url || next.logo_url || '/favicon.png'
      document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']").forEach(link => { link.href = favicon })
      setNotice('Your brand is published. Your team will see it when they next load the app.')
      try { if (refreshOrg) await refreshOrg() } catch (_) { setNotice('Your brand is published. Refresh the app to load the updated organisation details.') }
    } catch (err) { setError(err.message || 'Publishing failed. Your draft is still here; please try again.') }
    finally { busyRef.current = false; setSaving(false) }
  }
  function reset() {
    setDraft(confirm === 'defaults' ? { ...DEFAULTS, name: published.name } : { ...published })
    setFiles({}); setConfirm(null); setCompare(false); setError(''); setNotice('')
  }
  const checklist = [
    { title: 'Identity', detail: draft.logo_url ? 'Your logo is ready' : 'Add a recognisable logo', done: !!draft.logo_url, target: 'identity' },
    { title: 'Colour & type', detail: 'A coordinated look across your workspace', done: !validateBrand(draft), target: 'colours' },
    { title: 'First impressions', detail: draft.login_background_url ? 'Custom sign-in photograph' : 'Personalise your sign-in screen', done: !!draft.login_background_url, target: 'touchpoints' },
    { title: 'Communications', detail: draft.email_footer_text ? 'Your email footer is ready' : 'Add your organisation’s email footer', done: !!draft.email_footer_text, target: 'touchpoints' },
  ]
  const readyCount = checklist.filter(item => item.done).length
  const go = key => { setTab(key); if (key === 'touchpoints') setSurface('login'); setConfirm(null) }
  const previewDraft = compare ? published : draft
  const field = (key, label, hint, props) => <TextField label={label} hint={hint} value={draft[key]} onChange={value => update(key, value)} {...props} />

  return <div style={{ padding: isMobile ? '20px 14px 90px' : '30px 28px 42px', background: C.wash, color: C.ink, minHeight: '80vh', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
      <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: livePalette.ink, textTransform: 'uppercase', marginBottom: 10 }}><Sparkles size={13} />Branding Centre <span style={{ border: `1px solid ${C.line}`, padding: '4px 7px', borderRadius: 5, fontSize: 9, letterSpacing: 1 }}>Premium</span></div><h1 style={{ fontSize: isMobile ? 29 : 35, letterSpacing: -1.4, lineHeight: 1.1, margin: 0, fontWeight: 650 }}>Make it unmistakably yours.</h1><p style={{ fontSize: 13, color: C.muted, margin: '11px 0 0', lineHeight: 1.6 }}>One identity. Every interaction.</p></div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}><Button onClick={() => { go('kit') }}><Download size={15} />Brand kit</Button><Button style={primaryButton} onClick={publish} disabled={saving || !!preparing || !dirty}>{saving ? 'Publishing…' : 'Publish brand'}<ArrowUpRight size={16} /></Button></div>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 24 }}>
      {premiumValue.map(([title, detail], index) => (
        <button type="button" key={title} onClick={() => index === 0 ? setSurface('workspace') : index === 1 ? setSurface('login') : index === 2 ? setSurface('email') : go('kit')} style={{ textAlign: 'left', border: `1px solid ${C.line}`, borderRadius: 12, background: C.paper, padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: 82 }}>
          <span style={{ display: 'block', fontSize: 10, color: livePalette.ink, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>{index === 3 ? 'Included' : 'Live surface'}</span>
          <strong style={{ display: 'block', fontSize: 13, color: C.ink, marginBottom: 5 }}>{title}</strong>
          <span style={{ display: 'block', fontSize: 11, lineHeight: 1.45, color: C.muted }}>{detail}</span>
        </button>
      ))}
    </div>
    {(error || notice) && <div role={error ? 'alert' : 'status'} style={{ padding: '13px 16px', border: `1px solid ${error ? '#EFB8B1' : '#BDD6C8'}`, borderRadius: 11, marginBottom: 18, background: error ? '#FFF4F2' : '#F0F8F2', color: error ? '#943C2D' : '#2E6247', fontSize: 13, lineHeight: 1.6 }}>{error || notice}</div>}
    <div style={{ display: 'flex', gap: isMobile ? 5 : 10, overflowX: 'auto', borderBottom: `1px solid ${C.line}`, paddingBottom: 0, marginBottom: 25 }} aria-label="Brand editor sections">
      {tabs.map(([key, label, Glyph]) => <Button key={key} aria-pressed={tab === key} onClick={() => go(key)} style={{ flexShrink: 0, border: 'none', borderBottom: `2px solid ${tab === key ? livePalette.ink : 'transparent'}`, borderRadius: 0, color: tab === key ? livePalette.ink : C.muted, background: 'transparent', padding: '12px 13px' }}><Glyph size={15} />{label}</Button>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: stacked ? 'minmax(0,1fr)' : 'minmax(330px, .85fr) minmax(420px, 1.15fr)', gap: 26, alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
        <fieldset disabled={saving || preparing !== null} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
        {tab === 'overview' && <>
          <div style={{ padding: isMobile ? 22 : 27, borderRadius: 17, background: '#172D24', color: '#F6F5EE', position: 'relative', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}><BrandMark src={draft.logo_url} name={draft.name} size={58} /><span style={{ fontSize: 9, letterSpacing: 1.7, color: '#BCCDC2', paddingTop: 5 }}>YOUR BRAND, AT A GLANCE</span></div>
            <h2 style={{ margin: '24px 0 8px', fontFamily: fontByKey(draft.brand_font).display, fontSize: 29, lineHeight: 1.1, letterSpacing: -.8, overflowWrap: 'anywhere' }}>{draft.name || 'Your organisation'}</h2><p style={{ margin: 0, color: '#BDCEC3', fontSize: 12, lineHeight: 1.7 }}>{draft.slogan || 'A shared identity for the work you do.'}</p>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 29, justifyContent: 'space-between', gap: 12 }}><div style={{ display: 'flex', gap: 6 }}>{[draft.primary_color, draft.secondary_color, draft.accent_color].map((color, i) => <span key={i} style={{ display: 'block', width: 29, height: 29, borderRadius: 50, background: color, border: '2px solid #FFFFFF38' }} />)}</div><span style={{ fontSize: 11, color: '#CBD8D0' }}>{fontByKey(draft.brand_font).label} <span style={{ fontSize: 22, marginLeft: 10, fontFamily: fontByKey(draft.brand_font).display }}>Aa</span></span></div>
          </div>
          <Section title={`Brand readiness: ${readyCount}/4`} subtitle="Build a consistent experience for your team and community. Add only what suits your organisation.">
            <div style={{ border: `1px solid ${C.line}`, background: C.paper, borderRadius: 13, overflow: 'hidden' }}>{checklist.map((item, i) => <button type="button" key={item.title} onClick={() => go(item.target)} style={{ width: '100%', display: 'flex', textAlign: 'left', alignItems: 'center', gap: 13, padding: '16px', border: 'none', borderTop: i ? `1px solid ${C.line}` : 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}><span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: item.done ? '#EDF5EF' : C.wash, color: item.done ? '#39754E' : C.muted, borderRadius: 50, flexShrink: 0 }}>{item.done ? <Check size={14} /> : <span style={{ fontSize: 11 }}>0{i + 1}</span>}</span><span style={{ flex: 1 }}><strong style={{ fontSize: 12, color: C.ink }}>{item.title}</strong><span style={{ display: 'block', fontSize: 11, color: C.muted, marginTop: 5, lineHeight: 1.5 }}>{item.detail}</span></span><ArrowRight size={14} color="#78867D" /></button>)}</div>
          </Section>
          <Button onClick={() => go('colours')} style={{ width: '100%', background: 'transparent' }}><Palette size={15} />Explore curated brand styles<ArrowRight size={14} /></Button>
        </>}
        {tab === 'identity' && <Section title="A familiar face, everywhere." subtitle="Upload once, and carry your identity from the workspace to your team's home screen. PNG, JPEG and WebP are supported.">
          {field('name', 'Organisation name', 'This also updates the organisation name throughout LaunchSession.', { maxLength: 120 })}
          {field('slogan', 'Strapline', 'A short expression of what your organisation stands for.')}
          {ASSETS.slice(0, 2).map(assetControl)}
          <div style={{ marginTop: 23 }}><strong style={{ fontSize: 12 }}>Light & dark check</strong><p style={{ fontSize: 11, color: C.muted }}>Check the edges and transparency of your primary logo.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{[false, true].map(dark => <div key={String(dark)} style={{ padding: '22px 15px', borderRadius: 12, background: dark ? '#15251E' : '#FFFFFF', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>{draft.logo_url ? <img src={draft.logo_url} alt={`Logo on ${dark ? 'dark' : 'light'}`} style={{ height: 63, width: '100%', objectFit: 'contain' }} /> : <BrandMark name={draft.name} size={63} dark={dark} />}<span style={{ fontSize: 10, color: dark ? '#BBC9C1' : '#718076' }}>{dark ? 'Dark background' : 'Light background'}</span></div>)}</div></div>
        </Section>}
        {tab === 'colours' && <>
          <Section title="Find your signature palette." subtitle="Start with a considered colour and type combination, then make it your own. Applying a style only changes your draft."><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{PRESETS.map(p => <button type="button" key={p.name} onClick={() => { setDraft(d => ({ ...d, primary_color: p.colors[0], secondary_color: p.colors[1], accent_color: p.colors[2], brand_font: p.font })); setCompare(false); setNotice(`${p.name} applied to your draft. Publish when you're happy.`) }} style={{ border: `1px solid ${C.line}`, padding: 0, borderRadius: 13, background: C.paper, textAlign: 'left', overflow: 'hidden', cursor: 'pointer' }}><div style={{ display: 'flex', height: 66 }}>{p.colors.map((color, i) => <div key={color} style={{ background: color, flex: i === 0 ? 2 : 1 }} />)}</div><div style={{ padding: 14 }}><strong style={{ fontSize: 13, color: C.ink }}>{p.name}</strong><div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{p.note}</div></div></button>)}</div></Section>
          <Section title="Fine-tune your colours" subtitle="Primary: workspace and key actions. Secondary: supporting gradients. Accent: public forms.">{[['primary_color', 'Primary'], ['secondary_color', 'Secondary'], ['accent_color', 'Accent']].map(([key, label]) => <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.line}` }}><input aria-label={`${label} colour picker`} type="color" value={/^#[\da-f]{6}$/i.test(draft[key]) ? draft[key] : '#000000'} onChange={e => update(key, e.target.value)} onBlur={() => remember(draft[key])} style={{ width: 48, height: 46, padding: 3, border: `1px solid ${C.line}`, borderRadius: 10, background: C.paper, cursor: 'pointer' }} /><label style={{ flex: 1, fontSize: 12, color: C.ink }} htmlFor={`brand-${key}`}>{label}</label><input id={`brand-${key}`} aria-label={`${label} hex colour`} value={draft[key]} onChange={e => update(key, e.target.value)} onBlur={() => remember(draft[key])} maxLength={7} style={{ ...inputStyle, width: 103, fontFamily: 'monospace', fontSize: 12 }} /></div>)}
            {[['From your logo', suggestions], ['Recently used', recentColors]].filter(([, colors]) => colors.length).map(([label, colors]) => <div key={label} style={{ marginTop: 19 }}><strong style={{ fontSize: 11 }}>{label}</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>{colors.map(color => <Button key={color} aria-label={`Use ${color} as primary colour`} onClick={() => { update('primary_color', color); remember(color) }} style={{ padding: 5, width: 44 }}><span style={{ width: 29, height: 29, borderRadius: 7, background: color, border: '1px solid #00000018' }} /></Button>)}</div></div>)}
          </Section>
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 13, padding: 17 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}><Eye size={15} />Readability check</div><p style={{ color: C.muted, fontSize: 11, lineHeight: 1.7 }}>White text on primary: <strong>{contrastRatio(palette.primary, '#fff').toFixed(1)}:1</strong>. {contrastRatio(palette.primary, '#fff') >= 4.5 ? 'Meets the 4.5:1 normal-text contrast threshold.' : 'Some sign-in and email elements use white text. A darker primary will make them easier to read.'}</p><div style={{ padding: 14, background: palette.primary, color: readableInk(palette.primary), borderRadius: 9, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Example with readable text</div><p style={{ fontSize: 10, color: C.muted, lineHeight: 1.6, marginBottom: 0 }}>This checks a colour pair, not the accessibility of every screen.</p></div>
        </>}
        {tab === 'type' && <>
          <Section title="Give your words a voice." subtitle="Choose the typography used across your workspace and sign-in screen. Email clients use their supported fallback fonts."><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{BRAND_FONTS.map(font => <button type="button" key={font.key} aria-pressed={draft.brand_font === font.key} onFocus={() => loadBrandFont(font.key)} onMouseEnter={() => loadBrandFont(font.key)} onClick={() => update('brand_font', font.key)} style={{ textAlign: 'left', padding: 17, background: C.paper, border: draft.brand_font === font.key ? `2px solid ${livePalette.ink}` : `2px solid ${C.line}`, borderRadius: 12, cursor: 'pointer' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: font.display, fontSize: 31, color: C.ink }}>Aa{draft.brand_font === font.key && <Check size={15} color={livePalette.ink} />}</div><div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 12 }}>{font.label}</div><div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6, marginTop: 5 }}>{font.note}</div></button>)}</div></Section>
          <Section title="Shape & spacing" subtitle="Choose the interface treatment that feels right for your team."><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{DENSITIES.map(d => <Button key={d.key} aria-pressed={draft.ui_density === d.key} onClick={() => update('ui_density', d.key)} style={{ minHeight: 76, border: `2px solid ${draft.ui_density === d.key ? livePalette.ink : C.line}`, borderRadius: d.radius }}><span style={{ display: 'block', textAlign: 'left' }}>{d.label}<small style={{ display: 'block', fontWeight: 400, color: C.muted, lineHeight: 1.5, marginTop: 5 }}>{d.note}</small></span></Button>)}</div></Section>
        </>}
        {tab === 'touchpoints' && <>
          <Section title="A welcome that feels like you." subtitle="Make the first impression count, then carry the same care into your communications.">{assetControl(ASSETS[2])}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22 }}>{[['cover', 'Full photograph'], ['muted', 'Subtle photograph'], ['tint', 'Default background']].map(([key, label]) => <Button key={key} aria-pressed={draft.login_background_style === key} onClick={() => { update('login_background_style', key); setSurface('login') }} style={{ borderColor: draft.login_background_style === key ? livePalette.ink : C.line, background: draft.login_background_style === key ? livePalette.tint : C.paper, color: draft.login_background_style === key ? livePalette.ink : C.ink }}>{label}</Button>)}</div>
            {field('welcome_message', 'Workspace welcome message', 'Shown on Home beneath the daily summary.')}
          </Section><Section title="Emails with your identity" subtitle="Customise the branding used by supported invitation, form and broadcast emails.">{assetControl(ASSETS[3])}{field('email_sender_name', 'Email sender name', 'Used on form and registration emails. Defaults to your organisation name.', { maxLength: 60 })}{field('email_footer_text', 'Email footer', 'Used on form and registration emails. A good place for a charity number or short sign-off.', { multiline: true })}<Button onClick={() => { setSurface('email'); previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><Mail size={15} />Preview email<ArrowRight size={14} /></Button></Section>
        </>}
        {tab === 'kit' && <>
          <Section title="Your identity, ready to share." subtitle="Give your designer, printer or communications team a single reference for your published brand."><div style={{ padding: 24, borderRadius: 15, border: `1px solid ${C.line}`, background: C.paper }}><div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><BrandMark src={published.logo_url} name={published.name} size={55} /><div><strong style={{ fontSize: 17 }}>{published.name}</strong><p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>Brand guidelines · Published version</p></div></div><div style={{ display: 'flex', height: 69, borderRadius: 9, overflow: 'hidden', margin: '24px 0' }}>{[published.primary_color, published.secondary_color, published.accent_color].map((color, i) => <div key={i} style={{ flex: i === 0 ? 2 : 1, background: color }} />)}</div><p style={{ color: C.muted, fontSize: 12, lineHeight: 1.8 }}>Colour references in HEX and RGB, font choices, logo links and simple usage guidance in one printable guide.</p><Button style={{ ...primaryButton, width: '100%' }} onClick={() => downloadGuide(published)}><Download size={15} />Download brand guide</Button><p style={{ fontSize: 10, color: C.muted, lineHeight: 1.6, marginBottom: 0 }}>Downloads an HTML document. Open it in a browser to print or save as PDF. Linked assets need an internet connection.</p></div>{dirty && <p style={{ fontSize: 11, color: '#916826', lineHeight: 1.7 }}>You have unpublished changes. The download uses your current published brand.</p>}</Section>
          <Section title="Copy & hand over"><Button onClick={async () => { try { await navigator.clipboard.writeText(brandText(published)); setCopied(true) } catch (_) { setNotice('Copying is unavailable here. Select and copy the brand details below.') } }}><Copy size={14} />{copied ? 'Copied to clipboard' : 'Copy brand details'}</Button><textarea aria-label="Published brand details" readOnly value={brandText(published)} onFocus={e => e.target.select()} rows={9} style={{ ...inputStyle, fontSize: 11, lineHeight: 1.7, marginTop: 12, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>{ASSETS.filter(a => /^https?:\/\//.test(published[a.key])).map(a => <a key={a.key} href={published[a.key]} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, textDecoration: 'none' }}>{a.label}<ArrowUpRight size={13} /></a>)}</div>
          </Section>
        </>}
        </fieldset>
      </div>
      <aside ref={previewRef} style={{ position: stacked ? 'static' : 'sticky', top: 18, minWidth: 0, scrollMarginTop: 15 }}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 17, background: C.paper, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderBottom: `1px solid ${C.line}` }}><div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, fontWeight: 700 }}><span style={{ width: 6, height: 6, borderRadius: 10, background: compare ? '#A7AEA8' : '#508263' }} />{compare ? 'Published brand' : 'Live preview'}</div><Button aria-pressed={compare} onClick={() => setCompare(v => !v)} style={{ padding: '8px 10px', minHeight: 44, fontSize: 10, background: compare ? livePalette.tint : C.paper }}><Eye size={13} />{compare ? 'Show my draft' : 'Compare with published'}</Button></div>
          <div style={{ display: 'flex', padding: '9px 14px', gap: 4, overflowX: 'auto' }}>{surfaces.map(([key, label, Glyph]) => <Button key={key} aria-pressed={surface === key} onClick={() => setSurface(key)} style={{ fontSize: 11, padding: '8px 10px', border: 'none', background: surface === key ? livePalette.tint : 'transparent', color: surface === key ? livePalette.ink : C.muted, flexShrink: 0 }}><Glyph size={13} />{label}</Button>)}</div>
          <div style={{ background: 'radial-gradient(ellipse at 50% 20%,#E9EEE5,transparent 65%),#F3F4F0', padding: isMobile ? '20px 12px 27px' : '29px 23px 33px', minHeight: 455, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><BrandPreview draft={previewDraft} surface={surface} device={isMobile ? 'mobile' : device} terms={terms} /></div>
          <div style={{ padding: '13px 19px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={{ fontSize: 10, color: C.muted }}>Illustrative preview · Sample content</span><div style={{ display: 'flex', gap: 3 }}>{[['desktop', Monitor], ['mobile', Smartphone]].map(([key, Glyph]) => <Button key={key} aria-label={`${key} preview`} aria-pressed={(isMobile ? 'mobile' : device) === key} disabled={isMobile && key === 'desktop'} onClick={() => setDevice(key)} style={{ padding: 8, width: 44, border: 'none', background: (isMobile ? 'mobile' : device) === key ? C.wash : 'transparent' }}><Glyph size={15} /></Button>)}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 11, padding: '20px 5px', alignItems: 'flex-start' }}><CheckCircle2 size={17} color={livePalette.ink} style={{ flexShrink: 0, marginTop: 2 }} /><p style={{ fontSize: 11, color: C.muted, lineHeight: 1.8, margin: 0 }}>Your draft stays in the editor until you publish. Changes then apply to the organisation’s supported workspace, sign-in and communication surfaces.</p></div>
      </aside>
    </div>
    <footer style={{ position: 'sticky', bottom: isMobile ? 72 : 12, zIndex: 4, marginTop: 25, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 13, padding: '12px 16px', boxShadow: '0 8px 26px #16291E0C', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.muted }}><span style={{ width: 6, height: 6, borderRadius: 20, background: dirty ? '#B4893F' : '#568468' }} />{dirty ? 'Unpublished changes' : 'Your published brand'}<span style={{ opacity: .5 }}>·</span>{org.name}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{dirty && <Button disabled={saving || !!preparing} onClick={() => setConfirm('discard')} style={{ fontSize: 11 }}>Discard changes</Button>}<Button disabled={saving || !!preparing} onClick={() => setConfirm('defaults')} style={{ fontSize: 11 }}><RotateCcw size={13} />Defaults</Button>{isMobile && <Button disabled={saving || !!preparing || !dirty} onClick={publish} style={primaryButton}>{saving ? 'Publishing…' : 'Publish brand'}</Button>}</div>
      {confirm && <div role="alert" style={{ flexBasis: '100%', borderTop: `1px solid ${C.line}`, paddingTop: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 12, flex: 1, minWidth: 180 }}>{confirm === 'defaults' ? 'Replace your draft with LaunchSession defaults? Publish to apply them.' : 'Discard all unpublished changes?'}</span><Button onClick={reset}>Confirm {confirm === 'defaults' ? 'reset' : 'discard'}</Button><Button onClick={() => setConfirm(null)}>Cancel</Button></div>}
    </footer>
  </div>
}
