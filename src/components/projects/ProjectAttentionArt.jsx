import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Inherit the entitled brand colours so the illustration belongs to every org.
export default function ProjectAttentionArt({ clear = false }) {
  const reduced = useReducedMotion()
  return <svg viewBox="0 0 180 160" width="100%" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
    <circle cx="92" cy="82" r="68" fill="var(--attention-soft)" />
    <circle cx="92" cy="82" r="77" fill="none" stroke="var(--attention-border)" strokeDasharray="2 8" />
    <ellipse cx="90" cy="143" rx="57" ry="7" fill="var(--attention-border)" opacity=".5" />
    <g transform="rotate(-9 83 77)">
      <rect x="40" y="22" width="90" height="116" rx="13" fill="var(--attention-ink)" opacity=".12" transform="translate(4 4)" />
      <rect x="40" y="22" width="90" height="116" rx="13" fill="var(--surface)" stroke="var(--attention-border)" strokeWidth="2" />
      <rect x="66" y="15" width="38" height="15" rx="6" fill="var(--attention-ink)" />
      {[52, 78, 104].map((y, i) => <g key={y}>
        <rect x="54" y={y} width="14" height="14" rx="4" fill="var(--attention-tint)" stroke="var(--attention-border)" />
        <path d={`M78 ${y + 4}h33M78 ${y + 11}h23`} stroke="var(--attention-border)" strokeWidth="3" strokeLinecap="round" />
        {(clear || i < 2) && <motion.path d={`m57 ${y + 7} 3 3 5-6`} fill="none" stroke="var(--attention-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .5, delay: reduced ? 0 : .25 + i * .18 }} />}
      </g>)}
    </g>
    <motion.g initial={false} animate={{ y: reduced ? 0 : [0, -5, 0] }} transition={{ duration: reduced ? 0 : 2.4, repeat: reduced ? 0 : 1, ease: 'easeInOut' }}>
      <path d="m134 69 28 10v22c0 17-28 31-28 31s-28-14-28-31V79z" fill="var(--attention-ink)" stroke="var(--surface)" strokeWidth="4" strokeLinejoin="round" />
      {clear ? <path d="m121 99 9 9 18-20" fill="none" stroke="var(--attention-tint)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        : <><path d="M134 88v16" stroke="var(--attention-tint)" strokeWidth="4" strokeLinecap="round" /><circle cx="134" cy="113" r="2.5" fill="var(--attention-tint)" /></>}
    </motion.g>
    <path d="M151 35v12m-6-6h12M24 99v8m-4-4h8" stroke="var(--attention-ink)" strokeWidth="2" strokeLinecap="round" opacity=".65" />
    <circle cx="27" cy="53" r="4" fill="var(--attention-secondary)" />
  </svg>
}
