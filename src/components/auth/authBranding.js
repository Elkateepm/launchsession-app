import { brandPalette, contrastRatio, darken, hexToRgb, lighten, rgba } from '../../lib/brandColors'
import { fontByKey } from '../../lib/brandTheme'

// This public allowlist uses the existing safe view, which already exposes
// these fields before login. Never select contact, billing or internal data.
export const AUTH_DIRECTORY_COLUMNS = 'id,name,slug,branding_enabled,logo_url,icon_url,primary_color,secondary_color,accent_color,slogan,brand_font,login_background_url,login_background_style'

// Entitlement comes from the server-protected organisation flag. Saved assets,
// a plan name or a missing flag must never opt an organisation into branding.
export const hasAuthBranding = org => org?.branding_enabled === true

export function getAuthBranding(org) {
  const enabled = hasAuthBranding(org)
  const primary = enabled && hexToRgb(org.primary_color) ? org.primary_color : '#3B82F6'
  const secondary = enabled && hexToRgb(org.secondary_color) ? org.secondary_color : enabled ? primary : '#6366F1'
  const accent = enabled && hexToRgb(org.accent_color) ? org.accent_color : secondary
  const palette = brandPalette(primary, true)
  const secondaryPalette = brandPalette(secondary, true)
  const accentPalette = brandPalette(accent, true)
  const font = fontByKey(enabled ? org.brand_font : 'default')
  const onPrimary = contrastRatio(primary, '#ffffff') >= 4.5 ? '#ffffff' : '#000000'
  return {
    enabled, primary, secondary, accent, onPrimary, font,
    name: enabled ? org.name || 'Your organisation' : 'LaunchSession',
    logo: enabled ? org.logo_url || null : '/logo.png',
    icon: enabled ? org.icon_url || org.logo_url || null : '/logo.png',
    slogan: enabled ? org.slogan || '' : '',
    background: enabled && org.login_background_style !== 'tint' ? org.login_background_url || null : null,
    backgroundOpacity: org?.login_background_style === 'muted' ? 0.22 : 0.42,
    navy: enabled ? darken(primary, 0.94) : '#06091A',
    surface: enabled ? darken(primary, 0.87) : '#0B0F27',
    wash: enabled ? darken(primary, 0.78) : '#111630',
    ink: enabled ? palette.ink : '#60A5FA',
    secondaryInk: enabled ? secondaryPalette.ink : '#A78BFA',
    accentInk: enabled ? accentPalette.ink : '#34D399',
    link: enabled ? lighten(palette.ink, 0.45) : '#BFDBFE',
    highlight: rgba(primary, 0.14),
    button: enabled ? primary : 'linear-gradient(rgba(6,9,26,.16), rgba(6,9,26,.16)), linear-gradient(135deg, #3B82F6, #6366F1)',
    buttonText: enabled ? onPrimary : '#ffffff',
    textGradient: enabled
      ? `linear-gradient(135deg, ${lighten(palette.ink, .3)}, ${lighten(secondaryPalette.ink, .3)}, ${lighten(accentPalette.ink, .3)})`
      : 'linear-gradient(135deg, #60A5FA 0%, #A78BFA 50%, #34D399 100%)',
  }
}
