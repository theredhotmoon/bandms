/**
 * The one policy for "create a record, then upload its file": the record
 * stands whatever happens to the upload. A failed upload is handed to
 * `onUploadFailure` (a toast of its own) and the record is still returned, so
 * the caller closes and selects it instead of leaving a form open whose
 * second Create would make a duplicate. `upload` is null when the form sent
 * no file.
 */
export async function createThenUpload<T>(
  create: () => Promise<T>,
  upload: ((record: T) => Promise<unknown>) | null,
  onUploadFailure: (error: unknown) => void,
): Promise<T> {
  const record = await create()
  if (upload) {
    try {
      await upload(record)
    } catch (e) {
      onUploadFailure(e)
    }
  }
  return record
}
