import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import PageHeader from '../shared/PageHeader'
import NewChargeModal from './NewChargeModal'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import {
  PB, CHARGE_TYPES, PAYMENT_METHODS, fmtMoney, fmtDateShort,
  chargeTypeLabel, methodLabel, chipStyle, card, inputStyle, btnPrimary, btnGhost,
  initials, summarise,
} from './paymentsShared'
import SignedImg from '../shared/SignedImg'

const TABS = [
  { key: 'overview', label: 'Overview', shortLabel: 'Overview' },
  { key: 'charges', label: 'Charges', shortLabel: 'Charges' },
  { key: 'transactions', label: 'Transactions', shortLabel: 'Txns' },
  { key: 'reconciliation', label: 'Reconciliation', shortLabel: 'Reconcile' },
]

export default function Payments({ org, session, isAdmin }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [charges, setCharges] = useState([])
  const [transactions, setTransactions] = useState([])
  const [children, setChildren] = useState([])
  const [sessions, setSessions] = useState([])
  const [staffMap, setStaffMap] = useState({})
  const [showNewCharge, setShowNewCharge] = useState(false)
  const [payDrawer, setPayDrawer] = useState(null) // { charge } or { childId } or null
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const [chargesRes, txRes, childrenRes, sessionsRes, staffRes] = await Promise.all([
      supabase.from('payment_charge_balances').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('payment_transactions').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('children').select('id, first_name, last_name, photo_url').eq('org_id', org.id).eq('active', true).order('first_name'),
      supabase.from('sessions').select('id, title, session_date').eq('org_id', org.id).order('session_date', { ascending: false }).limit(200),
      supabase.from('user_profiles').select('id, full_name').eq('org_id', org.id),
    ])
    setCharges(chargesRes.data || [])
    setTransactions(txRes.data || [])
    setChildren(childrenRes.data || [])
    setSessions(sessionsRes.data || [])
    const sm = {}
    for (const s of staffRes.data || []) sm[s.id] = s.full_name
    setStaffMap(sm)
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const childMap = useMemo(() => {
    const m = {}
    for (const c of children) m[c.id] = c
    return m
  }, [children])

  const summary = useMemo(() => summarise(charges), [charges])

  const primary = PB.blue

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>Loading Payments…</div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg, #F8FAFC)' }}>
      <PageHeader
        icon="💳" title="Payments" subtitle="Track charges, payments and outstanding balances"
        primary={primary}
        actions={[
          { label: 'Record Payment', icon: '💰', onClick: () => setPayDrawer({ childId: null, pickChild: true }), variant: 'ghost' },
          { label: 'New Charge', icon: '➕', onClick: () => setShowNewCharge(true), variant: 'primary' },
        ]}
      />

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ padding: isMobile ? '0 14px' : '0 24px', borderBottom: '1px solid #E5E7EB', background: '#fff', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: isMobile ? '12px 12px' : '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: isMobile ? 13 : 13.5, fontWeight: 700, whiteSpace: 'nowrap',
                color: tab === t.key ? primary : '#64748B',
                borderBottom: tab === t.key ? `2.5px solid ${primary}` : '2.5px solid transparent',
              }}>{isMobile ? (t.shortLabel || t.label) : t.label}</button>
            ))}
          </div>
        </div>
        {isMobile && (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 1, width: 28, background: 'linear-gradient(90deg, rgba(255,255,255,0), #fff)', pointerEvents: 'none' }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 24 }}>
        {tab === 'overview' && (
          <OverviewTab
            charges={charges} summary={summary} childMap={childMap} isMobile={isMobile}
            onRecordPayment={(charge) => setPayDrawer({ charge })}
            onCreateCharge={() => setShowNewCharge(true)}
          />
        )}
        {tab === 'charges' && (
          <ChargesTab
            charges={charges} childMap={childMap} isMobile={isMobile} isAdmin={isAdmin} session={session}
            onRecordPayment={(charge) => setPayDrawer({ charge })}
            onCreateCharge={() => setShowNewCharge(true)}
            onWaived={() => { load(); showToast('Charge waived') }}
          />
        )}
        {tab === 'transactions' && (
          <TransactionsTab
            transactions={transactions} charges={charges} childMap={childMap} staffMap={staffMap} isMobile={isMobile}
            session={session} onRefunded={() => { load(); showToast('Refund recorded') }}
          />
        )}
        {tab === 'reconciliation' && (
          <ReconciliationTab
            transactions={transactions} childMap={childMap} staffMap={staffMap} isMobile={isMobile}
            onReconciled={() => { load(); showToast('Marked reconciled') }}
          />
        )}
      </div>

      {showNewCharge && (
        <NewChargeModal
          org={org} session={session} children={children} sessions={sessions}
          onClose={() => setShowNewCharge(false)}
          onCreated={(n) => { load(); showToast(`Charge created for ${n} child${n === 1 ? '' : 'ren'}`) }}
        />
      )}

      {payDrawer && (
        payDrawer.pickChild ? (
          <PickChildThenPay children={children} onClose={() => setPayDrawer(null)} onPick={(childId) => setPayDrawer({ childId })} isMobile={isMobile} />
        ) : (
          <RecordPaymentDrawer
            org={org} session={session}
            charge={payDrawer.charge} childId={payDrawer.childId}
            onClose={() => setPayDrawer(null)}
            onRecorded={() => { load(); showToast('Payment recorded') }}
          />
        )
      )}

      {toast && createPortal(
        <div style={{ position: 'fixed', bottom: isMobile ? 'calc(92px + env(safe-area-inset-bottom, 0px))' : 24, left: '50%', transform: 'translateX(-50%)', background: '#0F172A', color: '#fff', padding: '10px 20px', borderRadius: 99, fontSize: 13, fontWeight: 700, zIndex: 10500, boxShadow: '0 12px 32px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>
          ✓ {toast}
        </div>,
        document.body
      )}
    </div>
  )
}

