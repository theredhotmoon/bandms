import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createTag, deleteTag, fetchTags, updateTag } from '@/api/tags'
import type { TagPayload } from '@/types/tag'
import { useAuth } from './useAuth'

export function useTags() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: ['tags'], queryFn: fetchTags })

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
