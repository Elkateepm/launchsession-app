import { supabase } from './supabase'
import { getAuthBranding } from '../components/auth/authBranding'

export function resetPasswordUrl(org, portal) {
  // Native WebViews have capacitor:// origins; email links must open the web app.
  const origin = /^https?:$/.test(window.location.protocol) ? window.location.origin : 'https://app.launchsession.co.uk'
  const url = new URL('/reset-password', origin)
  if (org?.slug) url.searchParams.set('org', org.slug)
  if (portal === 'volunteer') url.searchParams.set('portal', portal)
  return url.href
}

export async function requestPasswordReset(email, org, portal) {
  const brand = getAuthBranding(org)
  const { data, error } = await supabase.functions.invoke('send-password-reset-email', {
    body: {
      email: email.trim(), org_name: org?.name || 'LaunchSession', org_slug: org?.slug,
      org_logo: brand.enabled ? brand.logo : new URL('/logo.png', resetPasswordUrl(org)).href,
      org_color: brand.primary, redirect_to: resetPasswordUrl(org, portal),
    },
  })
  // Older function versions returned HTTP 200 even when Resend rejected mail.
  if (error || data?.error || data?.success === false || data?.data?.error || data?.data?.statusCode >= 400) {
    throw new Error('We could not send the reset link. Please try again.')
  }
}

export function readRecoveryLink(href) {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const read = key => hash.get(key) || url.searchParams.get(key)
  const org = url.searchParams.get('org') || ''
  const portal = url.searchParams.get('portal') === 'volunteer' ? 'volunteer' : ''
  const context = { org, portal }
  if (read('error') || read('error_code') || read('error_description') || read('type') !== 'recovery') return { ...context, kind: 'invalid' }
  if (read('token_hash')) return { ...context, kind: 'token', token_hash: read('token_hash') }
  if (hash.get('access_token') && hash.get('refresh_token')) return { ...context, kind: 'session', access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') }
  return { ...context, kind: 'invalid' }
}

export function recoverySignInUrl({ org, portal }) {
  if (!org) return '/org-search'
  return portal === 'volunteer' ? '/volunteer/' + encodeURIComponent(org) : '/login?org=' + encodeURIComponent(org)
}
