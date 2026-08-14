import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { LS, IconGlyph } from '../fundraisingShared'
import {
  createPaymentLink, publicPayUrl, getPaymentAccount, startPaymentOnboarding,
} from '../../../services/paymentService'

// Payment links and provider setup live together: a link is only half-useful
// without a provider behind it, and splitting them across two tabs would mean
// an organisation could create links for weeks without ever seeing why none of
// them take money.

export default function PaymentsPanel({ org, isAdmin, campaigns = [] }) {
  const [links, setLinks] = useState([])
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const [{ data: rows }, acct] = await Promise.all([
      supabase.from('fundraising_payment_links').select('*').eq('org_id', org.id)
        .order('created_at', { ascending: false }),
      // Non-admins can't read the provider account row by design, so this
      // resolves to null for them and the settings card is hidden below.
      isAdmin ? getPaymentAccount(org.id) : Promise.resolve(null),
    ])
    setLinks(rows || [])
    setAccount(acct)
    setLoading(false)
  }, [org?.id, isAdmin])

  useEffect(() => { load() }, [load])

  const linkedCampaignIds = new Set(links.map(l => l.campaign_id))
  const availableCampaigns = campaigns.filter(c => !linkedCampaignIds.has(c.id))

  async function addLink(campaign) {
    setCreating(true)
    const res = await createPaymentLink({
      orgId: org.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
    })
    setCreating(false)
    if (!res.ok) { setNotice(res.message || 'Could not create the link.'); return }
    setLinks(l => [res.link, ...l])
  }

  async function toggleLink(link) {
    const next = link.status === 'disabled' ? 'setup_required' : 'disabled'
    const { error } = await supabase
      .from('fundraising_payment_links')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', link.id)
    if (error) { setNotice(error.message); return }
    setLinks(ls => ls.map(l => l.id === link.id ? { ...l, status: next } : l))
  }

  function copy(link) {
    const url = publicPayUrl(link.slug)
    navigator.clipboard?.writeText(url).then(
      () => { setCopied(link.id); setTimeout(() => setCopied(null), 1800) },
      () => setNotice('Could not copy — select the link and copy it manually.')
    )
  }

  async function connect() {
    const res = await startPaymentOnboarding(org.id)
    setNotice(res.message || 'Online payment setup is coming soon.')
  }

  const connected = account?.status === 'connected' && account?.payments_enabled

  return (
    <div>
      {/* provider */}
      {isAdmin && (
        <div style={{
          background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 16,
          padding: 18, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: LS.lavender,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <IconGlyph name="coin" color={LS.purpleDark} size={19} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: LS.text }}>Online payments</div>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                  background: connected ? '#E7F8ED' : '#F3F2F7',
                  color: connected ? LS.success : LS.muted,
                }}>{connected ? 'Connected' : 'Not connected'}</span>
              </div>
              <div style={{ fontSize: 13.5, color: LS.muted, lineHeight: 1.55, marginTop: 6 }}>
                Connect a payment provider to accept donations through LaunchSession.
                Card details are handled entirely by the provider — LaunchSession never
                sees or stores them.
              </div>
              {!connected && (
                <button
                  onClick={connect}
                  style={{
                    marginTop: 13, padding: '10px 17px', borderRadius: 11, border: 'none',
                    background: LS.gradient, color: '#fff', fontSize: 14, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Connect Payments</button>
              )}
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div style={{
          padding: '11px 14px', borderRadius: 11, background: LS.lavender,
          border: `1px solid ${LS.lavenderBorder}`, color: LS.purpleDeep,
          fontSize: 13.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ flex: 1 }}>{notice}</span>
          <button onClick={() => setNotice(null)} style={{
            border: 'none', background: 'transparent', color: LS.purpleDeep,
            cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 2,
          }}>×</button>
        </div>
      )}

      {/* links */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 11 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: LS.text }}>Payment links</div>
        <div style={{ fontSize: 12.5, color: LS.muted }}>
          A public page per campaign you can share anywhere
        </div>
      </div>

      {loading && (
        <div style={{ padding: 30, textAlign: 'center', color: LS.muted, fontSize: 14 }}>Loading…</div>
      )}

      {!loading && links.length === 0 && (
        <div style={{
          padding: '30px 22px', textAlign: 'center', background: '#fff',
          border: `1px solid ${LS.border}`, borderRadius: 16, marginBottom: 14,
        }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: LS.text, marginBottom: 5 }}>
            No payment links yet
          </div>
          <div style={{ fontSize: 13, color: LS.muted, lineHeight: 1.5, maxWidth: 340, margin: '0 auto' }}>
            Create one for a campaign below. The page works straight away — it shows your
            progress and story. Only the checkout waits on a payment provider.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 9, marginBottom: 16 }}>
        {links.map(link => {
          const campaign = campaigns.find(c => c.id === link.campaign_id)
          const disabled = link.status === 'disabled'
          return (
            <div key={link.id} style={{
              background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 14,
              padding: '14px 15px', opacity: disabled ? 0.6 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text, flex: 1, minWidth: 0 }}>
                  {campaign?.name || 'Campaign removed'}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: disabled ? '#F3F2F7' : (link.status === 'active' ? '#E7F8ED' : '#FEF6E7'),
                  color: disabled ? LS.muted : (link.status === 'active' ? LS.success : LS.warning),
                  flexShrink: 0,
                }}>
                  {disabled ? 'Disabled' : link.status === 'active' ? 'Live' : 'Payment setup required'}
                </span>
              </div>

              <div style={{
                fontSize: 12.5, color: LS.purpleDark, wordBreak: 'break-all',
                marginBottom: 11, fontFamily: 'ui-monospace, monospace',
              }}>{publicPayUrl(link.slug)}</div>

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <SmallBtn onClick={() => copy(link)}>
                  {copied === link.id ? 'Copied' : 'Copy link'}
                </SmallBtn>
                <SmallBtn onClick={() => window.open(publicPayUrl(link.slug), '_blank', 'noopener')}>
                  Preview
                </SmallBtn>
                {isAdmin && (
                  <SmallBtn onClick={() => toggleLink(link)}>
                    {disabled ? 'Enable' : 'Disable'}
                  </SmallBtn>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isAdmin && availableCampaigns.length > 0 && (
        <div style={{
          background: '#fff', border: `1px dashed ${LS.lavenderBorder}`,
          borderRadius: 14, padding: '15px 16px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: LS.muted, marginBottom: 10 }}>
            CREATE A LINK FOR
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {availableCampaigns.map(c => (
              <button
                key={c.id}
                disabled={creating}
                onClick={() => addLink(c)}
                style={{
                  padding: '8px 13px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                  border: `1px solid ${LS.lavenderBorder}`, background: LS.lavender,
                  color: LS.purpleDark, cursor: creating ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >+ {c.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SmallBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
      border: `1px solid ${LS.border}`, background: '#fff', color: LS.text,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  )
}
