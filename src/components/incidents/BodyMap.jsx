import React from 'react'
import Icon from '../../lib/icons'

// ─── BODY MAP ────────────────────────────────────────────────
// Ported from the Solidarity Sports hub. The shapes, the regions and the
// reasoning are unchanged; only the icon and the colour tokens differ, because
// this app has no Tabler icon font and no --muted variable.
//
// Tap where it hurts. Faster than reading nine labels, and it is what someone
// does naturally when describing an injury.
//
// The regions map onto the same body_part values the list uses, so a record
// made either way is comparable. The list stays underneath: an SVG-only picker
// would be unusable with a screen reader or a keyboard, and this form has to
// work for whoever is holding the phone.
//
// Left and right are not distinguished. A single 'Shoulder or arm' matches the
// values already recorded, and "which arm" belongs in the account of what
// happened rather than in a field that would then need migrating.

const SELECTED = '#C0392B'
const RESTING = '#D8DDE4'
const HOVER_STROKE = '#B9C1CB'

// [region key, svg element props] — one label per shape, several shapes may
// share a label (two arms, upper and lower leg).
const REGIONS = [
  ['Head or face',    'circle',  { cx: 60, cy: 22, r: 16 }],
  ['Neck',            'rect',    { x: 54, y: 36, width: 12, height: 10, rx: 3 }],
  ['Chest or back',   'rect',    { x: 40, y: 45, width: 40, height: 47, rx: 9 }],
  ['Shoulder or arm', 'rect',    { x: 25, y: 47, width: 13, height: 75, rx: 6 }],
  ['Shoulder or arm', 'rect',    { x: 82, y: 47, width: 13, height: 75, rx: 6 }],
  ['Hand or fingers', 'ellipse', { cx: 31.5, cy: 131, rx: 8, ry: 9 }],
  ['Hand or fingers', 'ellipse', { cx: 88.5, cy: 131, rx: 8, ry: 9 }],
  ['Hip or leg',      'rect',    { x: 42, y: 93, width: 36, height: 26, rx: 7 }],
  ['Hip or leg',      'rect',    { x: 44, y: 120, width: 15, height: 54, rx: 6 }],
  ['Hip or leg',      'rect',    { x: 61, y: 120, width: 15, height: 54, rx: 6 }],
  ['Knee',            'circle',  { cx: 51.5, cy: 180, r: 8 }],
  ['Knee',            'circle',  { cx: 68.5, cy: 180, r: 8 }],
  ['Hip or leg',      'rect',    { x: 45, y: 188, width: 13, height: 42, rx: 5 }],
  ['Hip or leg',      'rect',    { x: 62, y: 188, width: 13, height: 42, rx: 5 }],
  ['Foot or toes',    'ellipse', { cx: 51.5, cy: 236, rx: 8, ry: 8 }],
  ['Foot or toes',    'ellipse', { cx: 68.5, cy: 236, rx: 8, ry: 8 }],
]

// Hands, knees and feet are drawn small because that is their size on a body,
// but a 10px target is not tappable with a thumb. These sit invisibly on top,
// generous enough to hit without aiming.
const HIT_TARGETS = [
  ['Neck',            { cx: 60, cy: 41, r: 11 }],
  ['Hand or fingers', { cx: 31.5, cy: 131, r: 14 }],
  ['Hand or fingers', { cx: 88.5, cy: 131, r: 14 }],
  ['Knee',            { cx: 51.5, cy: 180, r: 11 }],
  ['Knee',            { cx: 68.5, cy: 180, r: 11 }],
  ['Foot or toes',    { cx: 51.5, cy: 236, r: 13 }],
  ['Foot or toes',    { cx: 68.5, cy: 236, r: 13 }],
]

export default function BodyMap({ value, onChange }) {
  const pick = region => onChange(value === region ? '' : region)
  const handlers = region => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': region,
    'aria-pressed': value === region,
    onClick: () => pick(region),
    onKeyDown: e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(region) }
    },
    style: { cursor: 'pointer', outline: 'none' },
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg
        viewBox="0 0 120 250"
        role="group"
        aria-label="Body diagram — choose where the injury is"
        style={{ width: 148, height: 308, flexShrink: 0, touchAction: 'manipulation' }}
      >
        {REGIONS.map(([region, Tag, props], i) => {
          const on = value === region
          return React.createElement(Tag, {
            key: i,
            ...props,
            ...handlers(region),
            fill: on ? SELECTED : RESTING,
            stroke: on ? SELECTED : HOVER_STROKE,
            strokeWidth: 1.5,
          })
        })}
        {/* Drawn last so they sit above the visible shapes and take the tap. */}
        {HIT_TARGETS.map(([region, props], i) => (
          <circle key={`hit-${i}`} {...props} {...handlers(region)} fill="transparent" />
        ))}
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B', lineHeight: 1.55 }}>
          Tap the nearest area, or choose from the list below.
        </div>
        {value && (
          <div style={{ marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FDEEEC', border: `1.5px solid ${SELECTED}40`, color: SELECTED, borderRadius: 99, padding: '6px 12px', fontSize: 12.5, fontWeight: 800 }}>
            <Icon name="📍" />{value}
          </div>
        )}
      </div>
    </div>
  )
}
