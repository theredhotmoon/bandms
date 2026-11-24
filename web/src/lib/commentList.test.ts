import { describe, expect, it, vi } from 'vitest'
import { commentListLoader, withComment } from './commentList'
import type { CommentsResponse, PostComment } from './comments'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const comment = (id: number, mine = false): PostComment =>
  ({ id, author_name: 'A', body: `c${id}`, created_at: '2026-11-24T10:00:00Z', mine })
const list = (...data: PostComment[]): CommentsResponse => ({ data, enabled: true })

/** A loader whose requests are answered by hand, in any order. */
function setup() {
  const state = { token: null as string | null, shown: null as CommentsResponse | null, settled: 0 }
  const asked: { token: string | null; answer: ReturnType<typeof deferred<CommentsResponse>> }[] = []
  const loader = commentListLoader({
    token: () => state.token,
    fetch: (token) => {
      const answer = deferred<CommentsResponse>()
      asked.push({ token, answer })
      return answer.promise
    },
    apply: (res) => { state.shown = res },
    settled: () => { state.settled++ },
  })
  return { state, asked, loader }
}

describe('commentListLoader', () => {
  it('applies the answer and says the list has settled', async () => {
    const { state, asked, loader } = setup()
    const done = loader.load()
    asked[0].answer.resolve(list(comment(1)))
    await done
    expect(state.shown).toEqual(list(comment(1)))
    expect(state.settled).toBe(1)
  })

  it('lets only the newest load apply, whichever answers first', async () => {
    const { state, asked, loader } = setup()
    const first = loader.load()
    state.token = 'B'
    const second = loader.load()
    asked[1].answer.resolve(list(comment(1, true)))
    await second
    asked[0].answer.resolve(list(comment(1, false)))
    await first
    expect(state.shown).toEqual(list(comment(1, true)))
    expect(asked.map((a) => a.token)).toEqual([null, 'B'])
  })

  it('leaves settling to the newest load, when an older one fails too', async () => {
    const { state, asked, loader } = setup()
    const first = loader.load()
    const second = loader.load()
    asked[0].answer.reject(new TypeError('Failed to fetch'))
    await first
    expect(state.settled).toBe(0)
    asked[1].answer.resolve(list())
    await second
    expect(state.settled).toBe(1)
  })

  it('asks again for a reader who signed out meanwhile: "mine" belongs to the token that asked', async () => {
    const { state, asked, loader } = setup()
    state.token = 'A'
    const done = loader.load()
    state.token = null
    asked[0].answer.resolve(list(comment(1, true)))
    await vi.waitFor(() => expect(asked).toHaveLength(2))
    expect(state.shown).toBeNull()
    asked[1].answer.resolve(list(comment(1, false)))
    await done
    expect(asked[1].token).toBeNull()
    expect(state.shown).toEqual(list(comment(1, false)))
  })

  it('asks again instead of applying a list older than a comment posted or deleted here', async () => {
    const { state, asked, loader } = setup()
    state.token = 'A'
    const done = loader.load()
    loader.changed()
    asked[0].answer.resolve(list(comment(1)))
    await vi.waitFor(() => expect(asked).toHaveLength(2))
    expect(state.shown).toBeNull()
    asked[1].answer.resolve(list(comment(1), comment(2, true)))
    await done
    expect(state.shown).toEqual(list(comment(1), comment(2, true)))
    expect(state.settled).toBe(1)
  })

  it('a failed list changes nothing but settles', async () => {
    const { state, asked, loader } = setup()
    const done = loader.load()
    asked[0].answer.reject(new TypeError('Failed to fetch'))
    await done
    expect(state.shown).toBeNull()
    expect(state.settled).toBe(1)
  })
})

describe('withComment', () => {
  it('adds a new comment at the end', () => {
    expect(withComment([comment(1)], comment(2, true))).toEqual([comment(1), comment(2, true)])
  })

  it('never lists a comment twice when a list that held it landed first', () => {
    expect(withComment([comment(1), comment(2, true)], comment(2, true))).toEqual([comment(1), comment(2, true)])
  })
})
