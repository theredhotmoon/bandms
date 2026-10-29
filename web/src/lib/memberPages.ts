import { memberPageBlocker } from '@bandms/rider-core'
import type { SiteConfig } from './cms'
import type { BandMember } from '@/types/bandMember'

type Cfg = Pick<SiteConfig, 'modules' | 'module_config'>

/**
 * Whether this member gets a page at /{lang}/{about}/{slug}: the shared rule
 * from @bandms/rider-core (which the admin's QR code also follows), fed this
 * build's site config, plus a slug to build it at. The page builder and the
 * About grid both ask this, so a card never links to a page that was not built.
 */
export function hasMemberPage(cfg: Cfg, member: Pick<BandMember, 'slug' | 'public_page'>): boolean {
  const about = { enabled: cfg.modules.about, visibility: cfg.module_config?.about?.visibility }
  // A member with no slug (an API predating it) gets no page rather than an
  // /about/undefined one.
  return memberPageBlocker(about, member) === null && !!member.slug
}
