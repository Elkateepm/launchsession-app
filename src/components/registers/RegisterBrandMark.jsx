import React, { useState } from 'react'
import launchSessionBadge from '../../assets/images/launchsession-badge-hq.png'

export default function RegisterBrandMark({ org, product = false, size = 44 }) {
  const source = (!product && (org?.icon_url || org?.logo_url)) || launchSessionBadge
  const [failedSource, setFailedSource] = useState(null)
  return <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, borderRadius: Math.round(size * .27), background: '#fff', border: '1px solid #ffffff70', boxShadow: '0 5px 16px #00000014', overflow: 'hidden' }}>
    <img src={failedSource === source ? launchSessionBadge : source} alt="" onError={() => setFailedSource(source)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3, boxSizing: 'border-box' }} />
  </span>
}
