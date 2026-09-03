/**
 * Where the admin panel lives.
 *
 * The whole admin surface sits behind one configurable path segment so a band
 * can move it off the guessable /admin. `VITE_ADMIN_PATH` is baked in at image
 * build time — the same deal as VITE_CARTO_KEY — so changing it needs
 * `docker compose build frontend`, not just a restart.
 *
 * Three consumers have to agree on this value or the panel becomes
 * unreachable: this module, the `@spa` matcher in docker/caddy/Caddyfile, and
 * the ADMIN_PATH env in both compose files. Caddy resolves its own default with
 * `{$ADMIN_PATH:admin}`, which is why an unset variable is correct everywhere
 * rather than merely tolerated.
 *
 * This is obscurity, not access control. It cuts automated scanning of /login;
 * the auth guard in the router and the rate limit on /api/auth/login are what
 * actually stop anyone getting in.
 */

/**
 * Reduce a configured value to one clean path segment.
 *
 * Kept separate from the env read so it can be tested against the shapes people
 * actually type — a leading slash, a trailing slash, both, or nothing at all.
 * An empty or all-slash value falls back to 'admin' rather than producing '/',
 * which would put the admin panel at the site root and shadow every public page.
 */
export function normaliseAdminPath(raw: string | undefined | null): string {
  return (raw ?? '').replace(/^\/+|\/+$/g, '').trim() || 'admin'
}

export const ADMIN_PATH = normaliseAdminPath(
  import.meta.env.VITE_ADMIN_PATH as string | undefined,
)

/** `adminUrl()` → "/admin"; `adminUrl('concerts')` → "/admin/concerts". */
export function adminUrl(sub = ''): string {
  const tail = sub.replace(/^\/+/, '')
  return tail ? `/${ADMIN_PATH}/${tail}` : `/${ADMIN_PATH}`
}
