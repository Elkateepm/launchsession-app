import React, { useState } from 'react'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { PB, fmtMoney } from './paymentsShared'

// Very small, deliberately quiet badge for the live register row. Shows nothing
// if the child has no charges at all, "Paid" in green if fully settled, or the
// amount due in red/amber otherwise. Tapping opens a quick payment drawer scoped
// to that child -- no other financial detail is exposed on the register itself.
export default function RegisterPaymentBadge({ org, session, childId, balance, onChanged }) {
  const [open, setOpen] = useState(false)
  if (!balance) return null // no charges at all -- stay silent

  const { outstanding, hasAny } = balance
  if (!hasAny) return null

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title="Payment status"
        style={{
          border: 'none', cursor: 'pointer', borderRadius: 99, padding: '2px 9px', fontSize: 10, fontWeight: 800,
          color: outstanding > 0 ? PB.red : PB.green,
          background: outstanding > 0 ? PB.redBg : PB.greenBg,
          flexShrink: 0,
        }}
      >
        {outstanding > 0 ? `${fmtMoney(outstanding)} due` : 'Paid'}
      </button>

      {open && (
        <RecordPaymentDrawer org={org} session={session} childId={childId}
          onClose={() => setOpen(false)} onRecorded={() => onChanged && onChanged()} />
      )}
    </>
  )
}
