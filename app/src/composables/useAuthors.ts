import { computed, type Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createAuthor, deleteAuthor, fetchAuthor, fetchAuthors, updateAuthor } from '@/api/authors'
import type { Author, AuthorSummary, AuthorPayload } from '@/types/author'
import { useAuth } from './useAuth'

/**
 * The create mutation on its own, for a component that creates contacts but
 * never lists them (the band form's "New contact"): `useAuthors()` would add
 * a second observer on the list and refetch it on every mount.
 */
export function useCreateAuthor() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AuthorPayload) => createAuthor(token.value!, payload),
    // The new row goes into the list at once so a picker can tick it before
    // the refetch lands; the refetch is not awaited (`mutateAsync` resolves
    // after `onSuccess`, and awaiting it would hold "Saving…" through every
    // retry when the list fetch is the thing that is failing).
    onSuccess: (author) => {
      queryClient.setQueryData<AuthorSummary[]>(['authors'], (old) => [...(old ?? []), author])
      void queryClient.invalidateQueries({ queryKey: ['authors'] })
      void queryClient.invalidateQueries({ queryKey: ['bands'] })
    },
  })
}

export function useAuthors() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<AuthorSummary[]>({
    queryKey: ['authors'],
    queryFn: () => fetchAuthors(token.value!),
    enabled: () => !!token.value,
  })

  // Author writes touch `author_bands`, so the bands list is stale afterwards.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['authors'] })
    queryClient.invalidateQueries({ queryKey: ['bands'] })
  }

  const create = useCreateAuthor()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AuthorPayload }) =>
      updateAuthor(token.value!, id, payload),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteAuthor(token.value!, id),
    onSuccess: invalidate,
  })

  return { query, create, update, remove }
}

export function useAuthor(id: Ref<number | null>) {
  const { token } = useAuth()

  return useQuery<Author>({
    queryKey: computed(() => ['authors', id.value]),
    queryFn: () => fetchAuthor(token.value!, id.value!),
    enabled: computed(() => id.value != null && !!token.value),
  })
}
