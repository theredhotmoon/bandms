import { ApiError, ApiValidationError } from '@/api/client'

/**
 * Framework-generated messages are English whatever the request locale says.
 *
 * `ThrottleRequestsException` carries the hardcoded "Too Many Attempts." and
 * has no `pl` entry — and a 429 is exactly what the fan routes' throttles
 * produce. A 500 is "Server Error" for the same reason. Our own controller
 * messages *are* translated (`__('api.fan.*')`), so those are worth printing.
 *
 * 401 is included deliberately: `FanAuth` aborts through `__()` too, so a
 * lapsed session says so in the fan's language. It was English until the
 * middleware was wired up — if a 4xx ever gains an untranslated message again,
 * this predicate is the place that has to know.
 */
function isOurs(err: ApiError): boolean {
  // The one 429 the API words itself: the sign-in attempt limit. Its `code`
  // is what tells it from the route throttle's framework string.
  if (err.status === 429) return err.code === 'login_limit'
  return err.status < 500
}

/**
 * Whether the server refused a request: the API answered with an error status.
 * A rejected fetch (offline, aborted), a gateway's 502 or 504, or a 200 that
 * could not be read is neither a success nor a refusal — what the server did
 * with the request is not known. Same rule in web/src/lib/fanAuth.ts.
 */
export function serverRefused(err: unknown): boolean {
  if (err instanceof ApiValidationError) return true
  return err instanceof ApiError && err.status !== 502 && err.status !== 504
}

/**
 * Whether an emailed link turned out to be used up or expired — the API's 401.
 * After anything else (no answer, a throttle, a 5xx, a page that is not the
 * API's) the link may still be good.
 */
export function linkWasRefused(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}

/**
 * The sentence to show a fan for a failed request.
 *
 * The fan surfaces used to print `err.message` whenever the error was an
 * `Error`, which is how "500: Internal Server Error" reached a Polish page.
 * That message is only ever worth showing when the server wrote it in the
 * fan's language; otherwise the caller's translated fallback is the answer.
 *
 * Pass `''` as the fallback when the template already has its own translated
 * `v-else` — TicketClaimView does.
 */
export function fanErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiValidationError) {
    // The field is typed non-optional, but it is only as good as every
    // construction site — and one of them used to pass `undefined`, which threw
    // a TypeError from inside the caller's own catch block.
    return Object.values(err.errors ?? {}).flat().join(' ') || fallback
  }

  if (err instanceof ApiError && err.message && isOurs(err)) {
    return err.message
  }

  return fallback
}
