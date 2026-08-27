import { getSiteConfig } from './cms'
import type { Locale } from '@/types/shared'

/**
 * Which theme the site renders under.
 *
 * Resolution order is CMS → env → base. The API field does not exist yet, so
 * today this is effectively the env var; it is read first so that turning on
 * CMS-driven theming later needs no change here.
 *
 * Falls back to `base`, never to a specific band. A missing or misspelt theme
 * must yield the plain black-and-white site rather than a broken one — the
 * unstyled page is legible, a half-applied theme is not.
 */
export async function getTheme(lang: Locale = 'en'): Promise<string> {
  const config = await getSiteConfig(lang)

  return config.theme || import.meta.env.PUBLIC_THEME || 'base'
}

/**
 * Webfonts the active theme needs, emitted as a <link> by BaseLayout.
 *
 * Kept here rather than in the theme's CSS because an @import inside a
 * stylesheet blocks rendering until the font CSS resolves, and because the base
 * theme must not pay for a network request it has no use for.
 */
export const THEME_FONTS: Record<string, string> = {
  'skanking-storks':
    'https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700;800;900&display=swap',
}
