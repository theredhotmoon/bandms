import { describe, expect, it } from 'vitest'
import { contentWidthFor } from './contentWidth'
import type { ModuleConfig } from './cms'

const cfg = (module_config: Record<string, Partial<ModuleConfig>>) =>
  ({ module_config }) as { module_config: Record<string, ModuleConfig> }

describe('contentWidthFor', () => {
  it('reads limited from the module row', () => {
    expect(contentWidthFor(cfg({ contact: { content_width: 'limited' } }), 'contact')).toBe('limited')
  })

  it('reads full from the module row', () => {
    expect(contentWidthFor(cfg({ contact: { content_width: 'full' } }), 'contact')).toBe('full')
  })

  it('fails open to full when the API predates the column', () => {
    expect(contentWidthFor(cfg({ contact: {} }), 'contact')).toBe('full')
  })

  it('fails open to full for an unknown module or an empty config', () => {
    expect(contentWidthFor(cfg({}), 'contact')).toBe('full')
    expect(contentWidthFor(cfg({ contact: { content_width: 'limited' } }), undefined)).toBe('full')
  })
})

/**
 * The wiring half. A page that forgets to pass `module` to BaseLayout renders
 * full width whatever the admin says — green build, no error — and E2E can
 * only see it for modules the dev database happens to have switched on. So
 * every BaseLayout call site is listed here: the module it must pass, or why
 * it passes none.
 */
describe('BaseLayout call sites', () => {
  const EXPECTED: Record<string, string | null> = {
    'components/sections/AboutSection.astro': 'about',
    'components/sections/ConcertsSection.astro': 'concerts',
    'components/sections/ContactSection.astro': 'contact',
    'components/sections/EpkSection.astro': 'epk',
    'components/sections/MerchSection.astro': 'merch',
    'components/sections/NewsletterSection.astro': 'newsletter',
    'components/sections/PhotosSection.astro': 'photos',
    'components/sections/PostsSection.astro': 'posts',
    'components/sections/PressSection.astro': 'press',
    'components/sections/ReleasesSection.astro': 'releases',
    'components/sections/VideosSection.astro': 'videos',
    // Detail pages follow their section.
    'components/detail/ConcertDetail.astro': 'concerts',
    'components/detail/MemberDetail.astro': 'about',
    'components/detail/MerchItemDetail.astro': 'merch',
    'components/detail/ReleaseDetail.astro': 'releases',
    'pages/[lang]/index.astro': 'home',
    // No switch: an article is a 760px reading column, and the rest are
    // narrow single-purpose pages or a printable document.
    'components/detail/PostDetail.astro': null,
    'pages/[lang]/404.astro': null,
    'pages/[lang]/privacy.astro': null,
    'pages/merch/cancel.astro': null,
    'pages/merch/success.astro': null,
    'pages/newsletter/confirm/index.astro': null,
    'pages/newsletter/unsubscribe/index.astro': null,
    'pages/rider/index.astro': null,
  }

  const files = import.meta.glob(['../components/**/*.astro', '../pages/**/*.astro'], {
    query: '?raw', import: 'default', eager: true,
  }) as Record<string, string>

  const callers = Object.entries(files)
    .filter(([, src]) => src.includes('<BaseLayout'))
    .map(([path, src]) => [path.replace(/^\.\.\//, ''), src] as const)

  it('lists every file that renders BaseLayout', () => {
    expect(callers.map(([p]) => p).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  for (const [file, module] of Object.entries(EXPECTED)) {
    it(`${file} passes ${module ? `module="${module}"` : 'no module'}`, () => {
      const src = callers.find(([p]) => p === file)?.[1] ?? ''
      const passed = src.match(/<BaseLayout[^>]*?\bmodule="([^"]+)"/s)?.[1] ?? null
      expect(passed).toBe(module)
    })
  }
})
