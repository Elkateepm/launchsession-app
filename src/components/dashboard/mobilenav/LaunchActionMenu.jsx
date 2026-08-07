import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QuickActionItem from './QuickActionItem'
import { CalendarPlusIcon, QrCodeIcon, FileTextIcon, ShieldAlertIcon, HeartHandshakeIcon, CreditCardIcon } from './icons'

// The panel that opens directly above the dock when Launch is tapped. Dims the
// page behind it, keeps the dock itself visible, and closes on outside tap.
export default function LaunchActionMenu({ open, onClose, actions, reducedMotion }) {
  const fadeTransition = reducedMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 34 }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.18 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,26,0.55)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 10001 }}
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
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={fadeTransition}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: 12, right: 12,
              bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
              zIndex: 10002,
              background: 'rgba(15,18,38,0.94)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 22,
              padding: 14,
              boxShadow: '0 -12px 40px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.25)',
              touchAction: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, marginTop: -2 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.25)', cursor: 'grab' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {actions.map(a => (
                <QuickActionItem key={a.key} icon={a.icon} label={a.label} color={a.color} onClick={() => { onClose(); a.onSelect(); }} />
              ))}
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
