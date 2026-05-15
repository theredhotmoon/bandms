import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchPost, fetchPosts, createPost, updatePost, deletePost } from '@/api/posts'
import type { PostFilters } from '@/api/posts'
import type { PostPayload } from '@/types/post'
import { useAuth } from './useAuth'

export function usePosts(filters: Ref<PostFilters> = { value: {} } as Ref<PostFilters>) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['posts', filters],
    queryFn: () => fetchPosts(filters.value),
  })

  const create = useMutation({
    mutationFn: (payload: PostPayload) => createPost(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PostPayload> }) =>
      updatePost(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deletePost(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  })

  return { query, create, update, remove }
}

export function usePost(id: Ref<number | null>) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => fetchPost(id.value!),
    enabled: () => id.value !== null,
  })
}
