import React, { useState, useMemo, useEffect } from 'react'
import { LS, IconGlyph } from '../galleryShared'
import { useIsMobile } from '../../../hooks/useIsMobile'

function StatCard({ icon, iconColor, iconBg, value, label, trend }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16, padding: '16px 18px' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <IconGlyph name={icon} color={iconColor} size={16} />
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: LS.text }}>{value}</div>
      <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 2 }}>{label}</div>
      {trend && <div style={{ fontSize: 11, fontWeight: 700, color: LS.success, marginTop: 4 }}>{trend}</div>}
    </div>
  )
}

export default function MemoryHero({ media, onUpload, onCreateAlbum }) {
  const isMobile = useIsMobile()
  const [slide, setSlide] = useState(0)

  const featuredImages = useMemo(() => media.filter(m => m.media_type !== 'video' && m.url).slice(0, 3), [media])

  useEffect(() => {
    if (featuredImages.length < 2) return
    const t = setInterval(() => setSlide(s => (s + 1) % featuredImages.length), 5000)
    return () => clearInterval(t)
  }, [featuredImages.length])

  const stats = useMemo(() => {
    const now = Date.now()
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    const photos = media.filter(m => m.media_type !== 'video')
    const videos = media.filter(m => m.media_type === 'video')
    const photosThisMonth = photos.filter(m => new Date(m.created_at).getTime() > monthAgo).length
    const videosThisMonth = videos.filter(m => new Date(m.created_at).getTime() > monthAgo).length
    const sessionIds = new Set(media.filter(m => m.session_id).map(m => m.session_id))
    const sessionsThisMonth = new Set(media.filter(m => m.session_id && new Date(m.created_at).getTime() > monthAgo).map(m => m.session_id))
    const reviewed = media.filter(m => m.consent_status !== 'pending_review').length
    const coveragePct = media.length > 0 ? Math.round((reviewed / media.length) * 100) : null
    return {
      photoCount: photos.length, photosThisMonth,
      videoCount: videos.length, videosThisMonth,
      sessionCount: sessionIds.size, sessionsThisMonth: sessionsThisMonth.size,
      coveragePct,
    }
  }, [media])

  const coverageLabel = stats.coveragePct === null ? 'No media yet'
    : stats.coveragePct >= 90 ? 'Excellent'
    : stats.coveragePct >= 60 ? 'Good progress'
    : 'Needs review'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
      {/* Featured memory hero */}
      <div style={{
        position: 'relative', borderRadius: 22, overflow: 'hidden', minHeight: isMobile ? 260 : 320,
        background: featuredImages.length ? '#111' : LS.gradient,
      }}>
        {featuredImages.length > 0 && (
          <img src={featuredImages[slide]?.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: featuredImages.length ? 'linear-gradient(90deg, rgba(20,10,50,0.88) 10%, rgba(20,10,50,0.35) 55%, rgba(20,10,50,0.15) 100%)' : 'none' }} />

        {featuredImages.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.12) 0, transparent 2px), radial-gradient(circle at 40% 80%, rgba(255,255,255,0.1) 0, transparent 2px)', backgroundSize: '160px 160px' }} />
        )}

        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: isMobile ? '24px 20px' : '30px 34px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <IconGlyph name="camera" color="#fff" size={22} />
          </div>
          <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Memory Vault</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#C9B8FF', marginTop: 4 }}>Every session tells a story.</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 8, marginBottom: 20 }}>Capturing moments, building impact.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={onUpload} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, border: 'none',
              background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
              boxShadow: `0 8px 20px ${LS.purple}55`,
            }}>
              <IconGlyph name="camera" color="#fff" size={15} /> Upload Photos
            </button>
            <button onClick={onCreateAlbum} style={{
              padding: '11px 20px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            }}>
              Create Album
            </button>
          </div>
        </div>

        {featuredImages.length > 1 && (
          <div style={{ position: 'absolute', bottom: 14, right: 20, display: 'flex', gap: 5 }}>
            {featuredImages.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)} style={{
                width: 6, height: 6, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                background: i === slide ? '#fff' : 'rgba(255,255,255,0.4)',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignContent: 'start' }}>
        <StatCard icon="camera" iconColor={LS.purpleDark} iconBg={LS.lavender} value={stats.photoCount.toLocaleString()} label="Photos"
          trend={stats.photosThisMonth > 0 ? `+${stats.photosThisMonth} this month` : null} />
        <StatCard icon="video" iconColor="#B0295C" iconBg="#FCE7F0" value={stats.videoCount.toLocaleString()} label="Videos"
          trend={stats.videosThisMonth > 0 ? `+${stats.videosThisMonth} this month` : null} />
        <StatCard icon="calendar" iconColor="#2F6FE0" iconBg="#E9F0FA" value={stats.sessionCount.toLocaleString()} label="Sessions Captured"
          trend={stats.sessionsThisMonth > 0 ? `+${stats.sessionsThisMonth} this month` : null} />
        <StatCard icon="heart" iconColor="#B45309" iconBg="#FDF3E4" value={stats.coveragePct === null ? '—' : `${stats.coveragePct}%`} label="Consent Reviewed"
          trend={coverageLabel} />
      </div>
    </div>
  )
}
