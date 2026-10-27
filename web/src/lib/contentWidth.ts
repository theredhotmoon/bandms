import type { ContentWidth, SiteConfig } from './cms'

/**
 * The content width of a module's page, as set in /admin/website-modules.
 *
 * Fails open to 'full' — the design's default — for an unknown module, an
 * API predating the column, or a site config that could not be fetched, so a
 * build-time blip changes a page's measure rather than breaking it.
 */
export function contentWidthFor(config: Pick<SiteConfig, 'module_config'>, module: string | undefined): ContentWidth {
  if (!module) return 'full'
  return config.module_config?.[module]?.content_width === 'limited' ? 'limited' : 'full'
}
