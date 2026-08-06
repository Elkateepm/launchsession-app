import React from 'react'

// A small, consistent line-icon set (24x24, stroke=currentColor) used across
// onboarding wherever a real icon is needed instead of an emoji — emoji
// render inconsistently across platforms/fonts and read as less premium at
// this size. Kept as one file so every icon shares the same stroke weight,
// cap style, and viewBox.
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const Icons = {
  heart: (p) => <svg {...base} {...p}><path d="M12 20s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5c-2.5 4.65-9.5 9-9.5 9z" /></svg>,
  ball: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7l3.5 2.5-1.3 4.1H9.8L8.5 9.5z" /><path d="M12 3v4M4.2 8l3.3 1M19.8 8l-3.3 1M6 19l2-3.5M18 19l-2-3.5" /></svg>,
  building: (p) => <svg {...base} {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1M10 21v-4h4v4" /></svg>,
  backpack: (p) => <svg {...base} {...p}><path d="M7 9V7a5 5 0 0 1 10 0v2" /><rect x="5" y="9" width="14" height="12" rx="2.5" /><path d="M9 9v3h6V9M9 15h6" /></svg>,
  users: (p) => <svg {...base} {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M15.8 14c2.4.4 4.2 2.4 4.2 5" /></svg>,
  handshake: (p) => <svg {...base} {...p}><path d="M2 12l4-4 3 2 3-2 4 4" /><path d="M5 8l4.5 4.5a1.5 1.5 0 0 0 2.1 0l.2-.2a1.5 1.5 0 0 0 0-2.1" /><path d="M19 8l-3 3M22 12l-4-4-2 2" /><path d="M9 13l2 2a1.5 1.5 0 0 0 2.1 0" /></svg>,
  sun: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>,
  compass: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2l-1.6 4.4-4.4 1.6 1.6-4.4z" /></svg>,
  cap: (p) => <svg {...base} {...p}><path d="M2 9l10-4.5L22 9l-10 4.5z" /><path d="M6 11v4.5c0 1.4 2.7 3 6 3s6-1.6 6-3V11" /><path d="M22 9v6" /></svg>,
  columns: (p) => <svg {...base} {...p}><path d="M3 21h18M4 21V9l8-5 8 5v12" /><path d="M8 21v-8M12 21v-8M16 21v-8" /></svg>,
  leaf: (p) => <svg {...base} {...p}><path d="M5 19c8-1 13-6 14-14C11 6 6 11 5 19z" /><path d="M5 19c1.5-3 4-5.5 8-7" /></svg>,
  sparkle: (p) => <svg {...base} {...p}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" /><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" /></svg>,
  shield: (p) => <svg {...base} {...p}><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>,
}

export function Icon({ name, ...rest }) {
  const C = Icons[name] || Icons.sparkle
  return C(rest)
}
