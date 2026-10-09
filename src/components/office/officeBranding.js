import { getAuthBranding } from '../auth/authBranding'
import { brandPalette, darken, rgba } from '../../lib/brandColors'

export function getOfficeBranding(org, dark = false) {
  // Use the same protected entitlement and defaults as sign-in. Saved assets
  // alone must not restore paid branding after an organisation changes plan.
  const brand = getAuthBranding(org)
  const primary = brandPalette(brand.primary, dark)
  const secondary = brandPalette(brand.secondary, dark)
  return {
    ...brand,
    style: {
      '--office-primary': brand.primary,
      '--office-ink': primary.ink,
      '--office-tint': primary.tint,
      '--office-soft': primary.soft,
      '--office-border': primary.border,
      '--office-secondary-ink': secondary.ink,
      '--office-secondary-tint': secondary.tint,
      '--office-glow': rgba(brand.secondary, dark ? 0.14 : 0.08),
      '--office-deep': darken(brand.primary, 0.76),
      '--font': brand.font.body,
      '--font-display': brand.font.display,
      fontFamily: brand.font.body,
    },
  }
}
