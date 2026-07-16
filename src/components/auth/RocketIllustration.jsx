import React from 'react'

export default function RocketIllustration({ width = 200 }) {
  return (
    <svg width={width} viewBox="0 0 240 260" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C7D2FE" />
        </linearGradient>
        <linearGradient id="rocketFin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <radialGradient id="flameCore" cx="50%" cy="0%" r="85%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cloudGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C4D3FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6D7FE0" stopOpacity="0" />
        </radialGradient>
        <filter id="softBlur"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="flameBlur"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      {/* Cloud puffs */}
      <g filter="url(#softBlur)">
        <ellipse cx="70" cy="215" rx="60" ry="26" fill="url(#cloudGrad)" />
        <ellipse cx="130" cy="228" rx="70" ry="28" fill="url(#cloudGrad)" />
        <ellipse cx="185" cy="205" rx="45" ry="22" fill="url(#cloudGrad)" />
      </g>

      {/* Vapor trail */}
      <path d="M 150 190 C 110 205, 90 218, 55 224" stroke="#93A9F0" strokeOpacity="0.35" strokeWidth="10"
        strokeLinecap="round" fill="none" filter="url(#softBlur)" />

      {/* Rocket group, angled for an ascending look */}
      <g transform="translate(120 128) rotate(-28)">
        {/* Flame */}
        <path d="M -13 60 C -13 82, 0 108, 0 108 C 0 108, 13 82, 13 60 Z" fill="url(#flameCore)" filter="url(#flameBlur)" />

        {/* Fins */}
        <path d="M -16 40 L -36 68 L -12 58 Z" fill="url(#rocketFin)" />
        <path d="M 16 40 L 36 68 L 12 58 Z" fill="url(#rocketFin)" />

        {/* Body */}
        <path d="M 0 -70 C 20 -46, 20 20, 20 44 C 20 54, 12 62, 0 64 C -12 62, -20 54, -20 44 C -20 20, -20 -46, 0 -70 Z"
          fill="url(#rocketBody)" stroke="#93A9F0" strokeWidth="1.5" />

        {/* Nose cone accent */}
        <path d="M 0 -70 C 8 -58, 12 -40, 12 -28 L -12 -28 C -12 -40, -8 -58, 0 -70 Z" fill="#8B5CF6" opacity="0.85" />

        {/* Window */}
        <circle cx="0" cy="-4" r="11" fill="#0B0F27" />
        <circle cx="0" cy="-4" r="11" fill="none" stroke="#60A5FA" strokeWidth="2.5" />
        <circle cx="-3.5" cy="-7.5" r="3" fill="#93C5FD" opacity="0.8" />
      </g>

      {/* Small sparkle accents near the rocket */}
      <path d="M198 66 C198.6 72, 201 74.4, 207 75 C201 75.6, 198.6 78, 198 84 C197.4 78, 195 75.6, 189 75 C195 74.4, 197.4 72, 198 66Z" fill="#C4B5FD" opacity="0.85" />
      <path d="M40 96 C40.4 100, 42 101.6, 46 102 C42 102.4, 40.4 104, 40 108 C39.6 104, 38 102.4, 34 102 C38 101.6, 39.6 100, 40 96Z" fill="#93C5FD" opacity="0.7" />
    </svg>
  )
}
