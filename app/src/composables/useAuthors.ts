import { computed, type Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createAuthor, deleteAuthor, fetchAuthor, fetchAuthors, updateAuthor } from '@/api/authors'
import type { AuthorPayload } from '@/types/author'
import { useAuth } from './useAuth'

export function useAuthors() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['authors'],
    queryFn: fetchAuthors,
  })

  const create = useMutation({
    mutationFn: (payload: AuthorPayload) => createAuthor(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authors'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AuthorPayload }) =>
      updateAuthor(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authors'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteAuthor(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authors'] }),
  })

  return { query, create, update, remove }
}

export function useAuthor(id: Ref<number | null>) {
  return useQuery({
    queryKey: computed(() => ['authors', id.value]),
    queryFn: () => fetchAuthor(id.value!),
    enabled: computed(() => id.value != null),
  })
}
