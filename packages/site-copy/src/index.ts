/**
 * @bandms/site-copy — every editable string on the public site.
 *
 * The public site (`web/`) reads the defaults and the band's overrides
 * through `resolveCopy()`; the admin (`app/`) renders a form from the same
 * field lists, showing each default as the placeholder. Adding a string to a
 * page is one entry in the module's file: the section reads `t.<key>` and the
 * admin gains the input, with no migration — `website_modules.settings` is a
 * free-form bag validated by shape only.
 *
 * Keyed by `website_modules.slug`. A module absent from MODULE_COPY has no
 * copy fields, which is why adding one is additive and safe.
 */
import type { CopyField } from './types'
import { ABOUT_COPY } from './modules/about'
import { CONCERTS_COPY } from './modules/concerts'
import { CONTACT_COPY } from './modules/contact'
import { EPK_COPY } from './modules/epk'
import { FOOTER_COPY } from './modules/footer'
import { HOME_COPY } from './modules/home'
import { MERCH_COPY } from './modules/merch'
import { NEWSLETTER_COPY } from './modules/newsletter'
import { PHOTOS_COPY } from './modules/photos'
import { POSTS_COPY } from './modules/posts'
import { PRESS_COPY } from './modules/press'
import { PRIVACY_COPY } from './modules/privacy'
import { RELEASES_COPY } from './modules/releases'
import { SITE_COPY } from './modules/site'
import { TECH_RIDER_COPY } from './modules/techRider'
import { VIDEOS_COPY } from './modules/videos'

export type { CopyField, CopyKeys, ResolvedCopy } from './types'
export { defineCopy, resolveCopy, defaultFor, fillCopy } from './resolve'

export {
  ABOUT_COPY,
  CONCERTS_COPY,
  CONTACT_COPY,
  EPK_COPY,
  FOOTER_COPY,
  HOME_COPY,
  MERCH_COPY,
  NEWSLETTER_COPY,
  PHOTOS_COPY,
  POSTS_COPY,
  PRESS_COPY,
  PRIVACY_COPY,
  RELEASES_COPY,
  SITE_COPY,
  TECH_RIDER_COPY,
  VIDEOS_COPY,
}

export const MODULE_COPY: Readonly<Record<string, readonly CopyField[]>> = {
  about: ABOUT_COPY,
  concerts: CONCERTS_COPY,
  contact: CONTACT_COPY,
  epk: EPK_COPY,
  footer: FOOTER_COPY,
  home: HOME_COPY,
  merch: MERCH_COPY,
  newsletter: NEWSLETTER_COPY,
  photos: PHOTOS_COPY,
  posts: POSTS_COPY,
  press: PRESS_COPY,
  privacy: PRIVACY_COPY,
  releases: RELEASES_COPY,
  site: SITE_COPY,
  'tech-rider': TECH_RIDER_COPY,
  videos: VIDEOS_COPY,
}

/** The field list for a module slug; empty for a module with no copy. */
export function copyFieldsFor(slug: string): readonly CopyField[] {
  return MODULE_COPY[slug] ?? []
}

/**
 * Field groups in first-appearance order, for the admin's fieldsets. The
 * registry lists fields in page order, so the groups come out in page order
 * too — the editor scrolls the form the way a visitor scrolls the page.
 */
export function copyGroupsFor(slug: string): { group: string; fields: CopyField[] }[] {
  const groups = new Map<string, CopyField[]>()
  for (const field of copyFieldsFor(slug)) {
    const list = groups.get(field.group)
    if (list) list.push(field)
    else groups.set(field.group, [field])
  }
  return [...groups].map(([group, fields]) => ({ group, fields }))
}
