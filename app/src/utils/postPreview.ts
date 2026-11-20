/** A token as the API mints it (Str::random(40)); anything else gets no link. */
const TOKEN = /^[A-Za-z0-9]{20,48}$/

/**
 * Where the public build bakes a draft: /{lang}/post-preview/{token}/ on the
 * site's own origin (Caddy serves the admin and the site from one). Null for a
 * missing or malformed token — never a link built from unchecked input.
 * Mirrors previewPath() in web/src/lib/postPreview.ts.
 */
export function postPreviewUrl(lang: string, token: string | null | undefined): string | null {
  if (!token || !TOKEN.test(token) || !/^[a-z]{2}$/.test(lang)) return null
  return `/${lang}/post-preview/${token}/`
}

export type PreviewNote = 'saveFirst' | 'building' | 'pending' | null

/**
 * What the preview link should warn about, most pressing first. The preview
 * is a baked page, so it lags the editor in three ways: unsaved edits, a
 * build in progress, and saved changes no build has picked up yet (only
 * possible with auto-rebuild off — with it on, a save starts the build).
 */
export function previewNote(state: { dirty: boolean; building: boolean; postsPending: boolean }): PreviewNote {
  if (state.dirty) return 'saveFirst'
  if (state.building) return 'building'
  if (state.postsPending) return 'pending'
  return null
}
