import type { PostBlockType, EmbedProviderName, PostBlockDraft } from '@/types/post'

/**
 * Lives in utils/, not a composable, so vitest can import it: the admin's test
 * environment is `node`, and any composable that reaches useAuth dies reading
 * localStorage at module load.
 */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return [...list]
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]

  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function defaultPayload(type: PostBlockType): PostBlockDraft['payload'] {
  switch (type) {
    case 'text':  return { body: { en: '', pl: '' } }
    case 'image': return { path: '', alt: { en: '', pl: '' }, caption: { en: '', pl: '' } }
    case 'embed': return { url: '', label: { en: '', pl: '' } }
    case 'ref':   return { entity: 'concert', id: 0 }
  }
}

/**
 * Brand names, which are the same in every language — except `link`, which is
 * an ordinary word describing a plain URL. It is not in this table for that
 * reason: the caller passes the translated string in.
 */
/*
 * `Exclude<…, 'link'>`, not `Partial<…>`.
 *
 * Partial makes adding a provider to the union compile clean and render "Link"
 * in the badge — no type error, no failing test. CLAUDE.md names Bandcamp as a
 * pending EmbedProvider::HOSTS addition, so that path is live. Excluding the one
 * member that genuinely has no brand keeps the rest exhaustive: a new provider
 * is a compile error here until someone supplies its name.
 */
const PROVIDER_LABELS: Record<Exclude<EmbedProviderName, 'link'>, string> = {
  // One entry per line on purpose: `i18n-ignore` exempts a whole line, so five
  // labels sharing one would let `bandcamp: 'Listen on Bandcamp'` in unseen.
  youtube: 'YouTube', // i18n-ignore: brand name
  vimeo: 'Vimeo', // i18n-ignore: brand name
  instagram: 'Instagram', // i18n-ignore: brand name
  tiktok: 'TikTok', // i18n-ignore: brand name
  facebook: 'Facebook', // i18n-ignore: brand name
  spotify: 'Spotify', // i18n-ignore: brand name
  soundcloud: 'SoundCloud', // i18n-ignore: brand name
  apple_music: 'Apple Music', // i18n-ignore: brand name
}

/** `genericLabel` is what an unrecognised host (or a bare link) reads as. */
export function providerLabel(p: EmbedProviderName, genericLabel: string): string {
  // Both halves are load-bearing. The `Exclude` above makes a *new union
  // member* a compile error, but `p` is not always locally derived —
  // ClipsAdminView and AttachedClipsField pass `clip.provider`, an unvalidated
  // cast of an API string. A backend-only addition (Bandcamp joining
  // EmbedProvider::HOSTS) produces no compile error at all, and without the
  // fallback the badge renders the literal "undefined" where it read "Link".
  return p === 'link' ? genericLabel : (PROVIDER_LABELS[p] ?? genericLabel)
}

/** Must mirror EmbedProvider::AUDIO. Audio players are fixed-height frames. */
const AUDIO_PROVIDERS: ReadonlySet<EmbedProviderName> = new Set(['spotify', 'soundcloud', 'apple_music'])

export function isAudioProvider(p: EmbedProviderName): boolean {
  return AUDIO_PROVIDERS.has(p)
}

/** Host suffix => provider. Must mirror api/app/Support/EmbedProvider.php's HOSTS exactly. */
const PROVIDER_HOSTS: Record<string, EmbedProviderName> = {
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'vimeo.com': 'vimeo',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'facebook.com': 'facebook',
  'fb.watch': 'facebook',
  'open.spotify.com': 'spotify',
  'soundcloud.com': 'soundcloud',
  'music.apple.com': 'apple_music',
}

/**
 * Preview only — the server re-detects and stores the provider on save, this
 * never gets sent. Matches by parsed hostname (suffix match, exact or after a
 * leading "."), the same as EmbedProvider::detect() on the backend.
 *
 * A naive substring check (does the whole URL string contain "youtube.com"?)
 * disagrees with that: a URL like https://example.com/?ref=youtube.com has
 * 'youtube.com' as a substring while example.com is the actual host, so a
 * whole-string match would badge it YouTube while the server correctly
 * stores 'link' — silently hiding the label field the admin needed.
 */
export function detectProvider(url: string): EmbedProviderName {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'link'
  }
  if (!host) return 'link'

  for (const [suffix, provider] of Object.entries(PROVIDER_HOSTS)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return provider
  }
  return 'link'
}
