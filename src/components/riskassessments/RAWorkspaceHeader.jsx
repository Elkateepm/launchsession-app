import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { OrgLogo, orgBrand } from '../shared/OrgPageHero'
import Icon from '../../lib/icons'

export const RA_CARD = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }
export const RA_BUTTON = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, fontWeight: 750, cursor: 'pointer', outlineOffset: 3 }

function SafetyIllustration() {
  const reduced = useReducedMotion()
  return <svg viewBox="0 0 260 190" width="100%" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
    <circle cx="133" cy="95" r="81" fill="#ffffff0d" stroke="#ffffff24" />
    <path d="M31 156h192M31 60h19m-9-9v19M219 45v10m-5-5h10" stroke="#ffffff66" strokeWidth="2" strokeLinecap="round" />
    <g transform="rotate(-10 87 89)">
      <rect x="45" y="28" width="97" height="126" rx="14" fill="#fff" />
      <rect x="70" y="20" width="46" height="17" rx="7" fill="var(--ra-hero-ink)" stroke="#ffffff66" />
      {[57, 84, 111].map((y, i) => <g key={y}>
        <rect x="60" y={y} width="15" height="15" rx="5" fill="var(--ra-hero-soft)" />
        <path d={`M85 ${y + 4}h39M85 ${y + 11}h26`} stroke="var(--ra-hero-soft)" strokeWidth="4" strokeLinecap="round" />
        <motion.path d={`m64 ${y + 7} 3 3 5-6`} fill="none" stroke="var(--ra-hero-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .5, delay: reduced ? 0 : .15 + i * .2 }} />
      </g>)}
    </g>
    <motion.g initial={false} animate={{ y: reduced ? 0 : [0, -6, 0] }} transition={{ duration: reduced ? 0 : 2.4, repeat: reduced ? 0 : 1, ease: 'easeInOut' }}>
      <path d="m177 62 49 17v35c0 29-49 52-49 52s-49-23-49-52V79z" fill="var(--ra-hero-ink)" stroke="#ffffffdd" strokeWidth="3" strokeLinejoin="round" />
      <path d="M160 126V97h34v29m-40 0h46M164 105h6m14 0h6m-26 9h6m14 0h6m-15 12v-11h6v11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="214" cy="64" r="17" fill="#fff" /><path d="m206 64 5 5 11-12" fill="none" stroke="var(--ra-hero-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </motion.g>
  </svg>
}

export default function RAWorkspaceHeader({ brand, mobile, compact, canCreate, onCreate, onReuse, onTemplates }) {
  const identity = { name: brand.name, logo_url: brand.logo, primary_color: brand.primary, secondary_color: brand.secondary }
  const colours = orgBrand(identity)
  if (compact) return <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
    <h1 style={{ display: 'flex', gap: 9, alignItems: 'center', margin: 0, color: 'var(--text)', fontSize: 22 }}><Icon name="safeguarding" size={23} />Risk assessments</h1>
  </div>
  return <section aria-label="Risk assessments workspace" style={{ position: 'relative', overflow: 'hidden', borderRadius: mobile ? 22 : 26, padding: mobile ? 20 : '26px 30px', marginBottom: 20, background: colours.hero, color: '#fff' }}>
    <div aria-hidden="true" style={{ position: 'absolute', width: 380, height: 380, border: '1px solid #ffffff20', borderRadius: '50%', right: -120, top: -200 }} />
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 18 }}><OrgLogo org={identity} height={42} maxWidth={150} /><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{brand.name}</span></div>
        <h1 style={{ margin: 0, fontFamily: brand.font.display, fontSize: mobile ? 29 : 36, lineHeight: 1.12, letterSpacing: -.8 }}>Risk assessments</h1>
        <p style={{ fontSize: 13, lineHeight: 1.7, margin: '10px 0 18px', color: '#ffffffdf', maxWidth: 500 }}>Plan ahead, review risks and keep your team prepared.</p>
        {canCreate && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onCreate} style={{ ...RA_BUTTON, background: '#fff', color: colours.ink, borderColor: 'transparent' }}><Icon name="add" size={16} />New assessment</button>
          <button type="button" onClick={onReuse} style={{ ...RA_BUTTON, background: '#ffffff16', color: '#fff', borderColor: '#ffffff50' }}><Icon name="history" size={16} />Use previous</button>
          <button type="button" onClick={onTemplates} style={{ ...RA_BUTTON, background: '#ffffff16', color: '#fff', borderColor: '#ffffff50' }}><Icon name="templates" size={16} />Use template</button>
        </div>}
      </div>
      {!mobile && <div style={{ flex: '0 0 210px', maxWidth: '28%' }}><SafetyIllustration /></div>}
    </div>
  </section>
}
