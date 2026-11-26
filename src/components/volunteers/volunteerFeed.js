// A broadcast as it reads in the Volunteer Feed. Messages are stored as sent:
// HTML with <br/>s, and with merge fields such as {{FirstName}} that each
// volunteer saw as their own name. Shown raw, the feed read
// "Hi {{FirstName}}, just a reminder…".
export function feedText(value) {
  if (!value) return ''
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\{\{\s*first\s*_?name\s*\}\}/gi, '[first name]')
    .replace(/\{\{\s*[^}]*\}\}/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
}
