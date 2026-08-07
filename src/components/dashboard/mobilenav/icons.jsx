import React from 'react'

// Minimal, consistent-weight outline icons for the Mission Control Dock.
// Plain SVG (no icon library dependency) so every icon shares the same
// stroke width / cap style regardless of where it's used.
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function HouseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

export function ClipboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="4.5" width="12" height="16" rx="2" />
      <path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" />
      <path d="M9 11h6M9 15h6M9 19h3.5" />
    </svg>
  )
}

export function SparkleIcon(props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M12 2c.6 5.2 1.4 7.2 6 8.5-4.6 1.3-5.4 3.3-6 8.5-.6-5.2-1.4-7.2-6-8.5 4.6-1.3 5.4-3.3 6-8.5Z" />
    </svg>
  )
}

export function PeopleIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.2 12.3A4.6 4.6 0 0 1 20.5 16.5" />
    </svg>
  )
}

export function MenuIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CalendarPlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" />
      <path d="M12 13v5M9.5 15.5h5" />
    </svg>
  )
}

export function UserPlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9.5" cy="8.5" r="3.5" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  )
}

export function QrCodeIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2.5v2.5H14zM17.5 14H20M14 17.5h2.5M17.5 17.5H20V20h-2.5" />
    </svg>
  )
}

export function FileTextIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 12.5h6M9 16h6" />
    </svg>
  )
}

export function ShieldAlertIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 19 6.5V11c0 5-3 8-7 9.5C8 19 5 16 5 11V6.5Z" />
      <path d="M12 8.5v4M12 15.5h.01" />
    </svg>
  )
}

export function HeartHandshakeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 8 8l3 2.5-2.5 2.5c-.5.5-.5 1.2 0 1.7s1.2.5 1.7 0l3.3-3.3L18 14.5" />
      <path d="M4 11.5 2.5 13v4.5L4 19l3-2 2 1.5c.7.5 1.6.5 2.2-.1l6-6" />
      <path d="M18 14.5 20 12.5 21.5 14v4.5L20 20l-3-2" />
    </svg>
  )
}

export function CreditCardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M6.5 14.5h4" />
    </svg>
  )
}
