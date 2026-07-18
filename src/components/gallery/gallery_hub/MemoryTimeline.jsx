import React from 'react'
import { LS, IconGlyph } from '../galleryShared'
import MemoryTimelineCard from './MemoryTimelineCard'
import GalleryEmptyState from './GalleryEmptyState'

export default function MemoryTimeline({ groupedByDay, onView, onToggleFavourite, onAction, hasMore, onLoadMore, onUpload, hasAnyMedia }) {
  const dayKeys = Object.keys(groupedByDay)

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <IconGlyph name="calendar" color={LS.purpleDark} size={16} />
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Latest Memories</div>
      </div>

      {dayKeys.map(dayLabel => (
        <div key={dayLabel} style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, flexShrink: 0, width: 14 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: LS.purple, flexShrink: 0 }} />
            <div style={{ flex: 1, width: 2, background: LS.border, marginTop: 4 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: LS.text, marginBottom: 2 }}>{dayLabel}</div>
            <div style={{ fontSize: 11, color: LS.muted, marginBottom: 12 }}>{groupedByDay[dayLabel][0]?.dateLabel}</div>
            {groupedByDay[dayLabel].map(group => (
              <MemoryTimelineCard key={group.id} group={group} onView={onView} onToggleFavourite={onToggleFavourite} onAction={onAction} />
            ))}
          </div>
        </div>
      ))}

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
