import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchCommentLimit, saveCommentLimit } from '@/api/comments'
import type { CommentLimit } from '@/types/comment'
import { useAuth } from './useAuth'

const LIMIT_KEY = ['admin-comment-limit'] as const

/** The band's per-fan comment limit, edited on the Comments page. */
export function useCommentLimit() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: LIMIT_KEY,
    queryFn: () => fetchCommentLimit(token.value!),
    enabled: () => token.value !== null,
  })

  const save = useMutation({
    mutationFn: (limit: CommentLimit) => saveCommentLimit(token.value!, limit),
    // The endpoint answers with what it stored, so no refetch is needed.
    onSuccess: (data) => queryClient.setQueryData(LIMIT_KEY, data),
  })

  return { query, save }
}
