import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { LS, IconGlyph } from '../fundraisingShared'
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../../../services/paymentService'
import { listSupporters, resolveSupporter, supporterName } from './supporters'

// Manual donation entry. This is the primary way money enters the ledger until
// online payments are live, and it stays the primary way afterwards -- cash at
// a bake sale and bank transfers from a local business don't stop arriving
// because a card checkout exists.

const todayLondon = () => {
  // The database runs UTC. Between midnight and 1am BST a naive date lands on
  // the previous day, which files a donation under yesterday.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = t => parts.find(p => p.type === t).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

const field = {
  width: '100%', padding: '11px 13px', borderRadius: 11, fontSize: 15,
  border: `1px solid ${LS.border}`, background: '#fff', color: LS.text,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const label = { display: 'block', fontSize: 12.5, fontWeight: 700, color: LS.muted, marginBottom: 6, letterSpacing: 0.2 }
const group = { marginBottom: 16 }

export default function RecordDonationDrawer({ open, onClose, org, campaigns = [], defaultCampaignId, onRecorded }) {
  const isMobile = useIsMobile()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [supporters, setSupporters] = useState([])

  const [amount, setAmount] = useState('')
  const [campaignId, setCampaignId] = useState(defaultCampaignId || '')
  const [mode, setMode] = useState('new')          // new | existing | anonymous
  const [supporterId, setSupporterId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(todayLondon())
  const [reference, setReference] = useState('')
  const [giftAid, setGiftAid] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open || !org?.id) return
    setCampaignId(defaultCampaignId || '')
    listSupporters(org.id).then(setSupporters)
  }, [open, org?.id, defaultCampaignId])

  const reset = () => {
    setAmount(''); setMode('new'); setSupporterId(''); setName(''); setEmail('')
    setPhone(''); setMethod('cash'); setDate(todayLondon()); setReference('')
    setGiftAid(false); setNotes(''); setError(null)
  }

  const parsedAmount = useMemo(() => {
    // Tolerate "£50", "50.00" and "1,200" -- people paste from bank statements.
    const cleaned = String(amount).replace(/[£,\s]/g, '')
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : null
  }, [amount])

  const canSave = parsedAmount !== null && parsedAmount > 0 && !!campaignId && !saving

  async function save() {
    if (!canSave) return
    setSaving(true); setError(null)

    try {
      const { supporterId: resolvedId, anonymous } = await resolveSupporter({
        orgId: org.id, mode, supporterId, name, email, phone, giftAid,
      })

      const chosen = supporters.find(s => s.id === resolvedId)
      const displayName = anonymous
        ? 'Anonymous'
        : (mode === 'existing' ? supporterName(chosen) : (name.trim() || 'Anonymous'))

      const { error: insErr } = await supabase.from('fundraising_donations').insert({
        org_id: org.id,
        campaign_id: campaignId,
        supporter_id: resolvedId,
        // Kept alongside supporter_id: the ledger must still read correctly if
        // a supporter record is later deleted, and the original code path
        // populates it too.
        donor_name: displayName,
        amount: parsedAmount,
        currency: 'GBP',
        payment_method: method,
        // Manual entries are final on creation -- there is no provider that
        // could later confirm or fail them.
        status: PAYMENT_STATUS.RECORDED,
        gift_aid: giftAid,
        anonymous,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        donation_date: date,
      })

      if (insErr) throw insErr

      // The campaign total is recalculated by a database trigger, so nothing is
      // written to fundraising_campaigns here.
      reset()
      onRecorded?.()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Could not record the donation. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const panel = {
    background: '#fff',
    width: isMobile ? '100%' : 460,
    maxWidth: '100%',
    height: isMobile ? 'auto' : '100%',
    maxHeight: isMobile ? '92vh' : '100%',
    borderRadius: isMobile ? '20px 20px 0 0' : 0,
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(17,15,35,0.42)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'stretch',
            justifyContent: isMobile ? 'center' : 'flex-end',
          }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={panel}
          >
            {/* header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${LS.border}`, flexShrink: 0 }}>
              {isMobile && (
                <div style={{ width: 38, height: 4, borderRadius: 4, background: LS.lavenderBorder, margin: '0 auto 12px' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: LS.lavender,
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <IconGlyph name="coin" color={LS.purpleDark} size={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: LS.text }}>Record a donation</div>
                  <div style={{ fontSize: 12.5, color: LS.muted }}>Cash, transfer, cheque or card taken offline</div>
                </div>
                <button onClick={onClose} style={{
                  marginLeft: 'auto', border: 'none', background: 'transparent',
                  fontSize: 22, color: LS.muted, cursor: 'pointer', lineHeight: 1, padding: 4,
                }}>×</button>
              </div>
            </div>

            {/* body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>

              <div style={group}>
                <label style={label}>AMOUNT</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 19, fontWeight: 700, color: LS.muted, pointerEvents: 'none',
                  }}>£</span>
                  <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    style={{ ...field, paddingLeft: 30, fontSize: 21, fontWeight: 800, height: 52 }}
                  />
                </div>
              </div>

              <div style={group}>
                <label style={label}>CAMPAIGN</label>
                <select value={campaignId} onChange={e => setCampaignId(e.target.value)} style={field}>
                  <option value="">Select a campaign…</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={group}>
                <label style={label}>SUPPORTER</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[
                    { key: 'new', label: 'New' },
                    { key: 'existing', label: 'Existing' },
                    { key: 'anonymous', label: 'Anonymous' },
                  ].map(o => (
                    <button
                      key={o.key}
                      onClick={() => setMode(o.key)}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${mode === o.key ? 'transparent' : LS.border}`,
                        background: mode === o.key ? LS.gradient : '#fff',
                        color: mode === o.key ? '#fff' : LS.muted,
                      }}
                    >{o.label}</button>
                  ))}
                </div>

                {mode === 'existing' && (
                  <select value={supporterId} onChange={e => setSupporterId(e.target.value)} style={field}>
                    <option value="">Select a supporter…</option>
                    {supporters.map(s => <option key={s.id} value={s.id}>{supporterName(s)}</option>)}
                  </select>
                )}

                {mode === 'new' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={field} />
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" type="email" style={field} />
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" style={field} />
                    <div style={{ fontSize: 11.5, color: LS.muted, lineHeight: 1.45 }}>
                      Adding an email links repeat gifts to the same supporter automatically.
                    </div>
                  </div>
                )}

                {mode === 'anonymous' && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 10, background: LS.bg,
                    border: `1px solid ${LS.border}`, fontSize: 12.5, color: LS.muted, lineHeight: 1.5,
                  }}>
                    No supporter record is created. The donation still counts toward the campaign total.
                  </div>
                )}
              </div>

              <div style={{ ...group, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={label}>METHOD</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} style={field}>
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>DATE</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={field} />
                </div>
              </div>

              <div style={group}>
                <label style={label}>REFERENCE (OPTIONAL)</label>
                <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Cheque number, transfer reference…" style={field} />
              </div>

              <div style={group}>
                <button
                  onClick={() => setGiftAid(v => !v)}
                  disabled={mode === 'anonymous'}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
                    padding: '13px 14px', borderRadius: 12, cursor: mode === 'anonymous' ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', opacity: mode === 'anonymous' ? 0.5 : 1,
                    border: `1px solid ${giftAid ? LS.purple : LS.border}`,
                    background: giftAid ? LS.lavender : '#fff',
                  }}
                >
                  <div style={{
                    width: 21, height: 21, borderRadius: 6, flexShrink: 0,
                    display: 'grid', placeItems: 'center',
                    border: `1.6px solid ${giftAid ? LS.purpleDark : LS.lavenderBorder}`,
                    background: giftAid ? LS.purpleDark : '#fff',
                  }}>
                    {giftAid && <IconGlyph name="check" color="#fff" size={13} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: LS.text }}>Gift Aid declaration held</div>
                    <div style={{ fontSize: 11.5, color: LS.muted, lineHeight: 1.4 }}>
                      {mode === 'anonymous'
                        ? 'Gift Aid needs a named donor and their address on file.'
                        : 'Records that a declaration exists. Claims are made through HMRC separately.'}
                    </div>
                  </div>
                </button>
              </div>

              <div style={group}>
                <label style={label}>INTERNAL NOTES (OPTIONAL)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Only visible to your team"
                  style={{ ...field, resize: 'vertical', minHeight: 68 }}
                />
              </div>

              {error && (
                <div style={{
                  padding: '11px 13px', borderRadius: 10, background: '#FEF2F2',
                  border: '1px solid #FECACA', color: LS.danger, fontSize: 13, marginBottom: 4,
                }}>{error}</div>
              )}
            </div>

            {/* footer */}
            <div style={{
              padding: '14px 20px', borderTop: `1px solid ${LS.border}`, flexShrink: 0,
              display: 'flex', gap: 10, background: '#fff',
              paddingBottom: isMobile ? 'calc(14px + env(safe-area-inset-bottom))' : 14,
            }}>
              <button onClick={onClose} style={{
                padding: '13px 18px', borderRadius: 12, border: `1px solid ${LS.border}`,
                background: '#fff', color: LS.muted, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button
                onClick={save}
                disabled={!canSave}
                style={{
                  flex: 1, padding: '13px 18px', borderRadius: 12, border: 'none',
                  background: canSave ? LS.gradient : LS.lavenderBorder,
                  color: '#fff', fontSize: 15, fontWeight: 800,
                  cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Recording…' : `Record ${parsedAmount ? `£${parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'donation'}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
