import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Public, unauthenticated donation page at /pay/:slug.
//
// All data comes from the get_public_donation_page RPC, which returns only the
// handful of fields rendered below. There is deliberately no anon policy on
// fundraising_campaigns -- see the migration for why.
//
// Checkout is not wired up. Rather than showing a dead button, the payment
// section states plainly that online giving isn't available yet and offers the
// route that does work: contacting the organisation.

const PURPLE = '#7C5CFC'
const TEXT = '#1C1B2E'
const MUTED = '#8B87A3'
const BORDER = '#ECE9F5'

const money = n => `£${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

export default function PublicDonationPage() {
  const [page, setPage] = useState(null)
  const [status, setStatus] = useState('loading')   // loading | ok | missing | error
  const [amount, setAmount] = useState(null)
  const [custom, setCustom] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [giftAid, setGiftAid] = useState(false)

  useEffect(() => {
    const slug = window.location.pathname.replace(/^\/pay\//, '').replace(/\/$/, '')
    if (!slug) { setStatus('missing'); return }

    supabase.rpc('get_public_donation_page', { p_slug: slug }).then(({ data, error }) => {
      if (error) { setStatus('error'); return }
      if (!data || !data.length) { setStatus('missing'); return }
      setPage(data[0])
      setStatus('ok')
    })
  }, [])

  if (status === 'loading') {
    return <Centered><div style={{ color: MUTED, fontSize: 15 }}>Loading…</div></Centered>
  }

  if (status === 'missing' || status === 'error') {
    return (
      <Centered>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: TEXT, marginBottom: 8 }}>
            This page isn't available
          </div>
          <div style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.55 }}>
            The link may have expired, or the campaign may have finished. If someone shared
            it with you, ask them for an up-to-date link.
          </div>
        </div>
      </Centered>
    )
  }

  const brand = page.org_primary_color || PURPLE
  const raised = Number(page.raised || 0)
  const target = Number(page.target_amount || 0)
  const pct = target > 0 ? Math.min((raised / target) * 100, 100) : null
  const amounts = (page.suggested_amounts || [10, 25, 50, 100]).map(Number)

  return (
    <div style={{ minHeight: '100dvh', background: '#FAF9FE', padding: '0 0 48px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 18px 0' }}>

        {/* org */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
          {page.org_logo_url
            ? <img src={page.org_logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 11, objectFit: 'contain', background: '#fff', padding: 4, boxSizing: 'border-box' }} />
            : <div style={{
                width: 40, height: 40, borderRadius: 11, background: brand,
                display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 16,
              }}>{(page.org_name || '?').slice(0, 1)}</div>}
          <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT }}>{page.org_name}</div>
        </div>

        {page.campaign_image_url && (
          <img
            src={page.campaign_image_url}
            alt=""
            style={{ width: '100%', borderRadius: 16, marginBottom: 20, display: 'block' }}
          />
        )}

        <h1 style={{ fontSize: 27, fontWeight: 800, color: TEXT, lineHeight: 1.25, margin: '0 0 12px' }}>
          {page.campaign_name}
        </h1>

        {page.campaign_description && (
          <p style={{ fontSize: 15.5, color: MUTED, lineHeight: 1.6, margin: '0 0 22px' }}>
            {page.campaign_description}
          </p>
        )}

        {/* progress */}
        <div style={{
          background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16,
          padding: '18px 18px 16px', marginBottom: 22,
        }}>
          <div style={{ fontSize: 25, fontWeight: 800, color: TEXT, marginBottom: 3 }}>
            {money(raised)}
            {target > 0 && (
              <span style={{ fontSize: 15, fontWeight: 600, color: MUTED }}> raised of {money(target)}</span>
            )}
          </div>
          {pct !== null && (
            <>
              <div style={{ height: 9, background: '#F1EDFF', borderRadius: 9, overflow: 'hidden', margin: '12px 0 8px' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: brand, borderRadius: 9 }} />
              </div>
              <div style={{ fontSize: 12.5, color: MUTED }}>{Math.round(pct)}% of the way there</div>
            </>
          )}
        </div>

        {/* amounts */}
        <SectionTitle>Choose an amount</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 9, marginBottom: 10 }}>
          {amounts.map(a => (
            <button
              key={a}
              onClick={() => { setAmount(a); setCustom('') }}
              style={{
                padding: '14px 6px', borderRadius: 12, fontSize: 16, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${amount === a ? brand : BORDER}`,
                background: amount === a ? brand : '#fff',
                color: amount === a ? '#fff' : TEXT,
              }}
            >£{a}</button>
          ))}
        </div>

        {page.allow_custom_amount && (
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 17, fontWeight: 700, color: MUTED, pointerEvents: 'none',
            }}>£</span>
            <input
              value={custom}
              onChange={e => { setCustom(e.target.value); setAmount(null) }}
              placeholder="Other amount"
              inputMode="decimal"
              style={{
                width: '100%', padding: '14px 14px 14px 32px', borderRadius: 12, fontSize: 16,
                border: `1.5px solid ${custom ? brand : BORDER}`, background: '#fff',
                color: TEXT, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {/* details */}
        <SectionTitle>Your details</SectionTitle>
        <div style={{ display: 'grid', gap: 9, marginBottom: 12 }}>
          <Input value={name} onChange={setName} placeholder="Your name" disabled={anonymous} />
          <Input value={email} onChange={setEmail} placeholder="Email" type="email" />
        </div>

        <Check checked={anonymous} onToggle={() => setAnonymous(v => !v)} brand={brand}>
          Make my donation anonymous
        </Check>

        <div style={{ height: 10 }} />

        <Check
          checked={giftAid}
          onToggle={() => setGiftAid(v => !v)}
          brand={brand}
          disabled={anonymous}
        >
          I would like {page.org_name} to claim Gift Aid on my donation
        </Check>

        {giftAid && !anonymous && (
          <p style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55, margin: '10px 2px 0' }}>
            I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains
            Tax than the amount of Gift Aid claimed on all my donations in that tax year, it is my
            responsibility to pay any difference.
          </p>
        )}

        {/* payment */}
        <div style={{ marginTop: 26 }}>
          <SectionTitle>Payment</SectionTitle>
          <div style={{
            background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16,
            padding: '20px 18px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: TEXT, marginBottom: 6 }}>
              Online donations aren't available yet
            </div>
            <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.55 }}>
              {page.org_name} is still setting up online payments. Please get in touch with
              them directly to donate — they'll be glad to hear from you.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 26, textAlign: 'center', fontSize: 11.5, color: MUTED }}>
          Powered by LaunchSession
        </div>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'grid', placeItems: 'center',
      background: '#FAF9FE', padding: 24,
    }}>{children}</div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 10 }}>{children}</div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
      style={{
        width: '100%', padding: '13px 14px', borderRadius: 12, fontSize: 15,
        border: `1px solid ${BORDER}`, background: disabled ? '#F7F6FB' : '#fff',
        color: TEXT, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
      }}
    />
  )
}

function Check({ checked, onToggle, children, brand, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left',
        padding: '13px 14px', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
        border: `1px solid ${checked ? brand : BORDER}`, background: '#fff',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
        display: 'grid', placeItems: 'center',
        border: `1.6px solid ${checked ? brand : BORDER}`,
        background: checked ? brand : '#fff',
        color: '#fff', fontSize: 13, fontWeight: 800, lineHeight: 1,
      }}>{checked ? '✓' : ''}</div>
      <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.45 }}>{children}</div>
    </button>
  )
}
