import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { LS, IconGlyph } from '../fundraisingShared'
import { supporterName, summariseSupporters } from './supporters'

// Deliberately not a CRM. Organisations here have a few dozen supporters and no
// fundraising officer -- the useful questions are "who gives", "how much" and
// "when did they last hear from us", not pipeline stages and activity logging.

const money = n => `£${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function SupportersPanel({ org, isAdmin, campaigns = [] }) {
  const isMobile = useIsMobile()
  const [supporters, setSupporters] = useState([])
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('total')       // total | recent | name
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const [{ data: people }, { data: gifts }] = await Promise.all([
      supabase.from('fundraising_supporters').select('*').eq('org_id', org.id),
      supabase.from('fundraising_donations')
        .select('id, supporter_id, campaign_id, amount, refunded_amount, status, donation_date, created_at, gift_aid')
        .eq('org_id', org.id),
    ])
    setSupporters(people || [])
    setDonations(gifts || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const summarised = summariseSupporters(supporters, donations)
    const term = search.trim().toLowerCase()

    const filtered = term
      ? summarised.filter(s =>
          [supporterName(s), s.email || '', s.phone || ''].join(' ').toLowerCase().includes(term))
      : summarised

    const sorted = [...filtered]
    if (sort === 'total') sorted.sort((a, b) => b.total - a.total)
    else if (sort === 'recent') sorted.sort((a, b) => (b.last || '').localeCompare(a.last || ''))
    else sorted.sort((a, b) => supporterName(a).localeCompare(supporterName(b)))
    return sorted
  }, [supporters, donations, search, sort])

  const stats = useMemo(() => {
    const summarised = summariseSupporters(supporters, donations)
    const givers = summarised.filter(s => s.count > 0)
    const repeat = givers.filter(s => s.count > 1)
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const newThisMonth = supporters.filter(s => (s.created_at || '') >= monthStart).length
    return {
      total: supporters.length,
      repeat: repeat.length,
      giftAid: supporters.filter(s => s.gift_aid_status === 'declaration_held').length,
      newThisMonth,
    }
  }, [supporters, donations])

  const campaignName = useCallback(
    id => campaigns.find(c => c.id === id)?.name || 'General',
    [campaigns]
  )

  const chip = (labelText, value) => (
    <div style={{
      background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 14,
      padding: '13px 15px', minWidth: 0,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: LS.text, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 3 }}>{labelText}</div>
    </div>
  )

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: LS.muted, fontSize: 14 }}>Loading supporters…</div>
  }

  if (!supporters.length) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center', background: '#fff',
        border: `1px solid ${LS.border}`, borderRadius: 16,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, background: LS.lavender,
          display: 'grid', placeItems: 'center', margin: '0 auto 14px',
        }}>
          <IconGlyph name="people" color={LS.purpleDark} size={24} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: LS.text, marginBottom: 6 }}>
          No supporters yet
        </div>
        <div style={{ fontSize: 13.5, color: LS.muted, maxWidth: 340, margin: '0 auto', lineHeight: 1.5 }}>
          Supporters are added automatically when you record a donation with a name.
          There's nothing to set up here.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 10, marginBottom: 16,
      }}>
        {chip('Supporters', stats.total)}
        {chip('Gave more than once', stats.repeat)}
        {chip('Gift Aid declarations', stats.giftAid)}
        {chip('New this month', stats.newThisMonth)}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
            <IconGlyph name="search" color={LS.muted} size={15} />
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search supporters…"
            style={{
              width: '100%', padding: '11px 13px 11px 34px', borderRadius: 11, fontSize: 14,
              border: `1px solid ${LS.border}`, background: '#fff', color: LS.text,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{
            padding: '11px 13px', borderRadius: 11, fontSize: 13.5, fontWeight: 700,
            border: `1px solid ${LS.border}`, background: '#fff', color: LS.text,
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="total">Most given</option>
          <option value="recent">Most recent</option>
          <option value="name">Name</option>
        </select>
      </div>

      {rows.length === 0 && (
        <div style={{
          padding: '34px 24px', textAlign: 'center', background: '#fff',
          border: `1px solid ${LS.border}`, borderRadius: 16, color: LS.muted, fontSize: 14,
        }}>No supporters match that search.</div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((s, i) => {
          const open = openId === s.id
          const theirGifts = donations
            .filter(d => d.supporter_id === s.id)
            .sort((a, b) => (b.donation_date || b.created_at || '').localeCompare(a.donation_date || a.created_at || ''))

          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
              style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 14, overflow: 'hidden' }}
            >
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 11, background: LS.lavender, flexShrink: 0,
                  display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, color: LS.purpleDark,
                }}>
                  {supporterName(s).slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14.5, fontWeight: 800, color: LS.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {supporterName(s)}
                    {s.gift_aid_status === 'declaration_held' && (
                      <span style={{
                        marginLeft: 7, padding: '2px 7px', borderRadius: 999, fontSize: 10.5,
                        fontWeight: 700, background: '#E7F8ED', color: LS.success,
                      }}>Gift Aid</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: LS.muted, marginTop: 2 }}>
                    {s.count} donation{s.count === 1 ? '' : 's'}
                    {s.last && ` · last ${fmtDate(s.last)}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: LS.success }}>{money(s.total)}</div>
                </div>
              </button>

              {open && (
                <div style={{ borderTop: `1px solid ${LS.border}`, padding: '13px 14px', background: LS.bg }}>
                  <div style={{ display: 'grid', gap: 5, marginBottom: 12 }}>
                    {s.email && <div style={{ fontSize: 13, color: LS.text }}>{s.email}</div>}
                    {s.phone && <div style={{ fontSize: 13, color: LS.text }}>{s.phone}</div>}
                    {s.first && (
                      <div style={{ fontSize: 12.5, color: LS.muted }}>
                        First gave {fmtDate(s.first)}
                      </div>
                    )}
                    {!s.email && !s.phone && (
                      <div style={{ fontSize: 12.5, color: LS.muted }}>No contact details recorded.</div>
                    )}
                  </div>

                  {s.campaigns.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: LS.muted, marginBottom: 6, letterSpacing: 0.3 }}>
                        SUPPORTS
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {s.campaigns.map(cid => (
                          <span key={cid} style={{
                            padding: '4px 10px', borderRadius: 999, fontSize: 12,
                            fontWeight: 700, background: LS.lavender, color: LS.purpleDark,
                          }}>{campaignName(cid)}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, color: LS.muted, marginBottom: 6, letterSpacing: 0.3 }}>
                    DONATIONS
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {theirGifts.slice(0, 8).map(d => (
                      <div key={d.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 12.5, color: LS.text,
                      }}>
                        <span style={{ fontWeight: 800, minWidth: 56 }}>{money(d.amount)}</span>
                        <span style={{ color: LS.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {campaignName(d.campaign_id)}
                        </span>
                        <span style={{ color: LS.muted, flexShrink: 0 }}>
                          {fmtDate(d.donation_date || d.created_at)}
                        </span>
                      </div>
                    ))}
                    {theirGifts.length > 8 && (
                      <div style={{ fontSize: 12, color: LS.muted, marginTop: 3 }}>
                        and {theirGifts.length - 8} more
                      </div>
                    )}
                  </div>

                  {s.notes && (
                    <div style={{
                      marginTop: 12, padding: '9px 11px', borderRadius: 9,
                      background: '#fff', border: `1px solid ${LS.border}`,
                      fontSize: 12.5, color: LS.text, lineHeight: 1.5,
                    }}>{s.notes}</div>
                  )}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
