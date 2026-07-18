import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { LS, IconGlyph, CATEGORIES, timelineGroupLabel } from './galleryShared'
import MemoryHero from './gallery_hub/MemoryHero'
import GalleryFilters from './gallery_hub/GalleryFilters'
import MemoryTimeline from './gallery_hub/MemoryTimeline'
import GalleryGrid from './gallery_hub/GalleryGrid'
import HighlightsPanel from './gallery_hub/HighlightsPanel'
import CollectionsPanel from './gallery_hub/CollectionsPanel'
import HistoryMemoryCard from './gallery_hub/HistoryMemoryCard'
import GalleryLightbox from './gallery_hub/GalleryLightbox'
import GalleryUploadWizard from './gallery_hub/GalleryUploadWizard'

const CONSENT_SEVERITY = ['do_not_publish', 'consent_required', 'pending_review', 'internal_only', 'approved']
const PAGE_SIZE = 8

function pickCover(items) {
  const withImage = items.find(i => i.media_type !== 'video') || items[0]
  return { url: withImage?.url, isVideo: withImage?.media_type === 'video' }
}

function worstConsent(items) {
  for (const s of CONSENT_SEVERITY) {
    if (items.some(i => i.consent_status === s)) return s
  }
  return 'pending_review'
}

export default function Gallery({ org, session }) {
  const isMobile = useIsMobile()
  const [media, setMedia] = useState([])
  const [sessionsById, setSessionsById] = useState({})
  const [sessionCounts, setSessionCounts] = useState({})
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activeCategory, setActiveCategory] = useState('All')
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false)
  const [advanced, setAdvanced] = useState({ mediaType: 'all', consentStatus: 'all', safeToShareOnly: false })
  const [viewMode, setViewMode] = useState('timeline') // timeline | grid
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const [lightboxItems, setLightboxItems] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadDefaults, setUploadDefaults] = useState({})
  const [movePickerGroup, setMovePickerGroup] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [{ data: photos, error: mErr }, { data: sessions }, { data: cols }] = await Promise.all([
      supabase.from('gallery_photos').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('sessions').select('id, title, session_date, location').eq('org_id', org.id),
      supabase.from('gallery_collections').select('*').eq('org_id', org.id).order('created_at'),
    ])
    if (mErr) { setError('Could not load your gallery. Please try again.'); setLoading(false); return }
    setMedia(photos || [])
    const sMap = {}
    ;(sessions || []).forEach(s => { sMap[s.id] = s })
    setSessionsById(sMap)
    setCollections(cols || [])

    const sessionIds = [...new Set((photos || []).filter(p => p.session_id).map(p => p.session_id))]
    if (sessionIds.length > 0) {
      const [{ data: att }, { data: staff }] = await Promise.all([
        supabase.from('attendance').select('session_id, child_id').eq('org_id', org.id).eq('status', 'signed_in').in('session_id', sessionIds),
        supabase.from('session_staff').select('session_id, user_id, volunteer_id').eq('org_id', org.id).in('session_id', sessionIds),
      ])
      const counts = {}
      sessionIds.forEach(id => { counts[id] = { young: new Set(), vol: new Set() } })
      ;(att || []).forEach(a => counts[a.session_id]?.young.add(a.child_id))
      ;(staff || []).forEach(s => counts[s.session_id]?.vol.add(s.volunteer_id || s.user_id))
      const finalCounts = {}
      Object.entries(counts).forEach(([id, v]) => { finalCounts[id] = { young: v.young.size, vol: v.vol.size } })
      setSessionCounts(finalCounts)
    } else {
      setSessionCounts({})
    }
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // Filtering
  const filteredMedia = useMemo(() => {
    return media.filter(m => {
      if (activeCategory !== 'All' && m.category !== activeCategory) return false
      if (showFavouritesOnly && !m.is_favourite) return false
      if (advanced.mediaType !== 'all' && m.media_type !== advanced.mediaType) return false
      if (advanced.consentStatus !== 'all' && m.consent_status !== advanced.consentStatus) return false
      if (advanced.safeToShareOnly && m.consent_status !== 'approved') return false
      return true
    })
  }, [media, activeCategory, showFavouritesOnly, advanced])

  const counts = useMemo(() => {
    const c = {}
    CATEGORIES.forEach(cat => { c[cat.key] = cat.key === 'All' ? media.length : media.filter(m => m.category === cat.key).length })
    return c
  }, [media])

  // Group into albums (by session, or by category+day fallback)
  const allGroups = useMemo(() => {
    const bySession = {}
    const byFallback = {}
    filteredMedia.forEach(item => {
      if (item.session_id) {
        (bySession[item.session_id] = bySession[item.session_id] || []).push(item)
      } else {
        const dayKey = (item.created_at || '').slice(0, 10)
        const key = `${item.category || 'Other'}__${dayKey}`
        ;(byFallback[key] = byFallback[key] || []).push(item)
      }
    })

    const groups = []
    Object.entries(bySession).forEach(([sid, items]) => {
      const s = sessionsById[sid]
      const cover = pickCover(items)
      groups.push({
        id: `session-${sid}`, sessionId: sid, items,
        title: s?.title || 'Session',
        date: s?.session_date || items[0].created_at,
        location: s?.location || items[0].location || null,
        categoryLabel: items[0].category,
        coverUrl: cover.url, coverIsVideo: cover.isVideo,
        photoCount: items.filter(i => i.media_type !== 'video').length,
        videoCount: items.filter(i => i.media_type === 'video').length,
        youngPeopleCount: sessionCounts[sid] ? sessionCounts[sid].young : null,
        volunteerCount: sessionCounts[sid] ? sessionCounts[sid].vol : null,
        isFavourite: items.some(i => i.is_favourite),
        consentStatus: worstConsent(items),
        caption: items.find(i => i.caption)?.caption || null,
      })
    })
    Object.entries(byFallback).forEach(([key, items]) => {
      const [cat, day] = key.split('__')
      const cover = pickCover(items)
      groups.push({
        id: `day-${key}`, sessionId: null, items,
        title: (!cat || cat === 'Other') ? 'Unsorted Memories' : cat,
        date: day || items[0].created_at,
        location: items[0].location || null,
        categoryLabel: cat,
        coverUrl: cover.url, coverIsVideo: cover.isVideo,
        photoCount: items.filter(i => i.media_type !== 'video').length,
        videoCount: items.filter(i => i.media_type === 'video').length,
        youngPeopleCount: null, volunteerCount: null,
        isFavourite: items.some(i => i.is_favourite),
        consentStatus: worstConsent(items),
        caption: items.find(i => i.caption)?.caption || null,
      })
    })
    groups.sort((a, b) => new Date(b.date) - new Date(a.date))
    return groups
  }, [filteredMedia, sessionsById, sessionCounts])

  const visibleGroups = allGroups.slice(0, visibleCount)
  const hasMore = allGroups.length > visibleCount

  const groupedByDay = useMemo(() => {
    const out = {}
    visibleGroups.forEach(g => {
      const label = timelineGroupLabel(g.date)
      out[label] = out[label] || []
      const dateLabel = new Date(g.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      out[label].push({ ...g, dateLabel })
    })
    return out
  }, [visibleGroups])

  // Collections with computed cover/count
  const collectionsWithMeta = useMemo(() => {
    return collections.map(c => {
      const items = media.filter(m => m.collection_id === c.id)
      const cover = items.length ? pickCover(items) : {}
      return { ...c, mediaCount: items.length, coverUrl: cover.url }
    })
  }, [collections, media])

  // This Week in History
  const historyMemory = useMemo(() => {
    const now = new Date()
    let best = null, bestDiff = Infinity
    allGroups.forEach(g => {
      const d = new Date(g.date)
      const yearsAgo = now.getFullYear() - d.getFullYear()
      if (yearsAgo < 1) return
      const thisYearEquivalent = new Date(d)
      thisYearEquivalent.setFullYear(now.getFullYear() - (yearsAgo - 1))
      const diff = Math.abs((thisYearEquivalent - now) / (1000 * 60 * 60 * 24))
      if (diff <= 4 && diff < bestDiff) { best = { ...g, yearsAgo }; bestDiff = diff }
    })
    return best
  }, [allGroups])

  // Actions
  const toggleFavouriteItem = async (item) => {
    const next = !item.is_favourite
    setMedia(m => m.map(x => x.id === item.id ? { ...x, is_favourite: next } : x))
    await supabase.from('gallery_photos').update({ is_favourite: next }).eq('id', item.id)
  }

  const toggleFavouriteGroup = async (group) => {
    const next = !group.isFavourite
    const ids = group.items.map(i => i.id)
    setMedia(m => m.map(x => ids.includes(x.id) ? { ...x, is_favourite: next } : x))
    await supabase.from('gallery_photos').update({ is_favourite: next }).in('id', ids)
  }

  const saveMediaDetails = async (item, patch) => {
    setMedia(m => m.map(x => x.id === item.id ? { ...x, ...patch } : x))
    await supabase.from('gallery_photos').update(patch).eq('id', item.id)
    showToast('Saved')
  }

  const deleteItems = async (items) => {
    const paths = items.map(i => i.path).filter(Boolean)
    if (paths.length) await supabase.storage.from('gallery').remove(paths)
    await supabase.from('gallery_photos').delete().in('id', items.map(i => i.id))
    setMedia(m => m.filter(x => !items.some(i => i.id === x.id)))
  }

  const handleDeleteMedia = async (item) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    await deleteItems([item])
    setLightboxItems(null)
    showToast('Deleted')
  }

  const downloadItem = (item) => {
    const a = document.createElement('a')
    a.href = item.url
    a.download = item.caption || 'memory'
    a.target = '_blank'
    document.body.appendChild(a); a.click(); a.remove()
  }

  const shareItem = async (item) => {
    const shareData = { title: item.caption || 'Memory', url: item.url }
    try {
      if (navigator.share) await navigator.share(shareData)
      else { await navigator.clipboard.writeText(item.url); showToast('Link copied to clipboard') }
    } catch (e) { /* user cancelled */ }
  }

  const createCollection = async (name) => {
    const { data, error } = await supabase.from('gallery_collections').insert({ org_id: org.id, name }).select().single()
    if (!error && data) setCollections(c => [...c, data])
  }

  const moveGroupToCollection = async (group, collectionId) => {
    const ids = group.items.map(i => i.id)
    setMedia(m => m.map(x => ids.includes(x.id) ? { ...x, collection_id: collectionId || null } : x))
    await supabase.from('gallery_photos').update({ collection_id: collectionId || null }).in('id', ids)
    setMovePickerGroup(null)
    showToast('Moved')
  }

  const handleTimelineAction = async (action, group) => {
    if (action === 'add') { setUploadDefaults({ defaultSessionId: group.sessionId, defaultCategory: group.categoryLabel }); setShowUpload(true) }
    else if (action === 'share') shareItem(group.items[0])
    else if (action === 'download') group.items.forEach(downloadItem)
    else if (action === 'move') setMovePickerGroup(group)
    else if (action === 'archive') {
      let archived = collections.find(c => c.name === 'Archived')
      if (!archived) {
        const { data } = await supabase.from('gallery_collections').insert({ org_id: org.id, name: 'Archived' }).select().single()
        archived = data
        if (archived) setCollections(c => [...c, archived])
      }
      if (archived) await moveGroupToCollection(group, archived.id)
    }
    else if (action === 'delete') {
      if (!window.confirm(`Delete all ${group.items.length} item(s) in "${group.title}"? This cannot be undone.`)) return
      await deleteItems(group.items)
      showToast('Album deleted')
    }
  }

  const openLightboxForGroup = (group) => { setLightboxItems(group.items); setLightboxIndex(0) }
  const openLightboxForItem = (item) => {
    const idx = filteredMedia.findIndex(m => m.id === item.id)
    setLightboxItems(filteredMedia)
    setLightboxIndex(idx >= 0 ? idx : 0)
  }

  const toggleSelect = (id) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div style={{ position: 'relative' }}>
      {isMobile && (
        <button onClick={() => { setUploadDefaults({}); setShowUpload(true) }} style={{
          position: 'fixed', bottom: 20, right: 18, zIndex: 90, width: 56, height: 56, borderRadius: '50%',
          border: 'none', background: LS.gradient, color: '#fff', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 24px ${LS.purple}55`,
        }} title="Upload Photos">
          <IconGlyph name="camera" color="#fff" size={22} />
        </button>
      )}
      {toast && (
        <div style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: LS.text, color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 12.5, fontWeight: 600, boxShadow: '0 10px 26px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}

      {error && (
        <div style={{ background: '#FCEAEA', border: '1px solid #F5B5B5', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>{error}</span>
          <button onClick={load} style={{ padding: '7px 16px', borderRadius: 9, border: 'none', background: '#B91C1C', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: LS.muted }}>Loading your Memory Vault...</div>
      ) : (
        <>
          <MemoryHero media={media} onUpload={() => { setUploadDefaults({}); setShowUpload(true) }} onCreateAlbum={() => document.getElementById('gallery-new-collection-anchor')?.scrollIntoView({ behavior: 'smooth' })} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <GalleryFilters
              activeCategory={activeCategory} onCategoryChange={c => { setActiveCategory(c); setVisibleCount(PAGE_SIZE) }}
              counts={counts} showFavouritesOnly={showFavouritesOnly} onToggleFavourites={() => setShowFavouritesOnly(v => !v)}
              advanced={advanced} onAdvancedChange={setAdvanced}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <div style={{ display: 'flex', gap: 4, background: LS.bg, borderRadius: 10, padding: 3, marginBottom: 12 }}>
              {[{ key: 'timeline', label: 'Timeline' }, { key: 'grid', label: 'Grid' }].map(v => (
                <button key={v.key} onClick={() => setViewMode(v.key)} style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: viewMode === v.key ? '#fff' : 'transparent', color: viewMode === v.key ? LS.purpleDark : LS.muted,
                  boxShadow: viewMode === v.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>{v.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.7fr 1fr', gap: 16, alignItems: 'start' }}>
            <div>
              {viewMode === 'timeline' ? (
                <MemoryTimeline
                  groupedByDay={groupedByDay} onView={openLightboxForGroup} onToggleFavourite={toggleFavouriteGroup}
                  onAction={handleTimelineAction} hasMore={hasMore} onLoadMore={() => setVisibleCount(v => v + PAGE_SIZE)}
                  onUpload={() => { setUploadDefaults({}); setShowUpload(true) }} hasAnyMedia={media.length > 0}
                />
              ) : (
                <GalleryGrid
                  items={filteredMedia} onOpen={openLightboxForItem} onToggleFavourite={toggleFavouriteItem}
                  selectedIds={selectedIds} onToggleSelect={toggleSelect} hasAnyMedia={media.length > 0}
                  onUpload={() => { setUploadDefaults({}); setShowUpload(true) }}
                />
              )}
            </div>

            <div>
              <HighlightsPanel media={media} onViewAll={() => setViewMode('grid')} onOpen={openLightboxForItem} />
              <div id="gallery-new-collection-anchor">
                <CollectionsPanel
                  collections={collectionsWithMeta}
                  onOpen={() => { setActiveCategory('All'); setShowFavouritesOnly(false); setAdvanced({ mediaType: 'all', consentStatus: 'all', safeToShareOnly: false }); setViewMode('grid') }}
                  onCreate={createCollection}
                  onViewAll={() => setViewMode('grid')}
                />
              </div>
              {historyMemory && <HistoryMemoryCard memory={historyMemory} onRelive={(m) => openLightboxForGroup(m)} />}
            </div>
          </div>
        </>
      )}

      {lightboxItems && (
        <GalleryLightbox
          items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxItems(null)}
          onNavigate={setLightboxIndex} onSave={saveMediaDetails} onDelete={handleDeleteMedia}
          onDownload={downloadItem} onShare={shareItem}
          sessionTitleFor={(sid) => sessionsById[sid]?.title}
        />
      )}

      {showUpload && (
        <GalleryUploadWizard
          org={org} collections={collections} onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); load(); showToast('Upload complete') }}
          defaultSessionId={uploadDefaults.defaultSessionId} defaultCategory={uploadDefaults.defaultCategory}
        />
      )}

      {movePickerGroup && (
        <>
          <div onClick={() => setMovePickerGroup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,50,0.45)', zIndex: 299 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 300, background: '#fff', borderRadius: 18, padding: 22, width: 'min(340px, 92vw)', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: LS.text, marginBottom: 14 }}>Move to collection</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              <button onClick={() => moveGroupToCollection(movePickerGroup, null)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${LS.border}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: LS.text }}>No collection</button>
              {collections.map(c => (
                <button key={c.id} onClick={() => moveGroupToCollection(movePickerGroup, c.id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${LS.border}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: LS.text }}>{c.name}</button>
              ))}
            </div>
            <button onClick={() => setMovePickerGroup(null)} style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 10, border: `1.5px solid ${LS.border}`, background: '#fff', color: LS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}
