import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { PB, fmtMoney, fmtDateShort, chargeTypeLabel, methodLabel, chipStyle, btnPrimary, btnGhost } from './paymentsShared'

// Compact "Payments" card for the child profile grid, plus the full-history modal
// opened by "View payments".
export default function ChildPaymentsCard({ org, session, child }) {
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  const load = useCallback(() => {
    if (!org?.id || !child?.id) return
    setLoading(true)
    supabase.from('payment_charge_balances').select('*').eq('org_id', org.id).eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCharges(data || []); setLoading(false) })
  }, [org?.id, child?.id])

  useEffect(() => { load() }, [load])

  const due = charges.reduce((s, c) => s + Number(c.amount), 0)
  const paid = charges.reduce((s, c) => s + Number(c.paid_amount), 0)
  const outstanding = charges.reduce((s, c) => s + (c.computed_status === 'waived' ? 0 : Number(c.remaining)), 0)

  if (loading) return null

  return (
    <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>💳 Payments</div>

      {charges.length === 0 ? (
        <div style={{ fontSize: 11.5, color: '#94A3B8', marginBottom: 10 }}>No charges recorded yet.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
            <MiniStat label="due" value={due} color="#0F172A" />
            <MiniStat label="paid" value={paid} color={PB.green} />
            <MiniStat label="outstanding" value={outstanding} color={outstanding > 0 ? PB.red : '#0F172A'} />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: charges.length ? 10 : 0 }}>
        <button onClick={() => setShowHistory(true)} style={{ ...btnGhost, flex: 1, justifyContent: 'center', padding: '7px 0', fontSize: 11.5 }}>View payments</button>
        <button onClick={() => setPayOpen(true)} style={{ ...btnPrimary(PB.blue), flex: 1, justifyContent: 'center', padding: '7px 0', fontSize: 11.5 }}>+ Record payment</button>
      </div>

      {charges.slice(0, 3).map(c => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{fmtMoney(c.amount)}</div>
          </div>
          <span style={chipStyle(c.computed_status, 'sm')}>
            {c.computed_status === 'part_paid' ? `${fmtMoney(c.remaining)} left` : { paid: 'Paid', unpaid: 'Unpaid', overdue: 'Overdue', waived: 'Waived', refunded: 'Refunded' }[c.computed_status]}
          </span>
        </div>
      ))}

      {payOpen && (
        <RecordPaymentDrawer org={org} session={session} childId={child.id} onClose={() => setPayOpen(false)} onRecorded={load} />
      )}
      {showHistory && (
        <ChildPaymentHistoryModal org={org} session={session} child={child} charges={charges} onClose={() => setShowHistory(false)} onChanged={load} />
      )}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 900, color }}>{fmtMoney(value)}</div>
      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

function ChildPaymentHistoryModal({ org, session, child, charges, onClose, onChanged }) {
  const isMobile = useIsMobile()
  const [transactions, setTransactions] = useState([])
  const [payOpen, setPayOpen] = useState(false)

  useEffect(() => {
    supabase.from('payment_transactions').select('*').eq('org_id', org.id).eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTransactions(data || []))
  }, [org?.id, child?.id])

  const chargeMap = {}
  for (const c of charges) chargeMap[c.id] = c

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10450 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', zIndex: 10451, background: '#fff',
        ...(isMobile ? { left: 0, right: 0, bottom: 0, top: 40, borderRadius: '20px 20px 0 0' } : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(640px, 94vw)', maxHeight: '86vh', borderRadius: 20 }),
        display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>{child.first_name} {child.last_name} — Payments</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Charges</div>
          {charges.length === 0 ? <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>No charges yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {charges.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #F1F5F9', borderRadius: 12, padding: '10px 12px' }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{c.title}</div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{chargeTypeLabel(c.charge_type)} · {fmtMoney(c.amount)} · Due {fmtDateShort(c.due_date)}</div>
                  </div>
                  <span style={chipStyle(c.computed_status, 'sm')}>{{ paid: 'Paid', part_paid: 'Part paid', unpaid: 'Unpaid', overdue: 'Overdue', waived: 'Waived', refunded: 'Refunded' }[c.computed_status]}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Transaction history</div>
          {transactions.length === 0 ? <div style={{ fontSize: 12, color: '#94A3B8' }}>No payments recorded yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {transactions.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F8FAFC', fontSize: 12 }}>
                  <span>{fmtDateShort(t.payment_date)} · {methodLabel(t.payment_method)}{t.reference ? ` · ${t.reference}` : ''}</span>
                  <span style={{ fontWeight: 700, color: t.transaction_type === 'refund' ? PB.red : PB.green }}>
                    {t.transaction_type === 'refund' ? '−' : '+'}{fmtMoney(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
          <button onClick={() => setPayOpen(true)} style={{ ...btnPrimary(PB.blue), width: '100%', justifyContent: 'center' }}>+ Record payment</button>
        </div>
      </div>

      {payOpen && (
        <RecordPaymentDrawer org={org} session={session} childId={child.id} onClose={() => setPayOpen(false)}
          onRecorded={() => { onChanged(); supabase.from('payment_transactions').select('*').eq('org_id', org.id).eq('child_id', child.id).order('created_at', { ascending: false }).then(({ data }) => setTransactions(data || [])) }} />
      )}
    </>
  )
}
