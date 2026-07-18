import React from 'react'
import { LS, IconGlyph } from '../galleryShared'
import MemoryTimelineCard from './MemoryTimelineCard'
import GalleryEmptyState from './GalleryEmptyState'

// Cycles through a few accent colours for the big date badges, purely for visual variety
// (matches the reference design) — not tied to category, since a day can mix categories.
const DATE_ACCENTS = [
  { solid: '#7C5CFC', bg: 'linear-gradient(135deg,#8B6CFF,#6647F0)' },
  { solid: '#2F6FE0', bg: 'linear-gradient(135deg,#4E9EFF,#2F6FE0)' },
  { solid: '#DB2777', bg: 'linear-gradient(135deg,#F472B6,#DB2777)' },
]

export default function MemoryTimeline({ groupedByDay, onView, onToggleFavourite, onAction, hasMore, onLoadMore, onUpload, hasAnyMedia }) {
  const dayKeys = Object.keys(groupedByDay)
  const flatGroups = dayKeys.flatMap(k => groupedByDay[k])

  if (dayKeys.length === 0) {
    return (
      <GalleryEmptyState
        icon="camera"
        title={hasAnyMedia ? 'No memories match these filters' : 'Your memories will appear here'}
        subtitle={hasAnyMedia
          ? 'Try a different category or clear your filters to see more.'
          : 'Upload photos from sessions, trips and celebrations to build your organisation\u2019s visual story.'}
        actions={!hasAnyMedia && (
          <button onClick={onUpload} style={{ padding: '10px 22px', borderRadius: 11, border: 'none', background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Upload Photos
          </button>
        )}
      />
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconGlyph name="calendar" color={LS.purpleDark} size={16} />
          <div style={{ fontSize: 15, fontWeight: 800, color: LS.text }}>Latest Memories</div>
        </div>
        <div style={{ fontSize: 12, color: LS.muted, marginTop: 2, marginLeft: 24 }}>Your recent highlights, beautifully captured</div>
      </div>

      {flatGroups.map((group, i) => {
        const accent = DATE_ACCENTS[i % DATE_ACCENTS.length]
        const d = new Date(group.date)
        const isLast = i === flatGroups.length - 1
        return (
          <div key={group.id} style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 64 }}>
              <div style={{
                position: 'relative', width: 62, height: 62, borderRadius: 18, background: accent.bg,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 18px ${accent.solid}40`, flexShrink: 0,
              }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{d.getDate()}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', marginTop: 2 }}>{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                {i === 0 && (
                  <div style={{ position: 'absolute', top: -6, right: -6 }}>
                    <IconGlyph name="sparkle" color="#FBBF24" size={16} />
                  </div>
                )}
              </div>
              {!isLast && <div style={{ flex: 1, width: 2, background: LS.border, margin: '8px 0', minHeight: 24 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 20 }}>
              <MemoryTimelineCard group={group} onView={onView} onToggleFavourite={onToggleFavourite} onAction={onAction} />
            </div>
          </div>
        )
      })}

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button onClick={onLoadMore} style={{
            padding: '11px 26px', borderRadius: 12, border: `1.5px solid ${LS.lavenderBorder}`, background: '#fff',
            color: LS.purpleDark, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Load more memories ↓
          </button>
        </div>
      )}
    </div>
  )
}
