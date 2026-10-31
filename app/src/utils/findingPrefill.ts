import type { AuthorPayload } from '@/types/author'
import type { BandKind, BandPayload } from '@/types/band'
import type { Finding, LeadType } from '@/types/assistantCrawler'
import type { VenuePayload } from '@/types/venue'

export type SaveTarget =
  | { type: 'venue' }
  | { type: 'band'; kind: BandKind }
  | { type: 'author' }

/** The lead's name: its title up to the first separator ("SO36, Berlin" → "SO36"). */
export function leadName(title: string): string {
  return title.split(/\s*(?:,|—|–| - |\||:)\s*/u)[0]?.trim() || title.trim()
}

/** Which table a lead goes in by default; the menu still offers the others. */
export function defaultSaveTarget(type: LeadType | null): SaveTarget {
  switch (type) {
    case 'band':
    case 'promoter':
    case 'festival':
      return { type: 'band', kind: type }
    case 'media':
    case 'profile':
      return { type: 'author' }
    default:
      return { type: 'venue' }
  }
}

const httpUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\//i.test(u) ? u : null)

/**
 * What the create form opens with. Only what the finding itself says: its
 * name, country, a website (the one triage read off the page first, else a
 * Places result's own link), and for a contact the email and profiles triage
 * found.
 * Everything else the admin types.
 */
export function prefillFor(f: Finding, target: SaveTarget): Partial<VenuePayload> | Partial<BandPayload> | Partial<AuthorPayload> {
  const name = leadName(f.title)
  // The finding's own link is the place's website only for a Places result
  // (its websiteUri) — not a Maps page, and never a search hit, which is
  // usually an article *about* the place.
  const ownSite = f.source === 'places' && !/google\.[a-z.]+\/maps/i.test(f.url) ? httpUrl(f.url) : null
  const website = httpUrl(f.contacts?.website) ?? ownSite

  if (target.type === 'venue') return { name, country: f.country, website }
  if (target.type === 'band') return { name, kind: target.kind, country: f.country, website }

  const social_links = (['instagram', 'facebook', 'website'] as const).flatMap(platform => {
    const url = httpUrl(f.contacts?.[platform])
    return url ? [{ platform, url }] : []
  })
  return { first_name: name, email: f.contacts?.email ?? null, country: f.country, social_links }
}
