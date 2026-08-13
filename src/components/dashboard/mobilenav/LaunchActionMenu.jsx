import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QuickActionItem from './QuickActionItem'
import { CalendarPlusIcon, QrCodeIcon, FileTextIcon, ShieldAlertIcon, HeartHandshakeIcon, CreditCardIcon } from './icons'

// The panel that opens directly above the dock when Launch is tapped. Dims the
// page behind it, keeps the dock itself visible, and closes on outside tap.
//
// Actions are no longer six identical tiles in an undifferentiated grid. They
// are ordered by what people actually reach for and grouped by intent, so the
// menu answers "what am I trying to do" rather than "which of these six squares
// was the one I wanted":
//
//   • one primary row for the action the menu exists for (starting a session)
//   • labelled groups for the rest, so related things sit together
//   • the safeguarding action pulled out below a divider, styled as its own
//     thing — it's an emergency, not a peer of "Create Form", and it should
//     never be reachable by a mis-tap aimed at something routine
//
// Actions may set `emphasis: 'primary' | 'danger'`, a `group` name and a `hint`.
// Anything that doesn't gets sensible defaults from ACTION_META below, so an
// action array assembled elsewhere still renders correctly.
export default function LaunchActionMenu({ open, onClose, actions, reducedMotion }) {
  const fadeTransition = reducedMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 34 }

  const enriched = (actions || []).map(a => ({ ...ACTION_META[a.key], ...a }))
  const primary = enriched.filter(a => a.emphasis === 'primary')
  const danger = enriched.filter(a => a.emphasis === 'danger')
  const grouped = []
  enriched
    .filter(a => a.emphasis !== 'primary' && a.emphasis !== 'danger')
    .forEach(a => {
      const name = a.group || 'Quick actions'
      const existing = grouped.find(g => g.name === name)
      if (existing) existing.items.push(a)
      else grouped.push({ name, items: [a] })
    })

  // Rows fade in one after another so the eye is led down the list instead of
  // being hit with everything at once. Skipped entirely under reduced motion.
  let rowIndex = 0
  const rowMotion = () => {
    const i = rowIndex++
    if (reducedMotion) return {}
    return {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { delay: 0.03 + i * 0.028, duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    }
  }

  const renderRow = (a, variant) => (
    <motion.div key={a.key} {...rowMotion()}>
      <QuickActionItem
        icon={a.icon}
        label={a.label}
        hint={a.hint}
        color={a.color}
        variant={variant}
        onClick={() => { onClose(); a.onSelect(); }}
      />
    </motion.div>
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.18 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,26,0.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 10001 }}
          />
          <motion.div
            role="menu"
            aria-label="Quick actions"
            drag="y"
            dragConstraints={{ top: 0, bottom: 300 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 70 || info.velocity.y > 500) onClose()
            }}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
            transition={fadeTransition}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: 10, right: 10,
              bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
              maxHeight: 'calc(100vh - 190px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              zIndex: 10002,
              // Slightly warmer, deeper glass than before, with a hairline
              // highlight along the top edge so the sheet reads as a raised
              // surface rather than a flat rectangle laid over the page.
              background: 'linear-gradient(180deg, rgba(24,28,52,0.97), rgba(13,16,34,0.97))',
              backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 26,
              padding: '10px 12px 14px',
              boxShadow: '0 1px 0 rgba(255,255,255,0.09) inset, 0 -14px 48px rgba(0,0,0,0.45), 0 6px 28px rgba(0,0,0,0.3)',
              touchAction: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
              <div style={{ width: 38, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.22)', cursor: 'grab' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {primary.map(a => renderRow(a, 'primary'))}

              {grouped.map(group => (
                <div key={group.name} style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 5 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.34)', padding: '0 4px' }}>
                    {group.name}
                  </div>
                  {group.items.map(a => renderRow(a, 'default'))}
                </div>
              ))}

              {danger.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {danger.map(a => renderRow(a, 'danger'))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Default icon set for the six quick actions specified in the design brief —
// exported so the orchestrator can attach real onSelect handlers per action.
export const DEFAULT_ACTION_ICONS = {
  newSession: CalendarPlusIcon,
  payments: CreditCardIcon,
  scanQR: QrCodeIcon,
  createForm: FileTextIcon,
  reportIncident: ShieldAlertIcon,
  addVolunteer: HeartHandshakeIcon,
}

// Grouping, emphasis and one-line explanations, keyed by action. Kept here
// rather than in the dock so the menu owns its own information design and any
// caller passing a bare {key, label, icon, onSelect} still gets the full layout.
export const ACTION_META = {
  newSession: { emphasis: 'primary', hint: 'Plan a session and open its register' },
  scanQR: { group: 'Bring people in', hint: 'Let parents sign a child up on the spot' },
  addVolunteer: { group: 'Bring people in', hint: 'Invite someone to help out' },
  payments: { group: 'Admin', hint: 'Take a payment or check what’s owed' },
  createForm: { group: 'Admin', hint: 'Consent, feedback or sign-up form' },
  reportIncident: { emphasis: 'danger', hint: 'Log a safeguarding or injury concern' },
}
