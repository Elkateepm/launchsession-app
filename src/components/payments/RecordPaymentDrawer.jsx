import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { PB, PAYMENT_METHODS, fmtMoney, inputStyle } from './paymentsShared'
import Icon from '../../lib/icons'

// Drawer for recording a payment against a charge. Can be opened two ways:
//   - with a specific `charge` (balance row from payment_charge_balances) already known
//   - with just a `childId`, in which case it loads that child's outstanding charges
//     and lets staff pick which one the payment is against
export default function RecordPaymentDrawer({ org, session, charge: initialCharge, childId, onClose, onRecorded }) {
  const isMobile = useIsMobile()
  const [loadingCharges, setLoadingCharges] = useState(!initialCharge)
  const [outstandingCharges, setOutstandingCharges] = useState([])
  const [charge, setCharge] = useState(initialCharge || null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (initialCharge || !childId) return
    let cancelled = false
    supabase.from('payment_charge_balances').select('*')
      .eq('org_id', org.id).eq('child_id', childId).gt('remaining', 0).neq('computed_status', 'waived')
      .order('due_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (cancelled) return
        setOutstandingCharges(data || [])
        setLoadingCharges(false)
      })
    return () => { cancelled = true }
  }, [org?.id, childId, initialCharge])

  useEffect(() => {
    if (charge) setAmount(String(charge.remaining))
  }, [charge])

  const handleSubmit = async () => {
    setError('')
    const amt = parseFloat(amount)
    if (!charge) { setError('Choose which charge this payment is for.'); return }
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('payment_transactions').insert({
      org_id: org.id,
      charge_id: charge.id,
      child_id: charge.child_id,
      amount: amt,
      payment_method: method,
      payment_date: date,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      transaction_type: 'payment',
      recorded_by: session?.user?.id,
    })
    setSaving(false)
    if (err) { setError(err.message || 'Could not record payment.'); return }
    setDone(true)
    setTimeout(() => { onRecorded && onRecorded(); onClose() }, 900)
  }

  const remaining = charge ? Number(charge.remaining) : 0

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10400, backdropFilter: 'blur(2px)' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', zIndex: 10401, background: '#fff', display: 'flex', flexDirection: 'column',
          ...(isMobile
            ? { left: 0, right: 0, bottom: 0, maxHeight: '92vh', borderRadius: '20px 20px 0 0' }
            : { top: 0, right: 0, bottom: 0, width: 420, boxShadow: '-24px 0 60px rgba(0,0,0,0.2)' }),
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>Record payment</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer', padding: 4 }}><Icon name="✕" /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '40px 10px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 14px' }}><Icon name="✓" /></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Payment recorded</div>
            </div>
          ) : (
            <>
              {!initialCharge && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>Charge</label>
                  {loadingCharges ? (
                    <div style={{ fontSize: 12.5, color: '#94A3B8' }}>Loading outstanding charges…</div>
                  ) : outstandingCharges.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No outstanding charges for this child.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {outstandingCharges.map(c => (
                        <button key={c.id} onClick={() => setCharge(c)} style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          border: charge?.id === c.id ? `2px solid ${PB.blue}` : '1.5px solid #E2E8F0',
                          background: charge?.id === c.id ? '#EFF6FF' : '#fff',
                        }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{c.title}</div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{fmtMoney(c.remaining)} remaining of {fmtMoney(c.amount)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {charge && (
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>{charge.title}</div>
                  <Row label="Original charge" value={fmtMoney(charge.amount)} />
                  <Row label="Already paid" value={fmtMoney(charge.paid_amount)} />
                  <Row label="Outstanding" value={fmtMoney(charge.remaining)} strong />
                </div>
              )}

              {charge && (
                <>
                  <Field label="Amount received">
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, color: '#64748B', fontWeight: 700 }}>£</span>
                      <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                        style={{ ...inputStyle, paddingLeft: 24 }} placeholder="0.00" />
                    </div>
                    {parseFloat(amount) > remaining && remaining > 0 && (
                      <div style={{ fontSize: 11, color: PB.amber, marginTop: 4 }}>This is more than the outstanding balance.</div>
                    )}
                  </Field>

                  <Field label="Payment method">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                      {PAYMENT_METHODS.map(m => (
                        <button key={m.key} onClick={() => setMethod(m.key)} style={{
                          padding: '8px 10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                          border: method === m.key ? `2px solid ${PB.blue}` : '1.5px solid #E2E8F0',
                          background: method === m.key ? '#EFF6FF' : '#fff', color: '#334155',
                        }}>
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Payment date">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                  </Field>

                  <Field label="Reference (optional)">
                    <input value={reference} onChange={e => setReference(e.target.value)} style={inputStyle} placeholder="e.g. receipt number" />
                  </Field>

                  <Field label="Notes (optional)">
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
                  </Field>

                  {error && <div style={{ fontSize: 12.5, color: PB.red, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
                </>
              )}
            </>
          )}
        </div>

        {!done && charge && (
          <div style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
            <button onClick={handleSubmit} disabled={saving} style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: saving ? 'default' : 'pointer',
              background: saving ? '#93C5FD' : PB.gradient, color: '#fff', fontSize: 14, fontWeight: 800,
            }}>
              {saving ? 'Recording…' : `Record ${fmtMoney(parseFloat(amount) || 0)} payment`}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12.5 }}>
      <span style={{ color: '#64748B' }}>{label}</span>
      <span style={{ fontWeight: strong ? 900 : 700, color: strong ? '#0F172A' : '#334155' }}>{value}</span>
    </div>
  )
}
