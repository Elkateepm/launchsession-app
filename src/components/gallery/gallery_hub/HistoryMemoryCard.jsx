import React from 'react'
import { LS } from '../galleryShared'

export default function HistoryMemoryCard({ memory, onRelive }) {
  if (!memory) return null

  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text, marginBottom: 2 }}>This Week in History</div>
      <div style={{ fontSize: 11.5, color: LS.muted, marginBottom: 14 }}>{memory.yearsAgo} year{memory.yearsAgo === 1 ? '' : 's'} ago today</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#F3F2F7' }}>
          {memory.coverUrl && <img src={memory.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: LS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memory.title}</div>
          <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 2 }}>{memory.photoCount} photos · {memory.videoCount} videos</div>
          <button onClick={() => onRelive(memory)} style={{
            marginTop: 8, padding: '6px 14px', borderRadius: 9, border: 'none', background: LS.gradient,
            color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer',
          }}>
            Relive Memories →
          </button>
        </div>
      </div>
    </div>
  )
}
