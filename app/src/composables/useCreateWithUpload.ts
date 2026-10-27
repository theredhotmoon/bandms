import { useQueryClient, type QueryKey } from '@tanstack/vue-query'
import { createThenUpload } from '@/utils/createThenUpload'
import { reportSaveError } from '@/utils/formErrors'

/**
 * A create-then-upload save as one function `(payload, file)`: the record's
 * create, then its file, with the list invalidated after the upload and an
 * upload failure reported through its own toast while the record stands
 * (the policy is createThenUpload's). The concert's poster, the release's
 * cover and the band member's photo are the three instances; a page passes
 * its own `create` so its `isPending` covers the create step.
 */
export function useCreateWithUpload<TPayload, TRecord>(options: {
  create: (payload: TPayload) => Promise<TRecord>
  upload: (record: TRecord, file: File) => Promise<unknown>
  invalidateKey: QueryKey
  /** Resolved at failure time, so a UI-language switch is honoured. */
  failureMessage: () => string
}) {
  const queryClient = useQueryClient()

  return (payload: TPayload, file: File | null): Promise<TRecord> =>
    createThenUpload(
      () => options.create(payload),
      file
        ? async (record) => {
            await options.upload(record, file)
            void queryClient.invalidateQueries({ queryKey: options.invalidateKey })
          }
        : null,
      (e) => reportSaveError(e, options.failureMessage()),
    )
}
