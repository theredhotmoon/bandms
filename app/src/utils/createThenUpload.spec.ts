import { describe, expect, it, vi } from 'vitest'
import { createThenUpload } from './createThenUpload'

describe('createThenUpload', () => {
  it('creates, uploads, and returns the record', async () => {
    const upload = vi.fn(async () => undefined)
    const onFail = vi.fn()
    const record = await createThenUpload(async () => ({ id: 1 }), upload, onFail)
    expect(record).toEqual({ id: 1 })
    expect(upload).toHaveBeenCalledWith({ id: 1 })
    expect(onFail).not.toHaveBeenCalled()
  })

  it('still returns the record when the upload fails, reporting the failure', async () => {
    const boom = new Error('413')
    const onFail = vi.fn()
    const record = await createThenUpload(async () => ({ id: 2 }), async () => { throw boom }, onFail)
    expect(record).toEqual({ id: 2 })
    expect(onFail).toHaveBeenCalledWith(boom)
  })

  it('skips the upload step when there is no file', async () => {
    const onFail = vi.fn()
    expect(await createThenUpload(async () => ({ id: 3 }), null, onFail)).toEqual({ id: 3 })
    expect(onFail).not.toHaveBeenCalled()
  })

  it('propagates a failed create and never uploads', async () => {
    const upload = vi.fn()
    await expect(createThenUpload(async () => { throw new Error('422') }, upload, vi.fn())).rejects.toThrow('422')
    expect(upload).not.toHaveBeenCalled()
  })
})
