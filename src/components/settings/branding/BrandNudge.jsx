import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { applyBrandPalette, contrastRatio } from '../../../lib/brandColors'
import { applyBrandTheme } from '../../../lib/brandTheme'
import { prepareBrandImage, extensionFor, BRAND_IMAGE_TYPES } from '../../../lib/brandImage'
import { ASSETS, readableInk } from './brandingModel'
import { extractDominantColors } from './logoColours'
import Icon from '../../../lib/icons'
import { withAlpha } from '../../../lib/withAlpha'

// Straight after signing in, an owner or admin whose organisation has no logo
// yet is asked to add one. Their logo and colours then run through the whole
// app, their emails and public forms. The logo can be added right here, with
// colours picked from it, or they can open Branding for the full set.
//
// Shown once per sign-in. "Later" waits three days; "Don't ask again" stops it.
// Nothing here needs new permissions: it is the same upload and the same
// organisations update the Branding page makes as an admin.

const SNOOZE_DAYS = 3
const key = (orgId, userId) => `ls_brand_nudge_${orgId}_${userId || 'me'}`
const sessionKey = orgId => `ls_brand_nudge_seen_${orgId}`
const DEFAULT_PRIMARY = '#1B9AAA'

function read(store, k) { try { return store.getItem(k) } catch (e) { return null } }
function write(store, k, v) { try { store.setItem(k, v) } catch (e) { /* private mode */ } }

/**
 * The colours found in a logo, best main colour first: the most common one
 * that holds white text (3:1, large text), so buttons stay readable. The
 * most common pixel colour is often a pale background tint.
 */
export function mainColourFirst(colours) {
  const strong = colours.filter(c => { try { return contrastRatio(c, '#FFFFFF') >= 3 } catch (e) { return false } })
  return [...strong, ...colours.filter(c => !strong.includes(c))]
}

/** Should the prompt show now? Pure apart from storage, which is passed in. */
export function shouldShowBrandNudge({ org, role, userId, now = Date.now(), local, session }) {
  if (!org?.id || !org.branding_enabled) return false
  if (!['owner', 'admin'].includes(role)) return false
  if (org.logo_url) return false
  const saved = read(local, key(org.id, userId))
  if (saved === 'never') return false
  if (saved && Number(saved) > now) return false
  if (read(session, sessionKey(org.id))) return false
  return true
}

