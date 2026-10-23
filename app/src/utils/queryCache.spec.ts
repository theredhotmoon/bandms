import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { appendToList } from './queryCache'

describe('appendToList', () => {
  it('appends to a cached list and asks for a refetch of the same key', () => {
    const qc = new QueryClient()
    qc.setQueryData(['venues'], [{ id: 1 }])
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    appendToList(qc, ['venues'], { id: 2 })

    expect(qc.getQueryData(['venues'])).toEqual([{ id: 1 }, { id: 2 }])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['venues'] })
  })

  it('seeds a list that never loaded, so a picker has an option behind the id', () => {
    const qc = new QueryClient()
    appendToList(qc, ['venues'], { id: 7 })
    expect(qc.getQueryData(['venues'])).toEqual([{ id: 7 }])
  })

  it('can invalidate a wider key than it appended to (lists cached per language)', () => {
    const qc = new QueryClient()
    qc.setQueryData(['releases', 'en'], [])
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    appendToList(qc, ['releases', 'en'], { id: 3 }, ['releases'])

    expect(qc.getQueryData(['releases', 'en'])).toEqual([{ id: 3 }])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['releases'] })
  })
})
