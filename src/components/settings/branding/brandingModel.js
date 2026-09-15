import { fontByKey } from '../../../lib/brandTheme'
import { hexToRgb, contrastRatio } from '../../../lib/brandColors'

export const DEFAULTS = {
  name: '', slogan: '', primary_color: '#1B9AAA', secondary_color: '#0EA5E9', accent_color: '#F59E0B',
  brand_font: 'default', ui_density: 'rounded', login_background_style: 'cover',
  welcome_message: '', email_footer_text: '', email_sender_name: '',
  logo_url: '', icon_url: '', login_background_url: '', email_logo_url: '',
}
export const ASSETS = [
  { key: 'logo_url', label: 'Primary logo', note: 'Your workspace, sign-in screen and public forms.', suffix: 'logo', options: { trim: true, maxDim: 1024 } },
  { key: 'icon_url', label: 'App icon', note: 'Browser tabs and the saved home-screen shortcut. Falls back to your logo.', suffix: 'icon', options: { trim: true, maxDim: 512 } },
  { key: 'login_background_url', label: 'Sign-in photograph', note: 'A landscape image works best. A dark overlay keeps sign-in text readable.', suffix: 'login-bg', options: { maxDim: 2400, photo: true } },
  { key: 'email_logo_url', label: 'Email logo', note: 'A version that reads well on white. Falls back to your primary logo.', suffix: 'email-logo', options: { trim: true, maxDim: 600 } },
]
export const PRESETS = [
  { name: 'Coastal', note: 'Clear. Open. Welcoming.', colors: ['#176B75', '#73C6C5', '#EBB269'], font: 'plus-jakarta' },
  { name: 'Botanical', note: 'Grounded and reassuring.', colors: ['#315B46', '#A4B896', '#D6AD73'], font: 'lora' },
  { name: 'Studio', note: 'Bold with a softer side.', colors: ['#5947A8', '#B8A7D9', '#E3B091'], font: 'inter' },
  { name: 'Momentum', note: 'Bright and full of energy.', colors: ['#B9442E', '#ED9677', '#E3BB59'], font: 'poppins' },
]
export function draftFromOrg(org) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, org?.[key] ?? fallback]))
}
export function validateBrand(draft) {
  if (!draft.name.trim()) return 'Add your organisation name before publishing.'
  for (const key of ['primary_color', 'secondary_color', 'accent_color']) {
    if (!/^#[\da-f]{6}$/i.test(draft[key])) return 'Use a six-digit hex colour, for example #176B75.'
  }
  return ''
}
export function readableInk(color) {
  return contrastRatio(color, '#FFFFFF') >= contrastRatio(color, '#10131A') ? '#FFFFFF' : '#10131A'
}
export function brandText(draft) {
  const font = fontByKey(draft.brand_font)
  return [draft.name, draft.slogan, '', ...['primary_color', 'secondary_color', 'accent_color'].map(key => {
    const rgb = hexToRgb(draft[key])
    return `${key.replace('_color', '')}: ${draft[key]}${rgb ? ` · RGB ${rgb.r}, ${rgb.g}, ${rgb.b}` : ''}`
  }), '', `Typeface: ${font.label}`, `Body: ${font.body}`, `Headings: ${font.display}`, '',
  ...ASSETS.filter(a => /^https?:\/\//.test(draft[a.key])).map(a => `${a.label}: ${draft[a.key]}`)].join('\n')
}
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export function brandGuide(draft) {
  const font = fontByKey(draft.brand_font)
  const image = /^https?:\/\//.test(draft.logo_url) ? `<img alt="Organisation logo" src="${escape(draft.logo_url)}">` : ''
  const swatches = ['primary_color', 'secondary_color', 'accent_color'].map(key => {
    const color = hexToRgb(draft[key]) ? draft[key] : '#000000'
    const rgb = hexToRgb(color)
    return `<article><div class="swatch" style="background:${escape(color)}"></div><h3>${key.replace('_color', '')}</h3><p>${escape(color.toUpperCase())}<br>RGB ${rgb.r}, ${rgb.g}, ${rgb.b}</p></article>`
  }).join('')
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(draft.name)} — Brand guide</title><style>body{margin:0;background:#f6f5f1;color:#18231f;font:16px/1.6 system-ui,sans-serif}main{max-width:850px;margin:auto;padding:64px 28px}header{border-bottom:1px solid #d5d8d1;padding-bottom:38px}header img{width:110px;height:90px;object-fit:contain;background:white;padding:16px;border-radius:18px}h1{font-size:48px;line-height:1.1;letter-spacing:-2px;margin:24px 0 12px}h2{margin-top:42px}h3{text-transform:capitalize}small{letter-spacing:2px;text-transform:uppercase}section{display:flex;gap:18px;flex-wrap:wrap}article{flex:1;min-width:150px;background:white;border:1px solid #d5d8d1;border-radius:12px;overflow:hidden}article h3,article p{margin:14px 20px}.swatch{height:125px}a{color:#315B46;overflow-wrap:anywhere}pre{white-space:pre-wrap;font:inherit}footer{margin-top:48px;border-top:1px solid #d5d8d1;padding-top:20px;color:#58635b}@media print{body{background:white}main{padding:15px}.swatch{print-color-adjust:exact;-webkit-print-color-adjust:exact}article{break-inside:avoid}}@media(max-width:500px){h1{font-size:34px}main{padding:32px 20px}}</style><main><header>${image}<p><small>Brand guidelines · LaunchSession</small></p><h1>${escape(draft.name)}</h1><p>${escape(draft.slogan)}</p></header><h2>01 / Colour palette</h2><section>${swatches}</section><h2>02 / Typography</h2><h3>${escape(font.label)}</h3><p>Headings: ${escape(font.display)}<br>Body: ${escape(font.body)}</p><h2>03 / Brand assets</h2>${ASSETS.filter(a => /^https?:\/\//.test(draft[a.key])).map(a => `<p><a href="${escape(draft[a.key])}">${a.label}</a></p>`).join('') || '<p>No custom assets uploaded.</p>'}<h2>04 / Consistency</h2><p>Keep clear space around your logo. Use your primary colour for key actions, your secondary colour for supporting areas, and your accent sparingly. Check the logo on both light and dark backgrounds before use.</p><footer>Published brand guide. Asset links need an internet connection. Open this file in a browser to print or save as PDF.</footer></main></html>`
}
export function downloadGuide(draft) {
  const url = URL.createObjectURL(new Blob([brandGuide(draft)], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organisation'}-brand-guide.html`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