function FilterPills({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2, marginBottom: 2 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '7px 13px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          border: value === o.value ? '1.5px solid transparent' : '1.5px solid #E2E8F0',
          background: value === o.value ? PB.blue : '#fff',
          color: value === o.value ? '#fff' : '#475569',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

// ─── Small child-picker used when "Record Payment" is clicked from the header
// without a specific charge already in context.
function PickChildThenPay({ children, onClose, onPick, isMobile }) {
  const [q, setQ] = useState('')
  const filtered = children.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.trim().toLowerCase()))

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10400, backdropFilter: 'blur(2px)' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', zIndex: 10401, background: '#fff', borderRadius: isMobile ? '22px 22px 0 0' : 20,
        ...(isMobile ? { left: 0, right: 0, bottom: 0, maxHeight: '75vh' } : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxHeight: '70vh' }),
        display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', overflow: 'hidden',
      }}>
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E2E8F0' }} />
          </div>
        )}
        <div style={{ padding: isMobile ? '4px 20px 14px' : '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>Who's paying?</div>
            <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>Select a child to record their payment</div>
          </div>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', width: 30, height: 30, borderRadius: '50%', fontSize: 15, color: '#64748B', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '14px 20px 10px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94A3B8', pointerEvents: 'none' }}>🔍</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search children…" autoFocus
              style={{ ...inputStyle, padding: '11px 14px 11px 36px', borderRadius: 12, fontSize: 14.5 }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px', paddingBottom: `calc(${isMobile ? '96px' : '16px'} + env(safe-area-inset-bottom, 0px))` }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>No children match "{q}"</div>
            </div>
          ) : filtered.slice(0, 100).map(c => (
            <button key={c.id} onClick={() => onPick(c.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid transparent',
              background: '#fff', marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              transition: 'background 0.15s, border-color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'transparent' }}>
              <ChildAvatar child={c} size={36} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.first_name} {c.last_name}
              </span>
              <span style={{ fontSize: 14, color: '#CBD5E1', flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── OVERVIEW ───────────────────────────────────────────────────────────
function OverviewTab({ charges, summary, childMap, isMobile, onRecordPayment, onCreateCharge }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const outstanding = useMemo(() => {
    let list = charges.filter(c => c.computed_status !== 'paid' && c.computed_status !== 'waived' && c.computed_status !== 'refunded')
    if (statusFilter !== 'all') list = list.filter(c => c.computed_status === statusFilter)
    if (typeFilter !== 'all') list = list.filter(c => c.charge_type === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c => {
        const child = childMap[c.child_id]
        const name = child ? `${child.first_name} ${child.last_name}`.toLowerCase() : ''
        return name.includes(q) || c.title.toLowerCase().includes(q)
      })
    }
    return list
  }, [charges, statusFilter, typeFilter, search, childMap])

  const cards = [
    { label: 'Total due', value: summary.due, icon: '💳', color: PB.blue },
    { label: 'Total collected', value: summary.collected, icon: '✅', color: PB.green },
    { label: 'Outstanding', value: summary.outstanding, icon: '⏳', color: PB.amber },
    { label: 'Overdue', value: summary.overdue, icon: '⚠️', color: PB.red },
  ]

  if (charges.length === 0) {
    return <EmptyState onCreateCharge={onCreateCharge} />
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={card({ padding: 16 })}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: c.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontSize: isMobile ? 18 : 21, fontWeight: 900, color: '#0F172A' }}>{fmtMoney(c.value)}</div>
            <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600, marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={card({ padding: 18 })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Outstanding payments</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by child or charge…" style={{ ...inputStyle, marginBottom: 10 }} />
          <FilterPills
            value={statusFilter} onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'part_paid', label: 'Part paid' },
              { value: 'overdue', label: 'Overdue' },
            ]}
          />
          <div style={{ marginTop: 8 }}>
            <FilterPills
              value={typeFilter} onChange={setTypeFilter}
              options={[{ value: 'all', label: 'All types' }, ...CHARGE_TYPES.map(t => ({ value: t.key, label: t.label }))]}
            />
          </div>
        </div>

        {outstanding.length === 0 ? (
          <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Nothing outstanding matches those filters. 🎉</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {outstanding.map(c => <ChargeCardMobile key={c.id} charge={c} child={childMap[c.child_id]} onRecordPayment={() => onRecordPayment(c)} />)}
          </div>
        ) : (
          <ChargesTable rows={outstanding} childMap={childMap} onRecordPayment={onRecordPayment} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ onCreateCharge }) {
  return (
    <div style={{ ...card({ padding: 40 }), textAlign: 'center', maxWidth: 460, margin: '40px auto' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>No payments yet</div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>Create a charge to start tracking payments for your children.</div>
      <button onClick={onCreateCharge} style={{ ...btnPrimary(PB.blue), margin: '0 auto' }}>+ Create first charge</button>
    </div>
  )
}

function ChargesTable({ rows, childMap, onRecordPayment }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#94A3B8', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <th style={th}>Child</th><th style={th}>Charge</th><th style={th}>Amount</th><th style={th}>Paid</th><th style={th}>Remaining</th><th style={th}>Due date</th><th style={th}>Status</th><th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => {
            const child = childMap[c.child_id]
            return (
              <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ChildAvatar child={child} size={30} />
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{child ? `${child.first_name} ${child.last_name}` : 'Unknown'}</span>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{chargeTypeLabel(c.charge_type)}</span>
                </td>
                <td style={td}>{fmtMoney(c.amount)}</td>
                <td style={{ ...td, color: PB.green, fontWeight: 700 }}>{fmtMoney(c.paid_amount)}</td>
                <td style={{ ...td, color: PB.red, fontWeight: 700 }}>{fmtMoney(c.remaining)}</td>
                <td style={td}>{fmtDateShort(c.due_date)}</td>
                <td style={td}><span style={chipStyle(c.computed_status)}>{labelFor(c.computed_status)}</span></td>
                <td style={td}>
                  {c.remaining > 0 && c.computed_status !== 'waived' && (
                    <button onClick={() => onRecordPayment(c)} style={{ ...btnGhost, padding: '6px 10px', fontSize: 11.5 }}>Record</button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ChargeCardMobile({ charge, child, onRecordPayment, extraAction }) {
  return (
    <div style={{ border: '1px solid #F1F5F9', borderRadius: 14, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <ChildAvatar child={child} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{child ? `${child.first_name} ${child.last_name}` : 'Unknown'}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{charge.title}</div>
        </div>
        <span style={chipStyle(charge.computed_status, 'sm')}>{labelFor(charge.computed_status)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#64748B', marginBottom: 8 }}>
        <span>{fmtMoney(charge.amount)} total</span>
        <span style={{ color: PB.green, fontWeight: 700 }}>{fmtMoney(charge.paid_amount)} paid</span>
        <span style={{ color: PB.red, fontWeight: 700 }}>{fmtMoney(charge.remaining)} left</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {charge.remaining > 0 && charge.computed_status !== 'waived' && (
          <button onClick={onRecordPayment} style={{ ...btnPrimary(PB.blue), flex: 1, justifyContent: 'center', padding: '8px' }}>Record payment</button>
        )}
        {extraAction}
      </div>
    </div>
  )
}

function ChildAvatar({ child, size = 32 }) {
  if (!child) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#E2E8F0', flexShrink: 0 }} />
  return child.photo_url ? (
    <SignedImg bucket="gallery" src={child.photo_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: PB.purple, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, flexShrink: 0 }}>
      {initials(child.first_name, child.last_name)}
    </div>
  )
}

function labelFor(status) {
  return { paid: 'Paid', part_paid: 'Part paid', unpaid: 'Unpaid', overdue: 'Overdue', waived: 'Waived', refunded: 'Refunded' }[status] || status
}

// ─── CHARGES TAB ────────────────────────────────────────────────────────
function ChargesTab({ charges, childMap, isMobile, isAdmin, session, onRecordPayment, onCreateCharge, onWaived }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [waiveTarget, setWaiveTarget] = useState(null)

  const filtered = statusFilter === 'all' ? charges : charges.filter(c => c.computed_status === statusFilter)

  if (charges.length === 0) return <EmptyState onCreateCharge={onCreateCharge} />

  return (
    <div style={card({ padding: 18 })}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>All charges <span style={{ color: '#94A3B8', fontWeight: 600 }}>({filtered.length})</span></div>
        <FilterPills
          value={statusFilter} onChange={setStatusFilter}
          options={[{ value: 'all', label: 'All statuses' }, ...['unpaid', 'part_paid', 'paid', 'overdue', 'waived', 'refunded'].map(s => ({ value: s, label: labelFor(s) }))]}
        />
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => (
            <ChargeCardMobile key={c.id} charge={c} child={childMap[c.child_id]} onRecordPayment={() => onRecordPayment(c)}
              extraAction={c.remaining > 0 && c.computed_status !== 'waived' && (
                <button onClick={() => setWaiveTarget(c)} style={{ ...btnGhost, padding: '8px 10px' }}>Waive</button>
              )} />
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94A3B8', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={th}>Child</th><th style={th}>Charge</th><th style={th}>Amount</th><th style={th}>Paid</th><th style={th}>Remaining</th><th style={th}>Due date</th><th style={th}>Status</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const child = childMap[c.child_id]
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ChildAvatar child={child} size={30} />
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{child ? `${child.first_name} ${child.last_name}` : 'Unknown'}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{chargeTypeLabel(c.charge_type)}</span>
                    </td>
                    <td style={td}>{fmtMoney(c.amount)}</td>
                    <td style={{ ...td, color: PB.green, fontWeight: 700 }}>{fmtMoney(c.paid_amount)}</td>
                    <td style={{ ...td, color: PB.red, fontWeight: 700 }}>{fmtMoney(c.remaining)}</td>
                    <td style={td}>{fmtDateShort(c.due_date)}</td>
                    <td style={td}><span style={chipStyle(c.computed_status)}>{labelFor(c.computed_status)}</span></td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.remaining > 0 && c.computed_status !== 'waived' && (
                          <>
                            <button onClick={() => onRecordPayment(c)} style={{ ...btnGhost, padding: '6px 10px', fontSize: 11.5 }}>Record</button>
                            {isAdmin && <button onClick={() => setWaiveTarget(c)} style={{ ...btnGhost, padding: '6px 10px', fontSize: 11.5 }}>Waive</button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {waiveTarget && (
        <WaiveModal charge={waiveTarget} session={session} onClose={() => setWaiveTarget(null)} onWaived={() => { setWaiveTarget(null); onWaived() }} />
      )}
    </div>
  )
}

function WaiveModal({ charge, session, onClose, onWaived }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleWaive = async () => {
    setSaving(true)
    const { error } = await supabase.from('payment_charges').update({
      status: 'waived', waived_by: session?.user?.id, waived_at: new Date().toISOString(), waiver_reason: reason.trim() || null,
    }).eq('id', charge.id)
    setSaving(false)
    if (!error) onWaived()
  }

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10401, background: '#fff', borderRadius: 18, width: 'min(400px, 90vw)', padding: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Waive charge</div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>{charge.title} — {fmtMoney(charge.remaining)} remaining will be waived. This is recorded, not deleted.</div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit', marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}>Cancel</button>
          <button onClick={handleWaive} disabled={saving} style={{ ...btnPrimary(PB.purple), flex: 1, justifyContent: 'center' }}>{saving ? 'Waiving…' : 'Waive charge'}</button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── TRANSACTIONS TAB ───────────────────────────────────────────────────
function TransactionsTab({ transactions, charges, childMap, staffMap, isMobile, session, onRefunded }) {
  const [methodFilter, setMethodFilter] = useState('all')
  const [refundTarget, setRefundTarget] = useState(null)

  const chargeMap = useMemo(() => { const m = {}; for (const c of charges) m[c.id] = c; return m }, [charges])
  const filtered = methodFilter === 'all' ? transactions : transactions.filter(t => t.payment_method === methodFilter)

  if (transactions.length === 0) {
    return (
      <div style={{ ...card({ padding: 40 }), textAlign: 'center', maxWidth: 460, margin: '40px auto' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>No payments recorded yet</div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>Payments recorded against charges will show up here.</div>
      </div>
    )
  }

  return (
    <div style={card({ padding: 18 })}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Transactions <span style={{ color: '#94A3B8', fontWeight: 600 }}>({filtered.length})</span></div>
        <FilterPills
          value={methodFilter} onChange={setMethodFilter}
          options={[{ value: 'all', label: 'All methods' }, ...PAYMENT_METHODS.map(m => ({ value: m.key, label: `${m.icon} ${m.label}` }))]}
        />
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(t => {
            const child = childMap[t.child_id]
            const chg = chargeMap[t.charge_id]
            return (
              <div key={t.id} style={{ border: '1px solid #F1F5F9', borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.transaction_type === 'refund' ? PB.red : PB.green }}>
                    {t.transaction_type === 'refund' ? '−' : '+'}{fmtMoney(t.amount)}
                  </span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{fmtDateShort(t.payment_date)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#334155' }}>{child ? `${child.first_name} ${child.last_name}` : 'Unknown'} · {chg?.title || '—'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{methodLabel(t.payment_method)} · {staffMap[t.recorded_by] || 'Staff'}</div>
                {t.transaction_type === 'payment' && (
                  <button onClick={() => setRefundTarget(t)} style={{ ...btnGhost, marginTop: 8, padding: '6px 10px', fontSize: 11 }}>Refund</button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94A3B8', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={th}>Date</th><th style={th}>Child</th><th style={th}>Charge</th><th style={th}>Amount</th><th style={th}>Method</th><th style={th}>Recorded by</th><th style={th}>Reference</th><th style={th}>Status</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const child = childMap[t.child_id]
                const chg = chargeMap[t.charge_id]
                return (
                  <tr key={t.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={td}>{fmtDateShort(t.payment_date)}</td>
                    <td style={td}>{child ? `${child.first_name} ${child.last_name}` : 'Unknown'}</td>
                    <td style={td}>{chg?.title || '—'}</td>
                    <td style={{ ...td, fontWeight: 700, color: t.transaction_type === 'refund' ? PB.red : PB.green }}>
                      {t.transaction_type === 'refund' ? '−' : '+'}{fmtMoney(t.amount)}
                    </td>
                    <td style={td}>{methodLabel(t.payment_method)}</td>
                    <td style={td}>{staffMap[t.recorded_by] || '—'}</td>
                    <td style={td}>{t.reference || '—'}</td>
                    <td style={td}>
                      <span style={chipStyle(t.transaction_type === 'refund' ? 'refunded' : 'paid', 'sm')}>{t.transaction_type === 'refund' ? 'Refund' : 'Payment'}</span>
                    </td>
                    <td style={td}>
                      {t.transaction_type === 'payment' && (
                        <button onClick={() => setRefundTarget(t)} style={{ ...btnGhost, padding: '6px 10px', fontSize: 11.5 }}>Refund</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {refundTarget && (
        <RefundModal transaction={refundTarget} charge={chargeMap[refundTarget.charge_id]} session={session}
          onClose={() => setRefundTarget(null)} onRefunded={() => { setRefundTarget(null); onRefunded() }} />
      )}
    </div>
  )
}

function RefundModal({ transaction, charge, session, onClose, onRefunded }) {
  const [amount, setAmount] = useState(String(transaction.amount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleRefund = async () => {
    setError('')
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || amt > Number(transaction.amount)) { setError('Enter a valid refund amount (up to the original payment).'); return }
    setSaving(true)
    const { error: err } = await supabase.from('payment_transactions').insert({
      org_id: transaction.org_id, charge_id: transaction.charge_id, child_id: transaction.child_id,
      amount: amt, payment_method: transaction.payment_method, payment_date: new Date().toISOString().slice(0, 10),
      reference: `Refund of ${transaction.reference || transaction.id.slice(0, 8)}`,
      transaction_type: 'refund', recorded_by: session?.user?.id,
    })
    setSaving(false)
    if (err) { setError(err.message || 'Could not record refund.'); return }
    onRefunded()
  }

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10401, background: '#fff', borderRadius: 18, width: 'min(380px, 90vw)', padding: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>Refund payment</div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>{charge?.title} — original payment {fmtMoney(transaction.amount)}. This creates a linked refund transaction; the original record is kept.</div>
        <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>Refund amount</label>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, color: '#64748B', fontWeight: 700 }}>£</span>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, paddingLeft: 24 }} />
        </div>
        {error && <div style={{ fontSize: 12, color: PB.red, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}>Cancel</button>
          <button onClick={handleRefund} disabled={saving} style={{ ...btnPrimary(PB.red), flex: 1, justifyContent: 'center' }}>{saving ? 'Refunding…' : 'Refund'}</button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── RECONCILIATION TAB ─────────────────────────────────────────────────
function ReconciliationTab({ transactions, childMap, staffMap, isMobile, onReconciled }) {
  const cashTx = transactions.filter(t => t.payment_method === 'cash' && t.transaction_type === 'payment')
  const awaiting = cashTx.filter(t => !t.reconciled)
  const reconciledToday = cashTx.filter(t => t.reconciled && t.reconciled_at && t.reconciled_at.slice(0, 10) === new Date().toISOString().slice(0, 10))

  const awaitingTotal = awaiting.reduce((s, t) => s + Number(t.amount), 0)
  const reconciledTodayTotal = reconciledToday.reduce((s, t) => s + Number(t.amount), 0)

  const markReconciled = async (id) => {
    const { error } = await supabase.rpc('reconcile_payment_transaction', { transaction_id: id })
    if (!error) onReconciled()
  }

  if (cashTx.length === 0) {
    return (
      <div style={{ ...card({ padding: 40 }), textAlign: 'center', maxWidth: 460, margin: '40px auto' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>No cash payments yet</div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>Cash payments will show up here for reconciliation once recorded.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={card({ padding: 16 })}>
          <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700, marginBottom: 4 }}>Cash awaiting reconciliation</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: PB.amber }}>{fmtMoney(awaitingTotal)}</div>
        </div>
        <div style={card({ padding: 16 })}>
          <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700, marginBottom: 4 }}>Reconciled today</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: PB.green }}>{fmtMoney(reconciledTodayTotal)}</div>
        </div>
      </div>

      <div style={card({ padding: 18 })}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Cash transactions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cashTx.map(t => {
            const child = childMap[t.child_id]
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #F1F5F9', borderRadius: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{fmtMoney(t.amount)} cash recorded by {staffMap[t.recorded_by] || 'staff'}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    {child ? `${child.first_name} ${child.last_name}` : 'Unknown'} · {new Date(t.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {t.reconciled ? (
                  <span style={chipStyle('paid', 'sm')}>✓ Reconciled</span>
                ) : (
                  <>
                    <span style={chipStyle('unpaid', 'sm')}>Awaiting reconciliation</span>
                    <button onClick={() => markReconciled(t.id)} style={{ ...btnPrimary(PB.blue), padding: '7px 12px', fontSize: 11.5 }}>Mark reconciled</button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const th = { padding: '8px 10px', whiteSpace: 'nowrap' }
const td = { padding: '10px 10px', verticalAlign: 'middle' }
