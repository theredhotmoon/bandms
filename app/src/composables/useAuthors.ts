import { computed, type Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createAuthor, deleteAuthor, fetchAuthor, fetchAuthors, updateAuthor } from '@/api/authors'
import type { Author, AuthorSummary, AuthorPayload } from '@/types/author'
import { useAuth } from './useAuth'

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

  const create = useMutation({
    mutationFn: (payload: AuthorPayload) => createAuthor(token.value!, payload),
    onSuccess: invalidate,
  })

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
