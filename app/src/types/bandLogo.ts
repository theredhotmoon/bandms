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

// Human-readable labels for the enum values
export const LOGO_VARIANT_LABELS: Record<LogoVariant, string> = {
  full:       'Full logo',
  icon:       'Icon / Square',
  horizontal: 'Horizontal',
  stacked:    'Stacked',
  wordmark:   'Wordmark (text only)',
}

export const LOGO_BACKGROUND_LABELS: Record<LogoBackground, string> = {
  light:       'For light backgrounds',
  dark:        'For dark backgrounds',
  transparent: 'Transparent',
  any:         'Any / Universal',
}
