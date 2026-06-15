import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchPost, fetchPosts, createPost, updatePost, deletePost } from '@/api/posts'
import type { PostFilters, PostListResponse } from '@/api/posts'
import type { Post, PostPayload } from '@/types/post'
import { useAuth } from './useAuth'
import { useLang } from './useLang'

export function usePosts(filters: Ref<PostFilters> = { value: {} } as Ref<PostFilters>) {
  const { token } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()

  const qk = computed(() => ['posts', filters.value, lang.value])

  const query = useQuery<PostListResponse>({
    queryKey: qk,
    queryFn: () => fetchPosts(filters.value, lang.value),
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
  const { lang } = useLang()
  const qk = computed(() => ['posts', id.value, lang.value])
  return useQuery<Post>({
    queryKey: qk,
    queryFn: () => fetchPost(id.value!, lang.value),
    enabled: computed(() => id.value !== null),
  })
}
