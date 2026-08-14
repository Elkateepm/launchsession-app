import { supabase } from '../../../lib/supabase'

// Supporter records are created as a side effect of recording donations rather
// than through a separate "add supporter" flow. Nobody sits down to build a
// donor database; they record a gift, and the supporter falls out of it.

export function supporterName(s) {
  if (!s) return 'Anonymous'
  if (s.anonymous) return 'Anonymous'
  const full = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
  return full || s.email || 'Unnamed supporter'
}

export function splitName(input) {
  const parts = String(input || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

export async function listSupporters(orgId, { search } = {}) {
  let q = supabase
    .from('fundraising_supporters')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (search) {
    const term = `%${search}%`
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
  }
  const { data, error } = await q.limit(200)
  if (error) return []
  return data || []
}

/**
 * Turn whatever the donation form collected into a supporter id.
 *
 * Returns { supporterId, anonymous }. An anonymous gift gets no supporter row
 * at all -- creating a string of "Anonymous" records would make the supporter
 * list useless and imply we know more about the donor than we do.
 */
export async function resolveSupporter({ orgId, mode, supporterId, name, email, phone, giftAid }) {
  if (mode === 'anonymous') return { supporterId: null, anonymous: true }

  if (mode === 'existing' && !supporterId) {
    // Falling through to the create path here inserted a supporter with no
    // name and no email. Better to fail the donation than litter the list.
    return { supporterId: null, anonymous: false, error: 'no_supporter_selected' }
  }

  if (mode === 'existing') {
    // Gift Aid status can be established at the point of a later donation, so
    // promote it -- but never downgrade a held declaration from a form where
    // the box simply wasn't ticked.
    if (giftAid) {
      await supabase
        .from('fundraising_supporters')
        .update({ gift_aid_status: 'declaration_held', updated_at: new Date().toISOString() })
        .eq('id', supporterId)
        .eq('org_id', orgId)
        .neq('gift_aid_status', 'declaration_held')
    }
    return { supporterId, anonymous: false }
  }

  const cleanEmail = (email || '').trim().toLowerCase() || null

  // Match on email before inserting. Two gifts from the same person recorded a
  // month apart should land on one supporter, not two -- otherwise total
  // donated and repeat-supporter counts are both wrong.
  if (cleanEmail) {
    const { data: existing } = await supabase
      .from('fundraising_supporters')
      .select('id, gift_aid_status')
      .eq('org_id', orgId)
      .ilike('email', cleanEmail)
      .maybeSingle()

    if (existing) {
      if (giftAid && existing.gift_aid_status !== 'declaration_held') {
        await supabase
          .from('fundraising_supporters')
          .update({ gift_aid_status: 'declaration_held', updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      }
      return { supporterId: existing.id, anonymous: false }
    }
  }

  const { first_name, last_name } = splitName(name)
  const { data, error } = await supabase
    .from('fundraising_supporters')
    .insert({
      org_id: orgId,
      first_name,
      last_name,
      email: cleanEmail,
      phone: (phone || '').trim() || null,
      gift_aid_status: giftAid ? 'declaration_held' : 'unknown',
    })
    .select('id')
    .single()

  // A supporter we couldn't save must not block the donation. The money is the
  // record that matters; the donation keeps donor_name as a fallback so the
  // ledger still reads correctly.
  if (error) return { supporterId: null, anonymous: false }
  return { supporterId: data.id, anonymous: false }
}

/**
 * Aggregate a supporter's giving. Derived from the ledger on read rather than
 * kept as running totals on the supporter row -- a stored total is one refund
 * or deleted donation away from being a lie.
 */
export function summariseSupporters(supporters, donations) {
  const byId = new Map()
  supporters.forEach(s => byId.set(s.id, {
    ...s,
    total: 0,
    count: 0,
    first: null,
    last: null,
    campaigns: new Set(),
  }))

  donations.forEach(d => {
    if (!d.supporter_id) return
    const rec = byId.get(d.supporter_id)
    if (!rec) return

    // A failed or cancelled attempt is not support. Counting it toward dates or
    // campaign membership would show someone as a recent supporter of a
    // campaign they never actually funded.
    const counted = d.status === 'paid' || d.status === 'recorded' || d.status === 'partially_refunded'
    if (!counted) return

    rec.total += Number(d.amount || 0) - Number(d.refunded_amount || 0)
    rec.count += 1

    const date = d.donation_date || d.created_at
    if (date) {
      if (!rec.first || date < rec.first) rec.first = date
      if (!rec.last || date > rec.last) rec.last = date
    }
    if (d.campaign_id) rec.campaigns.add(d.campaign_id)
  })

  return [...byId.values()].map(r => ({ ...r, campaigns: [...r.campaigns] }))
}
