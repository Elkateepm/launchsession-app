import React, { useState, useEffect, useMemo, useCallback } from 'react'
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

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'charges', label: 'Charges' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'reconciliation', label: 'Reconciliation' },
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

      <div style={{ padding: '0 24px', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
              color: tab === t.key ? primary : '#64748B',
              borderBottom: tab === t.key ? `2.5px solid ${primary}` : '2.5px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>
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

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0F172A', color: '#fff', padding: '10px 20px', borderRadius: 99, fontSize: 13, fontWeight: 700, zIndex: 10500, boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}>
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

// ─── Small child-picker used when "Record Payment" is clicked from the header
// without a specific charge already in context.
function PickChildThenPay({ children, onClose, onPick, isMobile }) {
  const [q, setQ] = useState('')
  const filtered = children.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', zIndex: 10401, background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : 20,
        ...(isMobile ? { left: 0, right: 0, bottom: 0, maxHeight: '80vh' } : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, maxHeight: '70vh' }),
        display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>Who's paying?</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search children…" style={inputStyle} autoFocus />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {filtered.slice(0, 100).map(c => (
            <button key={c.id} onClick={() => onPick(c.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid #F1F5F9',
              background: '#fff', marginBottom: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0F172A',
            }}>{c.first_name} {c.last_name}</button>
          ))}
        </div>
      </div>
    </>
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by child or charge…" style={{ ...inputStyle, flex: '1 1 200px' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">Status: All</option>
            <option value="unpaid">Unpaid</option>
            <option value="part_paid">Part paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">Charge type: All</option>
            {CHARGE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
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
    <img src={child.photo_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>All charges <span style={{ color: '#94A3B8', fontWeight: 600 }}>({filtered.length})</span></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="all">All statuses</option>
          {['unpaid', 'part_paid', 'paid', 'overdue', 'waived', 'refunded'].map(s => <option key={s} value={s}>{labelFor(s)}</option>)}
        </select>
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

  return (
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
    </>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Transactions <span style={{ color: '#94A3B8', fontWeight: 600 }}>({filtered.length})</span></div>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="all">Method: All</option>
          {PAYMENT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
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

  return (
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
    </>
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
