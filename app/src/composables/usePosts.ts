import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchPost, fetchPosts, fetchPublicPosts, createPost, updatePost, deletePost } from '@/api/posts'
import type { PostFilters, PostListResponse } from '@/api/posts'
import type { Post, PostPayload } from '@/types/post'
import { useAuth } from './useAuth'
import { useLang } from './useLang'

export function usePosts(filters: Ref<PostFilters> = { value: {} } as Ref<PostFilters>) {
  const { token, isAdmin, isPublisher } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()

  // Only admin and publisher may read /api/admin/posts (drafts included). The
  // dashboard calls this for every signed-in role, so a member falls back to
  // the public list rather than a 403 that would read as "no posts".
  const canReadDrafts = computed(() => isAdmin.value || isPublisher.value)
  const qk = computed(() => ['posts', canReadDrafts.value ? 'admin' : 'public', filters.value, lang.value])

  const query = useQuery<PostListResponse>({
    queryKey: qk,
    queryFn: () => canReadDrafts.value
      ? fetchPosts(token.value!, filters.value, lang.value)
      : fetchPublicPosts(filters.value, lang.value),
    enabled: () => token.value !== null,
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
  const { token } = useAuth()
  const { lang } = useLang()
  const qk = computed(() => ['posts', id.value, lang.value])
  return useQuery<Post>({
    queryKey: qk,
    queryFn: () => fetchPost(token.value!, id.value!, lang.value),
    enabled: computed(() => id.value !== null && token.value !== null),
  })
}
