import { ApiError, ApiValidationError } from '@/api/client'

/**
 * Framework-generated messages are English whatever the request locale says.
 *
 * `ThrottleRequestsException` carries the hardcoded "Too Many Attempts." and
 * has no `pl` entry — and a 429 is exactly what the fan routes' throttles
 * produce. A 500 is "Server Error" for the same reason. Our own controller
 * messages *are* translated (`__('api.fan.*')`), so those are worth printing.
 */
function isOurs(status: number): boolean {
  return status < 500 && status !== 429
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

  if (err instanceof ApiError && err.message && isOurs(err.status)) {
    return err.message
  }

  return fallback
}
