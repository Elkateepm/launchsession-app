import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Vector artwork inherits the plan-aware palette without loading a stock image
// or baking a particular organisation's identity into the workspace.
export default function OfficeIllustration() {
  const reduceMotion = useReducedMotion()
  return (
    <svg viewBox="0 0 340 230" width="100%" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      <ellipse cx="175" cy="197" rx="148" ry="17" fill="var(--office-soft)" opacity="0.7" />
      <circle cx="180" cy="108" r="92" fill="var(--office-soft)" opacity="0.65" />
      <circle cx="180" cy="108" r="111" fill="none" stroke="var(--office-border)" strokeDasharray="3 9" />
      <path d="M43 185h263" stroke="var(--office-ink)" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
      <rect x="94" y="57" width="167" height="114" rx="12" fill="var(--office-deep)" />
      <rect x="102" y="65" width="151" height="95" rx="6" fill="var(--surface)" />
      <rect x="113" y="77" width="51" height="7" rx="3.5" fill="var(--office-primary)" />
      <rect x="113" y="94" width="58" height="52" rx="6" fill="var(--office-tint)" />
      <path d="m130 119 8 8 17-19" fill="none" stroke="var(--office-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="181" y="96" width="57" height="6" rx="3" fill="var(--office-soft)" />
      <rect x="181" y="110" width="43" height="5" rx="2.5" fill="var(--office-soft)" />
      <rect x="181" y="132" width="57" height="14" rx="5" fill="var(--office-secondary-tint)" />
      <path d="m94 171-20 10q-3 6 7 6h193q10 0 6-6l-19-10" fill="var(--office-ink)" />
      <path d="M154 172h44l6 5h-56z" fill="var(--office-tint)" />
      <motion.g
        initial={false}
        animate={{ y: reduceMotion ? 0 : [0, -5, 0] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <rect x="46" y="36" width="62" height="74" rx="10" fill="var(--surface)" stroke="var(--office-border)" />
        <rect x="58" y="49" width="24" height="6" rx="3" fill="var(--office-primary)" />
        <path d="M59 69h35M59 79h25M59 89h30" stroke="var(--office-border)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="267" cy="69" r="24" fill="var(--office-secondary-tint)" stroke="var(--office-border)" />
        <path d="m257 69 7 7 13-15" fill="none" stroke="var(--office-secondary-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      <path d="M51 163v-28m0 15c-21-2-21-20-21-20 20 0 21 20 21 20m0-9c1-18 18-23 18-23s3 19-18 23" fill="var(--office-secondary-ink)" stroke="var(--office-secondary-ink)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M35 160h32l-5 24H40z" fill="var(--office-primary)" />
      <rect x="280" y="155" width="26" height="29" rx="6" fill="var(--office-secondary-tint)" stroke="var(--office-border)" />
      <path d="M306 160h5a7 7 0 0 1 0 14h-5" fill="none" stroke="var(--office-border)" strokeWidth="3" />
      <path d="M295 29v10m-5-5h10M22 95v8m-4-4h8" stroke="var(--office-secondary-ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
