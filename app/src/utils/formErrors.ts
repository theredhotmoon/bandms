import type { Ref } from 'vue'
import { toast } from 'vue-sonner'
import { ApiValidationError, saveErrorMessage } from '@/api/client'

/**
 * The one place a form's save/create/update/delete catch block should call.
 *
 * A per-field validation rejection renders inline next to the offending
 * input via `fieldErrors` (when the form has one) — that's the better UX and
 * takes priority. Anything else — a business-rule 422 with no field bag, a
 * network failure, a 500 — becomes a toast carrying the backend's own
 * message, so a validator rejection is never silently swallowed into a
 * generic "Something went wrong".
 */
export function reportSaveError(
  error: unknown,
  fallback: string,
  fieldErrors?: Ref<Record<string, string[]>>,
): void {
  if (fieldErrors && error instanceof ApiValidationError) {
    fieldErrors.value = error.errors
    return
  }

  toast.error(saveErrorMessage(error, fallback))
}
