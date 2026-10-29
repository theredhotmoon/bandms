import { memberPageBlocker as sharedBlocker } from '@bandms/rider-core'
import { DEFAULT_LOCALE } from '@/locales'
import type { WebsiteModule } from '@/types/website-module'

/**
 * The absolute URL of a member's public page, in the default locale — the one
 * the admin shows, copies and encodes in the printed QR code.
 *
 * The page is served by the public site at /{lang}/{about}/{memberSlug}, where
 * {about} is the About module's URL segment: its custom slug if the band set
 * one, else the module key (the same fallback the API applies). `origin` is
 * the admin's own, because Caddy serves the admin and the public site from one
 * host — in production that is the band's domain.
 */
export function memberPageUrl(
  origin: string,
  modules: readonly Pick<WebsiteModule, 'slug' | 'custom_slug'>[] | undefined,
  memberSlug: string | undefined,
): string | null {
  if (!memberSlug) return null
  const about = modules?.find((m) => m.slug === 'about')
  const segment = about?.custom_slug?.[DEFAULT_LOCALE] || 'about'
  return `${origin}/${DEFAULT_LOCALE}/${segment}/${memberSlug}`
}

/**
 * Why a member's page is not on the website, or null when it is: the shared
 * rule from @bandms/rider-core, the one the public build applies, fed the
 * About row from the admin's modules list. Unknown modules (not loaded, or not
 * readable for this role) count as on.
 */
export function memberPageBlocker(
  modules: readonly Pick<WebsiteModule, 'slug' | 'enabled' | 'visibility'>[] | undefined,
  member: { public_page?: boolean },
): 'band' | 'member' | null {
  return sharedBlocker(modules?.find((m) => m.slug === 'about'), member)
}
