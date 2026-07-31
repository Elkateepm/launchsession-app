import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls } from 'framer-motion'

// Loads the qrcodejs CDN script once and resolves when window.QRCode is ready.
let qrLoadPromise = null
function loadQRLib() {
  if (window.QRCode) return Promise.resolve()
  if (qrLoadPromise) return qrLoadPromise
  qrLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
  return qrLoadPromise
}

function QRCard({ icon, title, subtitle, url, primary }) {
  const qrRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadQRLib().then(() => {
      if (cancelled || !qrRef.current) return
      qrRef.current.innerHTML = ''
      // eslint-disable-next-line no-new
      new window.QRCode(qrRef.current, { text: url, width: 220, height: 220, colorDark: '#0f172a', colorLight: '#ffffff' })
    })
    return () => { cancelled = true }
  }, [url])

  const copyLink = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const share = () => {
    if (navigator.share) navigator.share({ title, url }).catch(() => {})
    else copyLink()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${primary}, ${primary}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, marginBottom: 10, boxShadow: `0 3px 10px -4px ${primary}90` }}>
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', textAlign: 'center' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 16 }}>{subtitle}</div>
      <div ref={qrRef} style={{ padding: 12, background: '#fff', borderRadius: 14, border: '1px solid #F1F5F9', marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 260 }}>
        <button onClick={copyLink} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
        <button onClick={share} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          Share
        </button>
      </div>
    </div>
  )
}

// Bottom sheet presenting the org's public sign-up QR codes (child registration and
// volunteer application) one at a time — showing both at once risks a scanner picking
// up the wrong code, so a toggle switches between them instead. Reused from the Launch
// "Sign-Up QR" quick action, and can be dropped in anywhere else (e.g. Children/Volunteers
// pages) that wants the same picker.
export default function QRShareSheet({ org, onClose, initial = 'child' }) {
  const isMobile = window.innerWidth < 768
  const dragControls = useDragControls()
  const primary = org?.primary_color || '#1B9AAA'
  const slug = org?.slug
  const [which, setWhich] = useState(initial)
  const childUrl = `${window.location.origin}/register-child/${slug}`
  const volunteerUrl = `${window.location.origin}/register-volunteer/${slug}`

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10700, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <motion.div
        onClick={e => e.stopPropagation()}
        drag={isMobile ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 400 }}
        dragElastic={{ top: 0.05, bottom: 0.6 }}
        onDragEnd={(e, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose() }}
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ background: '#fff', borderRadius: isMobile ? '24px 24px 0 0' : 22, width: '100%', maxWidth: isMobile ? '100%' : 400, maxHeight: isMobile ? '92vh' : '90vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 32px 80px rgba(0,0,0,0.35)' }}
      >
        {isMobile && (
          <div onPointerDown={e => dragControls.start(e)} style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, cursor: 'grab', touchAction: 'none' }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.12)' }} />
          </div>
        )}
        <div style={{ padding: '10px 20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>Sign-Up QR Code</div>
              <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Print, share, or display this for people to scan</div>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
          </div>

          {/* Toggle — only one QR renders at a time so a camera never has two codes in frame */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 11, padding: 4, marginBottom: 20 }}>
            {[{ key: 'child', label: '🧒 Child' }, { key: 'volunteer', label: '🤝 Volunteer' }].map(t => (
              <button key={t.key} onClick={() => setWhich(t.key)}
                style={{ flex: 1, padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, transition: 'background 0.15s, color 0.15s', background: which === t.key ? '#fff' : 'transparent', color: which === t.key ? primary : '#64748B', boxShadow: which === t.key ? '0 1px 4px rgba(15,23,42,0.12)' : 'none' }}>
                {t.label}
              </button>
            ))}
          </div>

          {which === 'child'
            ? <QRCard icon="🧒" title="Child Sign-Up" subtitle="Parents register a young person" url={childUrl} primary={primary} />
            : <QRCard icon="🤝" title="Volunteer Sign-Up" subtitle="New volunteers apply to help" url={volunteerUrl} primary={primary} />}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
