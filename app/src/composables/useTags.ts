import { computed, type ComputedRef, type Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createTag, deleteTag, fetchTags, updateTag } from '@/api/tags'
import type { Tag, TagPayload } from '@/types/tag'
import { sortTagsByLabel, tagLabel, tagTerms } from '@/utils/localeOrder'
import { useAuth } from './useAuth'
import { useContentLocaleOrder } from './useContentLocales'

export function useTags() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const order = useContentLocaleOrder()

  // Every picker reads this list, so it is sorted here, by the name each tag
  // is shown under (tagLabel) — not in the API's request-language order. A
  // computed `select` is a new function when the band's order changes, so
  // the cached list re-sorts without a refetch.
  const query = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: fetchTags,
    select: computed(() => (tags: Tag[]) => sortTagsByLabel(tags, order.value)),
  })

  const create = useMutation({
    mutationFn: (payload: TagPayload) => createTag(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TagPayload }) =>
      updateTag(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteTag(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })

  return { query, create, update, remove }
}

/** A tag as the tags list shows it. */
export type TagRow = Tag & {
  /** The name in the band's first content language (see `tagLabel`). */
  label: string
  /** Every language of the name and slug, lowercased once per data change. */
  terms: string[]
}

/**
 * The tags list's rows: named in the band's first language, like the FAQ
 * list and the form's first row; searchable in every language. The slug
 * column keeps the API's `slug` — the default locale's, the tag's stable key.
 */
export function useTagRows(tags: Ref<Tag[] | undefined>): ComputedRef<TagRow[] | undefined> {
  const order = useContentLocaleOrder()
  return computed(() =>
    tags.value?.map(tag => ({ ...tag, label: tagLabel(tag, order.value), terms: tagTerms(tag) })),
  )
}
