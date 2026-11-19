/**
 * Shapes build-time data into the WelcomeScreen island's props. Build-only:
 * the island imports the types, never this function's dependencies' data.
 *
 * Kept apart from BaseLayout.astro because `tsc` does not check `.astro`
 * files and this is where the module gates and the "is there anything to
 * show at all" rule live.
 */
import type { Concert } from '@/types/concert'
import type { PostSummary } from '@/types/post'
import type { Locale } from '@/types/shared'
import type { SlugMap } from './slugs'
import { fmtDate, postSlug } from './i18n'
import { dropPastConcerts, type WelcomeBlock, type WelcomeConfig } from './welcome'

/** `date` is formatted for display; `isoDate` (YYYY-MM-DD) lets the island drop a show that has passed since the build. */
export interface WelcomeConcert { id: number; date: string; isoDate: string; city: string; venue: string; href: string }
export interface WelcomePost { title: string; date: string; image: string | null; href: string }

/** The island receives every upcoming show up to this when geo targeting is on. */
export const GEO_CONCERT_CAP = 50

export interface WelcomeData {
  concerts: WelcomeConcert[]
  post: WelcomePost | null
  available: Record<WelcomeBlock, boolean>
}

export function buildWelcomeData(input: {
  lang: Locale
  config: WelcomeConfig
  modules: Record<string, boolean | undefined>
  concerts: Concert[]
  latestPost: PostSummary | null
  slugMap: SlugMap
  /** Injected for tests; defaults to the current time. */
  now?: Date
}): WelcomeData {
  const { lang, config, modules, slugMap } = input
  const now = input.now ?? new Date()
  // `!== false`: a fail-open config has no module map and must not hide blocks.
  const concertsOn = modules.concerts !== false
  const postsOn = modules.posts !== false
  const newsletterOn = modules.newsletter !== false

  const concertsSection = slugMap[lang]?.concerts ?? 'concerts'
  const postsSection = slugMap[lang]?.posts ?? 'posts'
  const limit = config.geo.enabled ? GEO_CONCERT_CAP : config.concert_count

  const concerts: WelcomeConcert[] = concertsOn
    ? dropPastConcerts(input.concerts.map(c => ({ c, isoDate: c.date.slice(0, 10) })), now)
        .map(({ c }) => c)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, limit)
        .map(c => ({
          id: c.id,
          date: fmtDate(c.date, lang),
          isoDate: c.date.slice(0, 10),
          city: c.venue?.city ?? '',
          venue: c.venue?.name ?? '',
          href: `/${lang}/${concertsSection}/${c.slug}`,
        }))
    : []

  const latest = postsOn ? input.latestPost : null
  const post: WelcomePost | null = latest
    ? {
        title: latest.title,
        date: fmtDate(latest.published_at, lang),
        image: latest.image ?? null,
        href: `/${lang}/${postsSection}/${postSlug(latest, lang)}`,
      }
    : null

  return {
    concerts,
    post,
    available: {
      concerts: concertsOn && concerts.length > 0,
      news: post !== null,
      newsletter: newsletterOn,
      account: true,
    },
  }
}

/** Mount only when the band enabled the screen and some enabled block has something to show. */
export function shouldMountWelcome(
  moduleEnabled: boolean | undefined,
  config: WelcomeConfig | undefined,
  data: WelcomeData | null,
): boolean {
  if (moduleEnabled !== true || !config || !data) return false
  return config.blocks.some(b => data.available[b])
}
