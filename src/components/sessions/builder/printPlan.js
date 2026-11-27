import { equipmentList, kindOf, outcomesCovered, withTimes } from '../../../lib/sessionPlan'
import { areaByKey } from '../../impact/impact_shared'

// A one-page session plan to print or save as PDF: the running order with
// times, who leads what, safety points, and a tick-list of what to bring.
// Opens in a new window like the Registers print-out does.

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function planDocument({ org, session, blocks, names = {} }) {
  const timed = withTimes(blocks.map(b => ({ ...b, minutes: Number(b.minutes) || 0 })), session.start_time)
  const kit = equipmentList(blocks)
  const outcomes = outcomesCovered(blocks)
  const date = session.session_date
    ? new Date(`${session.session_date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const rows = timed.map(b => `
    <tr>
      <td class="t"><b>${esc(b.start || '')}</b><br><span>${b.minutes} min</span></td>
      <td>
        <div class="k">${esc(kindOf(b.kind).label)}</div>
        <div class="n">${esc(b.title || kindOf(b.kind).label)}</div>
        ${b.details ? `<div class="d">${esc(b.details).replace(/\n/g, '<br>')}</div>` : ''}
        ${b.easier || b.harder ? `<div class="d">${b.easier ? `<b>Easier:</b> ${esc(b.easier)} ` : ''}${b.harder ? `<b>Harder:</b> ${esc(b.harder)}` : ''}</div>` : ''}
        ${b.safety ? `<div class="s">Safety: ${esc(b.safety)}</div>` : ''}
      </td>
      <td>${esc([b.lead_id && names[b.lead_id], b.area, (b.groups || []).join(', ')].filter(Boolean).join(' · '))}</td>
      <td>${esc((b.equipment || []).join(', '))}</td>
    </tr>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(session.title)} plan</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111827; margin: 28px; font-size: 13px; }
    h1 { margin: 0 0 4px; font-size: 22px; } .meta { color: #4B5563; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6B7280; border-bottom: 2px solid #111827; padding: 6px 8px; }
    td { vertical-align: top; border-bottom: 1px solid #E5E7EB; padding: 8px; } td.t { width: 64px; white-space: nowrap; } td.t span { color: #6B7280; font-size: 11px; }
    .k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #6B7280; } .n { font-weight: 700; font-size: 14px; }
    .d { margin-top: 4px; color: #374151; line-height: 1.45; } .s { margin-top: 4px; color: #92400E; font-weight: 600; }
    .cols { display: flex; gap: 28px; margin-top: 18px; } .cols > div { flex: 1; } h2 { font-size: 14px; margin: 0 0 6px; }
    ul { margin: 0; padding-left: 18px; } li { margin: 3px 0; } .box { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #111827; margin-right: 6px; vertical-align: -1px; }
    .kit { list-style: none; padding: 0; } footer { margin-top: 22px; color: #9CA3AF; font-size: 11px; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
  <h1>${esc(session.title)}</h1>
  <div class="meta">${esc([org?.name, date, session.start_time && `${session.start_time.slice(0, 5)}${session.end_time ? `–${session.end_time.slice(0, 5)}` : ''}`, session.location].filter(Boolean).join(' · '))}</div>
  <table><thead><tr><th>Time</th><th>Activity</th><th>Who and where</th><th>Equipment</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="cols">
    ${kit.length ? `<div><h2>What to bring</h2><ul class="kit">${kit.map(k => `<li><span class="box"></span>${esc(k.item)}</li>`).join('')}</ul></div>` : ''}
    ${outcomes.length ? `<div><h2>Outcomes this works on</h2><ul>${outcomes.map(o => `<li>${esc(areaByKey(o.key).label)} (${o.minutes} min)</li>`).join('')}</ul></div>` : ''}
  </div>
  <footer>Planned with LaunchSession</footer>
  </body></html>`
}

export function printPlan(args) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(planDocument(args))
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
  return true
}
