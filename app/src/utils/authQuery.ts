/**
 * What the social sign-in callback leaves on /account, and the way to send a
 * fan there. The API ends on one of
 *   /account?token=…          (the exchange; handled by FanAccountView)
 *   /account?auth_notice=confirm_email
 *   /account?auth_error=cancelled|no_email|failed
 * with `lang` possibly appended. Anything else in the query is nobody's we
 * understand, so it is null rather than shown.
 */
import { API_BASE } from '@/api/client'
import { cleanReturnPath } from '@/utils/returnPath'

export type AuthError = 'cancelled' | 'no_email' | 'failed'
export type AuthNotice = 'confirm_email'

const ERRORS: readonly AuthError[] = ['cancelled', 'no_email', 'failed']
const NOTICES: readonly AuthNotice[] = ['confirm_email']

function one<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

export function readAuthQuery(query: Record<string, unknown>): { error: AuthError | null; notice: AuthNotice | null } {
  return { error: one(query.auth_error, ERRORS), notice: one(query.auth_notice, NOTICES) }
}

/** Facebook appends `#_=_` to the callback address; only exactly that is ours to drop. */
export function stripFacebookHash(hash: string): string {
  return hash === '#_=_' ? '' : hash
}

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  google: 'Google', // i18n-ignore: a brand name
  facebook: 'Facebook', // i18n-ignore: a brand name
}

/** The proper name shown on a button or in the linked list; '' for a provider we do not present. */
export function providerName(provider: string): string {
  return Object.hasOwn(PROVIDER_NAMES, provider) ? PROVIDER_NAMES[provider] : ''
}

export function knownProviders(list: readonly unknown[]): string[] {
  return list.filter((p): p is string => typeof p === 'string' && Object.hasOwn(PROVIDER_NAMES, p))
}

/**
 * Same address as web/src/lib/fanAuth.ts; here `returnTo` is usually null (no post
 * to go back to), and `lang` only a language the fan chose (chosenFanLocale()).
 */
export function providerUrl(
  provider: string,
  lang: string | null,
  returnTo: string | null,
  claimHash: string | null,
): string {
  const params: string[] = []
  if (lang) params.push(`lang=${encodeURIComponent(lang)}`)
  const path = cleanReturnPath(returnTo)
  if (path) params.push(`return_to=${encodeURIComponent(path)}`)
  if (claimHash) params.push(`claim_hash=${encodeURIComponent(claimHash)}`)
  const query = params.length > 0 ? `?${params.join('&')}` : ''
  return `${API_BASE}/api/fan/auth/${encodeURIComponent(provider)}/redirect${query}`
}
