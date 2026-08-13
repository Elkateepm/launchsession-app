import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { LS, IconGlyph, AnimatedNumber } from '../fundraisingShared'
import { PAYMENT_METHODS, statusLabel, countsTowardsTotal } from '../../../services/paymentService'
import RecordDonationDrawer from './RecordDonationDrawer'
import { supporterName } from './supporters'

// The central donation ledger: every gift, online or offline, in one list.

const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]))

const money = n => `£${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'

function statusTone(status) {
  if (status === 'paid') return { color: LS.success, bg: '#E7F8ED' }
  if (status === 'recorded') return { color: LS.purpleDark, bg: LS.lavender }
  if (status === 'pending' || status === 'processing') return { color: LS.warning, bg: '#FEF6E7' }
  if (status === 'refunded' || status === 'partially_refunded') return { color: LS.muted, bg: '#F3F2F7' }
  return { color: LS.danger, bg: '#FEF2F2' }
}

function StatCard({ label, value, sub, prefix = '' }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16,
      padding: '15px 16px', minWidth: 0,
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: LS.muted, letterSpacing: 0.3, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: LS.text, lineHeight: 1.1 }}>
        <AnimatedNumber value={value} prefix={prefix} />
      </div>
      {sub && <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Pill({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
      whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
      border: `1px solid ${active ? 'transparent' : LS.border}`,
      background: active ? LS.gradient : '#fff',
      color: active ? '#fff' : LS.muted,
    }}>{children}</button>
  )
}

export default function DonationsLedger({ org, isAdmin, campaigns = [], onChanged }) {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState([])
  const [supporters, setSupporters] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all')  // all | online | offline | gift_aid | refunded
  const [drawerOpen, setDrawerOpen] = useState(false)

  const campaignName = useCallback(
    id => campaigns.find(c => c.id === id)?.name || 'General',
    [campaigns]
  )

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)

    const [{ data: donations }, { data: people }] = await Promise.all([
      supabase.from('fundraising_donations').select('*').eq('org_id', org.id)
        .order('donation_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('fundraising_supporters').select('id, first_name, last_name, email, anonymous')
        .eq('org_id', org.id),
    ])

    setRows(donations || [])
    setSupporters(Object.fromEntries((people || []).map(p => [p.id, p])))
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const displayDonor = useCallback(d => {
    if (d.anonymous) return 'Anonymous'
    if (d.supporter_id && supporters[d.supporter_id]) return supporterName(supporters[d.supporter_id])
    return d.donor_name || 'Anonymous'
  }, [supporters])

  const stats = useMemo(() => {
    // Only money the organisation actually holds counts. A failed card payment
    // sitting in the ledger must not inflate the headline figure.
    const counted = rows.filter(d => countsTowardsTotal(d.status))
    const total = counted.reduce((s, d) => s + Number(d.amount || 0) - Number(d.refunded_amount || 0), 0)

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const thisMonth = counted
      .filter(d => (d.donation_date || d.created_at || '') >= monthStart)
      .reduce((s, d) => s + Number(d.amount || 0) - Number(d.refunded_amount || 0), 0)

    return {
      total,
      thisMonth,
      average: counted.length ? Math.round(total / counted.length) : 0,
      count: rows.length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(d => {
      if (campaignFilter !== 'all' && d.campaign_id !== campaignFilter) return false
      if (methodFilter !== 'all' && d.payment_method !== methodFilter) return false

      if (quickFilter === 'online' && d.payment_method !== 'online' && d.payment_method !== 'card') return false
      if (quickFilter === 'offline' && (d.payment_method === 'online')) return false
      if (quickFilter === 'gift_aid' && !d.gift_aid) return false
      if (quickFilter === 'refunded' && d.status !== 'refunded' && d.status !== 'partially_refunded') return false

      if (term) {
        const haystack = [
          displayDonor(d),
          campaignName(d.campaign_id),
          d.reference || '',
        ].join(' ').toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [rows, search, campaignFilter, methodFilter, quickFilter, displayDonor, campaignName])

  const empty = !loading && rows.length === 0

  return (
    <div>
      {/* stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 10, marginBottom: 16,
      }}>
        <StatCard label="TOTAL" value={stats.total} prefix="£" sub="Across all campaigns" />
        <StatCard label="THIS MONTH" value={stats.thisMonth} prefix="£" sub="Received this month" />
        <StatCard label="AVERAGE" value={stats.average} prefix="£" sub="Per donation" />
        <StatCard label="DONATIONS" value={stats.count} sub="Recorded in total" />
      </div>

      {/* toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
            <IconGlyph name="search" color={LS.muted} size={15} />
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search supporter, campaign or reference…"
            style={{
              width: '100%', padding: '11px 13px 11px 34px', borderRadius: 11, fontSize: 14,
              border: `1px solid ${LS.border}`, background: '#fff', color: LS.text,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>
        {isAdmin && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              padding: '11px 16px', borderRadius: 11, border: 'none', background: LS.gradient,
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <IconGlyph name="plus" color="#fff" size={15} />
            Record Donation
          </button>
        )}
      </div>

      {/* filters */}
      <div style={{
        display: 'flex', gap: 7, marginBottom: 14, overflowX: 'auto',
        paddingBottom: 4, WebkitOverflowScrolling: 'touch',
      }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'online', label: 'Online' },
          { key: 'offline', label: 'Offline' },
          { key: 'gift_aid', label: 'Gift Aid' },
          { key: 'refunded', label: 'Refunded' },
        ].map(f => (
          <Pill key={f.key} active={quickFilter === f.key} onClick={() => setQuickFilter(f.key)}>
            {f.label}
          </Pill>
        ))}

        <select
          value={campaignFilter}
          onChange={e => setCampaignFilter(e.target.value)}
          style={{
            padding: '7px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
            border: `1px solid ${LS.border}`, background: '#fff',
            color: campaignFilter === 'all' ? LS.muted : LS.text,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <option value="all">All campaigns</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={methodFilter}
          onChange={e => setMethodFilter(e.target.value)}
          style={{
            padding: '7px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
            border: `1px solid ${LS.border}`, background: '#fff',
            color: methodFilter === 'all' ? LS.muted : LS.text,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <option value="all">All methods</option>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* list */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: LS.muted, fontSize: 14 }}>
          Loading donations…
        </div>
      )}

      {empty && (
        <div style={{
          padding: '48px 24px', textAlign: 'center', background: '#fff',
          border: `1px solid ${LS.border}`, borderRadius: 16,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: LS.lavender,
            display: 'grid', placeItems: 'center', margin: '0 auto 14px',
          }}>
            <IconGlyph name="coin" color={LS.purpleDark} size={24} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: LS.text, marginBottom: 6 }}>
            No donations yet
          </div>
          <div style={{ fontSize: 13.5, color: LS.muted, maxWidth: 320, margin: '0 auto 18px', lineHeight: 1.5 }}>
            Record cash, transfers and cheques as they come in. Every gift counts toward its campaign total automatically.
          </div>
          {isAdmin && (
            <button onClick={() => setDrawerOpen(true)} style={{
              padding: '11px 20px', borderRadius: 11, border: 'none', background: LS.gradient,
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}>Record a Donation</button>
          )}
        </div>
      )}

      {!loading && !empty && filtered.length === 0 && (
        <div style={{
          padding: '34px 24px', textAlign: 'center', background: '#fff',
          border: `1px solid ${LS.border}`, borderRadius: 16, color: LS.muted, fontSize: 14,
        }}>
          No donations match these filters.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        isMobile ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {filtered.map((d, i) => {
              const tone = statusTone(d.status)
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2) }}
                  style={{
                    background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 14,
                    padding: '13px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: LS.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayDonor(d)}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: LS.success, flexShrink: 0 }}>
                      {money(d.amount)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: LS.muted, marginBottom: 8 }}>
                    {campaignName(d.campaign_id)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: tone.bg, color: tone.color,
                    }}>{statusLabel(d.status)}</span>
                    <span style={{ fontSize: 11.5, color: LS.muted }}>
                      {METHOD_LABEL[d.payment_method] || 'Other'} · {fmtDate(d.donation_date || d.created_at)}
                    </span>
                    {d.gift_aid && (
                      <span style={{
                        padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: '#E7F8ED', color: LS.success,
                      }}>Gift Aid</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div style={{
            background: '#fff', border: `1px solid ${LS.border}`,
            borderRadius: 16, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: LS.bg }}>
                  {['Supporter', 'Campaign', 'Amount', 'Method', 'Date', 'Status'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i === 2 ? 'right' : 'left', padding: '11px 14px',
                      fontSize: 11.5, fontWeight: 700, color: LS.muted, letterSpacing: 0.3,
                      borderBottom: `1px solid ${LS.border}`, whiteSpace: 'nowrap',
                    }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const tone = statusTone(d.status)
                  return (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${LS.border}` }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: LS.text }}>
                        {displayDonor(d)}
                        {d.gift_aid && (
                          <span style={{
                            marginLeft: 7, padding: '2px 7px', borderRadius: 999, fontSize: 10.5,
                            fontWeight: 700, background: '#E7F8ED', color: LS.success,
                          }}>Gift Aid</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: LS.muted }}>{campaignName(d.campaign_id)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: LS.success, whiteSpace: 'nowrap' }}>
                        {money(d.amount)}
                      </td>
                      <td style={{ padding: '12px 14px', color: LS.muted, whiteSpace: 'nowrap' }}>
                        {METHOD_LABEL[d.payment_method] || 'Other'}
                      </td>
                      <td style={{ padding: '12px 14px', color: LS.muted, whiteSpace: 'nowrap' }}>
                        {fmtDate(d.donation_date || d.created_at)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                          background: tone.bg, color: tone.color, whiteSpace: 'nowrap',
                        }}>{statusLabel(d.status)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <RecordDonationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        org={org}
        campaigns={campaigns}
        onRecorded={() => { load(); onChanged?.() }}
      />
    </div>
  )
}
