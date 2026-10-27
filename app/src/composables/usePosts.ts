import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchPost, fetchPosts, fetchPublicPosts, createPost, updatePost, deletePost } from '@/api/posts'
import type { PostFilters, PostListResponse } from '@/api/posts'
import type { Post, PostPayload } from '@/types/post'
import { useAuth } from './useAuth'
import { useLang } from './useLang'

/**
 * The create mutation on its own (no list observer). Post lists are cached
 * per role, filter and language as `{ data, meta }`, so the new row is put
 * into every cached list's `data` rather than appended to one plain array,
 * and all of them are invalidated.
 */
export function useCreatePost() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: PostPayload) => createPost(token.value!, payload),
    onSuccess: (post) => {
      // The prefix also matches usePost's detail caches (['posts', id, lang]),
      // which hold one Post, not a list: only a `{ data: [] }` shape is touched.
      queryClient.setQueriesData<PostListResponse>({ queryKey: ['posts'] }, (old) =>
        old && Array.isArray(old.data) ? { ...old, data: [...old.data, post] } : old,
      )
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

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

  const create = useCreatePost()

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
