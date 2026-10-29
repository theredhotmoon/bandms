import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { pagedAttrs, useShowMore } from './showMore'
import { listPaging } from './copy'
import type { SiteConfig } from './cms'

const items = Array.from({ length: 14 }, (_, i) => i)
const shownCount = (heldBack: (i: number) => '' | undefined, list: readonly number[]) =>
  list.filter((_, i) => heldBack(i) === undefined).length

describe('pagedAttrs', () => {
  it('marks only the items past the first batch', () => {
    expect(pagedAttrs(5, 6)).toEqual({})
    expect(pagedAttrs(6, 6)).toEqual({ 'data-more-hidden': '' })
  })

  it.each([null, undefined, 0])('marks nothing when perPage is %s', (perPage) => {
    expect(pagedAttrs(100, perPage)).toEqual({})
  })
})

describe('listPaging', () => {
  it('reads the module setting and the site-wide label', () => {
    const cfg = { module_config: { press: { per_page: 9 } } } as unknown as SiteConfig
    expect(listPaging(cfg, 'press', 'en')).toEqual({ perPage: 9, showMoreLabel: 'Show more' })
    expect(listPaging(cfg, 'press', 'pl').showMoreLabel).toBe('Pokaż więcej')
  })

  it('reads "Default" when the config failed open', () => {
    expect(listPaging({ module_config: {} } as unknown as SiteConfig, 'press', 'en').perPage).toBeNull()
  })
})

describe('useShowMore', () => {
  it('shows one batch, then one more per call, until the list runs out', () => {
    const { heldBack, hasMore, showMore } = useShowMore(() => items, 6)
    expect(shownCount(heldBack, items)).toBe(6)
    expect(hasMore.value).toBe(true)

    showMore()
    expect(shownCount(heldBack, items)).toBe(12)
    expect(hasMore.value).toBe(true)

    showMore()
    expect(shownCount(heldBack, items)).toBe(14)
    expect(hasMore.value).toBe(false)
  })

  it.each([null, undefined, 0])('shows everything when perPage is %s ("Default")', (perPage) => {
    const { heldBack, hasMore } = useShowMore(() => items, perPage)
    expect(shownCount(heldBack, items)).toBe(14)
    expect(hasMore.value).toBe(false)
  })

  it('has nothing more when the list is exactly one batch', () => {
    const { hasMore } = useShowMore(() => items.slice(0, 6), 6)
    expect(hasMore.value).toBe(false)
  })

  it('starts again from the first batch when a filter changes', async () => {
    const filter = ref('all')
    const { heldBack, showMore } = useShowMore(() => items, 6, [filter])
    showMore()
    expect(shownCount(heldBack, items)).toBe(12)

    filter.value = 'live'
    await nextTick()
    expect(shownCount(heldBack, items)).toBe(6)
  })

  it('follows a perPage that changes', async () => {
    const perPage = ref<number | null>(6)
    const { heldBack } = useShowMore(() => items, () => perPage.value)
    perPage.value = 9
    await nextTick()
    expect(shownCount(heldBack, items)).toBe(9)
  })

  it('follows a list that shrinks under a filter', () => {
    const list = ref(items)
    const { hasMore } = useShowMore(() => list.value, 6)
    expect(hasMore.value).toBe(true)
    list.value = items.slice(0, 4)
    expect(hasMore.value).toBe(false)
  })
})