export default function BrandNudge({ org, role, userId, onOpenBranding, onSaved }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [colours, setColours] = useState([])
  const [primary, setPrimary] = useState(org?.primary_color || DEFAULT_PRIMARY)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const inputRef = useRef(null)
  const urlRef = useRef('')

  useEffect(() => {
    if (shouldShowBrandNudge({ org, role, userId, local: window.localStorage, session: window.sessionStorage })) {
      write(window.sessionStorage, sessionKey(org.id), '1')
      setOpen(true)
    }
  }, [org, role, userId])

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  if (!open) return null

  const close = (how) => {
    if (how === 'later') write(window.localStorage, key(org.id, userId), String(Date.now() + SNOOZE_DAYS * 86400000))
    if (how === 'never') write(window.localStorage, key(org.id, userId), 'never')
    setOpen(false)
  }

  const choose = async e => {
    const picked = e.target.files?.[0]; e.target.value = ''
    if (!picked) return
    setBusy('preparing'); setError('')
    try {
      const prepared = await prepareBrandImage(picked, ASSETS.find(a => a.key === 'logo_url').options)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(prepared); urlRef.current = url
      setFile(prepared); setPreview(url)
      const found = mainColourFirst(await extractDominantColors(url))
      setColours(found)
      if (found[0]) setPrimary(found[0])
    } catch (err) {
      setError(err.message || 'That image could not be used. Try a PNG, JPEG or WebP.')
    }
    setBusy('')
  }

  const save = async () => {
    if (!file || busy) return
    setBusy('saving'); setError('')
    try {
      const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
      const path = `${org.id}/logo-${id}.${extensionFor(file)}`
      const bucket = supabase.storage.from('org-logos')
      const { error: upErr } = await bucket.upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(`Could not upload your logo: ${upErr.message}`)
      const logo_url = bucket.getPublicUrl(path).data.publicUrl
      const { data, error: saveErr } = await supabase.from('organisations').update({ logo_url, primary_color: primary }).eq('id', org.id).select('id')
      if (saveErr) throw saveErr
      if (!data?.length) throw new Error('Not saved. Check you are still signed in as an administrator, then try again.')
      applyBrandPalette(primary); applyBrandTheme({ ...org, logo_url, primary_color: primary })
      setDone(true)
      onSaved?.()
    } catch (err) {
      setError(err.message || 'Saving failed. Try again, or open Branding.')
    }
    setBusy('')
  }

  const ink = readableInk(primary)
  const btn = { minHeight: 46, padding: '0 18px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }

  return createPortal(
    <div onClick={() => !busy && close('later')} style={{ position: 'fixed', inset: 0, zIndex: 10800, background: 'rgba(10,14,28,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="brand-nudge-title" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 540, maxHeight: isMobile ? '92dvh' : '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: isMobile ? '22px 22px 0 0' : 22, boxShadow: '0 30px 80px rgba(0,0,0,0.3)' }}>

        {/* What it will look like, in the colour they pick. */}
        <div style={{ background: `linear-gradient(135deg, ${primary}, ${withAlpha(primary, 'cc')})`, color: ink, padding: isMobile ? '22px 20px' : '26px 26px 24px', position: 'relative', overflow: 'hidden', borderRadius: isMobile ? '22px 22px 0 0' : '22px 22px 0 0' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: '50%', background: ink === '#FFFFFF' ? '#ffffff1a' : '#0000000f' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            <div style={{ width: 120, height: 56, borderRadius: 14, background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 6px 16px #0000001f' }}>
              {preview
                ? <img src={preview} alt="Your logo" style={{ maxWidth: '86%', maxHeight: '78%', objectFit: 'contain' }} />
                : <span style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', textAlign: 'center', padding: 6 }}>Your logo here</span>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.8 }}>{org.name}</div>
              <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>Welcome back</div>
            </div>
          </div>
        </div>

        <div style={{ padding: isMobile ? '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))' : '22px 26px 24px' }}>
          {done ? (
            <>
              <h2 id="brand-nudge-title" style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Looking good</h2>
              <p style={{ margin: '8px 0 18px', fontSize: 14, lineHeight: 1.55, color: 'var(--text2)' }}>Your logo and colour are now on your workspace, sign-in page, public forms and emails. Your team sees them next time they open the app.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => close()} style={{ ...btn, flex: 1, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)' }}>Done</button>
                <button type="button" onClick={() => { close(); onOpenBranding?.() }} style={{ ...btn, flex: 1, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>Fine-tune in Branding</button>
              </div>
            </>
          ) : (
            <>
              <h2 id="brand-nudge-title" style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>Make LaunchSession look like {org.name}</h2>
              <p style={{ margin: '8px 0 16px', fontSize: 14, lineHeight: 1.55, color: 'var(--text2)' }}>
                Add your logo and we will pick your colours from it. Your team, the families you work with and every email you send will see your brand.
              </p>

              <input ref={inputRef} type="file" accept={BRAND_IMAGE_TYPES.join(',')} onChange={choose} style={{ display: 'none' }} aria-label="Choose your logo" />
              <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy}
                style={{ ...btn, width: '100%', minHeight: 64, border: '2px dashed var(--border)', background: 'var(--surface2)', color: 'var(--text)', flexDirection: 'column', gap: 2 }}>
                <span><Icon name="🎨" size={18} /> {busy === 'preparing' ? 'Getting your logo ready…' : preview ? 'Choose a different logo' : 'Upload your logo'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>PNG, JPEG or WebP. Transparent PNGs look best.</span>
              </button>

              {preview && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>{colours.length ? 'Colours from your logo. Pick your main one:' : 'Pick your main colour:'}</div>
                  <div role="radiogroup" aria-label="Main colour" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[...new Set([...colours, ...(colours.length ? [] : [DEFAULT_PRIMARY])])].map(c => (
                      <button key={c} type="button" role="radio" aria-checked={primary === c} aria-label={c} onClick={() => setPrimary(c)}
                        style={{ width: 44, height: 44, borderRadius: 12, border: primary === c ? '3px solid var(--text)' : '2px solid var(--border)', background: c, cursor: 'pointer', boxShadow: primary === c ? '0 0 0 3px var(--surface) inset' : 'none' }} />
                    ))}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--text3)', minHeight: 44, cursor: 'pointer' }}>
                      <input type="color" value={primary} onChange={e => setPrimary(e.target.value.toUpperCase())} aria-label="Choose any colour" style={{ width: 44, height: 44, padding: 2, border: '2px solid var(--border)', borderRadius: 12, background: 'var(--surface)', cursor: 'pointer' }} />
                      Or any colour
                    </label>
                  </div>
                </div>
              )}

              {error && <div role="alert" style={{ marginTop: 14, fontSize: 13, color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, padding: '9px 12px' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                {preview ? (
                  <button type="button" onClick={save} disabled={!!busy} style={{ ...btn, flex: '1 1 200px', border: 'none', background: primary, color: ink, opacity: busy ? 0.7 : 1 }}>{busy === 'saving' ? 'Saving…' : 'Use my logo and colour'}</button>
                ) : (
                  <button type="button" onClick={() => { close(); onOpenBranding?.() }} style={{ ...btn, flex: '1 1 200px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>Open Branding instead</button>
                )}
                <button type="button" onClick={() => close('later')} disabled={busy === 'saving'} style={{ ...btn, flex: '1 1 120px', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)' }}>Later</button>
              </div>
              <button type="button" onClick={() => close('never')} style={{ marginTop: 10, minHeight: 44, width: '100%', border: 'none', background: 'none', color: 'var(--text3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Don't ask again</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
