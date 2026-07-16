import React from 'react'

// Full-width cloud "horizon" silhouette that sits beneath the rocket, spanning the
// whole hero width independently of the rocket illustration's own size/position.
export default function CloudLayer({ width = '100%', height = 130 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 400 130" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="cloudFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2B3568" stopOpacity="0" />
          <stop offset="35%" stopColor="#232D5C" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#161B42" stopOpacity="1" />
        </linearGradient>
        <filter id="cloudSoften"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <g filter="url(#cloudSoften)">
        <path d="M0,90
          C 20,60 55,55 85,70
          C 100,45 140,42 165,62
          C 185,40 225,38 250,60
          C 270,42 310,45 330,68
          C 355,52 385,58 400,75
          L 400,130 L 0,130 Z" fill="url(#cloudFill)" />
      </g>
    </svg>
  )
}
