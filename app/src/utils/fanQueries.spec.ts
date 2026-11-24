import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/vue-query'
import { dropFanLists, fanListQuery } from './fanQueries'

const A = { token: 'token-a', fan: { id: 1 } }
const B = { token: 'token-b', fan: { id: 2 } }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('fanListQuery', () => {
  it('is keyed by the fan, never by the token', () => {
    const query = fanListQuery('tickets', A.token, A.fan, async () => [])
    expect(query.queryKey).toEqual(['fan', 1, 'tickets'])
    expect(JSON.stringify(query.queryKey)).not.toContain('token-a')
    expect(query.queryKey).not.toEqual(fanListQuery('tickets', B.token, B.fan, async () => []).queryKey)
    expect(query.queryKey).not.toEqual(fanListQuery('orders', A.token, A.fan, async () => []).queryKey)
  })

  it('is off without a whole session', () => {
    expect(fanListQuery('tickets', A.token, A.fan, async () => []).enabled).toBe(true)
    expect(fanListQuery('tickets', null, A.fan, async () => []).enabled).toBe(false)
    expect(fanListQuery('tickets', A.token, null, async () => []).enabled).toBe(false)
  })

  it('asks with the token of the fan in the key, on a retry made after the session changed too', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 1 } } })
    const session = { ...A }
    const first = deferred<string[]>()
    const fetcher = vi.fn((token: string) => fetcher.mock.calls.length === 1 ? first.promise : Promise.resolve([token]))

    const pending = client.fetchQuery({ ...fanListQuery('tickets', session.token, session.fan, fetcher), retry: 1, retryDelay: 1 })
    Object.assign(session, B)
    first.reject(new TypeError('Failed to fetch'))

    expect(await pending).toEqual(['token-a'])
    expect(fetcher.mock.calls.map(([token]) => token)).toEqual(['token-a', 'token-a'])
  })

  it('never shows one fan\'s late list to the fan signed in since', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const lateA = deferred<string[]>()
    const answerB = deferred<string[]>()
    const observer = new QueryObserver<string[]>(client, fanListQuery('tickets', A.token, A.fan, () => lateA.promise))
    const seen: unknown[] = []
    const stop = observer.subscribe((result) => seen.push(result.data))

    observer.setOptions(fanListQuery('tickets', B.token, B.fan, () => answerB.promise))
    lateA.resolve(['ticket of A'])
    await lateA.promise
    expect(observer.getCurrentResult().data).toBeUndefined()
    expect(observer.getCurrentResult().isPending).toBe(true)

    answerB.resolve(['ticket of B'])
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(['ticket of B']))
    expect(JSON.stringify(seen)).not.toContain('ticket of A')
    stop()
  })
})

describe('dropFanLists', () => {
  it('drops the fan lists and nothing else', () => {
    const client = new QueryClient()
    client.setQueryData(['fan', 1, 'tickets'], ['a'])
    client.setQueryData(['fan', 1, 'orders'], ['a'])
    client.setQueryData(['concerts'], ['c'])
    dropFanLists(client)
    expect(client.getQueryCache().getAll().map((q) => q.queryKey)).toEqual([['concerts']])
  })

  it('lets a lapsed session\'s list be asked again by the same fan\'s new session', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const lapsed = deferred<string[]>()
    const fetcher = (token: string) => (token === 'lapsed' ? lapsed.promise : Promise.resolve([token]))
    const observer = new QueryObserver<string[]>(client, fanListQuery('tickets', 'lapsed', A.fan, fetcher))
    const stop = observer.subscribe(() => {})

    dropFanLists(client)
    observer.setOptions(fanListQuery('tickets', 'fresh', A.fan, fetcher))
    lapsed.reject(new Error('401'))

    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(['fresh']))
    stop()
  })

  it('does nothing without a client', () => {
    dropFanLists(null)
  })
})
