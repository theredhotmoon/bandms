// Allowed values matching the backend enums
export type LogoVariant = 'full' | 'icon' | 'horizontal' | 'stacked' | 'wordmark'
export type LogoBackground = 'light' | 'dark' | 'transparent' | 'any'

export interface BandLogo {
  id: number
  url: string                    // absolute path: /storage/logos/xxx.png
  original_name: string
  mime_type: string              // image/png | image/svg+xml | image/jpeg | image/webp
  file_size: number | null       // bytes
  width: number | null           // null for SVG
  height: number | null
  is_vector: boolean             // true when mime_type === image/svg+xml
  label: string | null
  variant: LogoVariant
  background: LogoBackground
  is_default: boolean
  is_deprecated: boolean
  version_label: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BandLogoPayload {
  label?: string | null
  variant?: LogoVariant
  background?: LogoBackground
  version_label?: string | null
  notes?: string | null
  is_deprecated?: boolean
  sort_order?: number
}

// Display order for the pickers. The order is data — it mirrors the backend
// enum — but the *labels* are copy and live in the i18n catalogue under
// band.logos.variants / .backgrounds.
//
// English labels here were invisible to every i18n guard:
// check-admin-strings only scans MIGRATED .vue paths, and check-i18n-coverage
// only flags files that call $t — which a types file never does.
// BandLogoManager rendered them verbatim in four selects and two chips.
export const LOGO_VARIANTS: readonly LogoVariant[] = ['full', 'icon', 'horizontal', 'stacked', 'wordmark']
export const LOGO_BACKGROUNDS: readonly LogoBackground[] = ['light', 'dark', 'transparent', 'any']
