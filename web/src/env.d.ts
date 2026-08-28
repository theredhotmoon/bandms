/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly API_BASE: string
  readonly API_PROXY: string
  readonly SITE_URL: string
  /** CARTO basemap key — see src/lib/basemap.ts. Absent in dev unless set. */
  readonly PUBLIC_CARTO_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
