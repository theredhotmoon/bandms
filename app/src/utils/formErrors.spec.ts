import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ApiError, ApiValidationError } from '@/api/client'
import { reportSaveError } from './formErrors'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: { error: toastError } }))

describe('reportSaveError', () => {
  it('routes a field validation error into fieldErrors, not the toast', () => {
    const fieldErrors = ref<Record<string, string[]>>({})
    const error = new ApiValidationError({ email: ['The email has already been taken.'] })

    reportSaveError(error, 'Failed to save', fieldErrors)

    expect(fieldErrors.value).toEqual({ email: ['The email has already been taken.'] })
    expect(toastError).not.toHaveBeenCalled()
  })

  // A form with no fieldErrors ref (e.g. a delete confirmation) has nowhere
  // to render an inline error — a validation rejection there must still
  // reach the user, so it falls back to the toast with the real message.
  it('falls back to a toast when the form has no fieldErrors ref', () => {
    const error = new ApiValidationError({ password: ['The password confirmation does not match.'] })

    reportSaveError(error, 'Failed to save')

    expect(toastError).toHaveBeenCalledWith('The password confirmation does not match. (password)')
  })

  it('toasts the backend message for a business-rule 422 with no field bag', () => {
    const fieldErrors = ref<Record<string, string[]>>({})
    const error = new ApiError(422, 'You cannot delete your own account.')

    reportSaveError(error, 'Failed to delete user', fieldErrors)

    expect(fieldErrors.value).toEqual({})
    expect(toastError).toHaveBeenCalledWith('You cannot delete your own account.')
  })

  // A few API functions (music-video metadata/sync, Facebook-likes sync) do
  // their own fetch and throw a plain Error instead of going through
  // handleResponse — their message must still reach the toast.
  it('surfaces a plain Error message from endpoints that bypass handleResponse', () => {
    reportSaveError(new Error('Could not retrieve metadata for this URL.'), 'Failed to save')

    expect(toastError).toHaveBeenCalledWith('Could not retrieve metadata for this URL.')
  })

  it('falls back to the given message for a non-Error thrown value', () => {
    reportSaveError('boom', 'Failed to save')

    expect(toastError).toHaveBeenCalledWith('Failed to save')
  })
})
