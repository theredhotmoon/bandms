import { ref, watch } from 'vue'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { deleteComment, fetchAdminComments, setCommentHidden, setFanCommentsBlocked } from '@/api/comments'
import { useAuth } from './useAuth'

const COMMENTS_KEY = ['admin-comments'] as const

/**
 * Fan comments for the moderation page. Every action refetches the page: a
 * block changes every row by that fan, so patching one row would lie.
 */
export function useAdminComments() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const page = ref(1)

  const query = useQuery({
    queryKey: [...COMMENTS_KEY, page],
    queryFn: () => fetchAdminComments(token.value!, page.value),
    enabled: () => token.value !== null,
    placeholderData: keepPreviousData,
  })

  // Deleting the last row of the last page leaves `page` past the end: the
  // refetch then answers an empty list, which would read as "no comments".
  watch(() => query.data.value?.last_page, (last) => {
    if (last !== undefined && page.value > last) page.value = Math.max(1, last)
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: COMMENTS_KEY })

  const setHidden = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => setCommentHidden(token.value!, id, hidden),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteComment(token.value!, id),
    onSuccess: invalidate,
  })

  const setBlocked = useMutation({
    mutationFn: ({ fanId, blocked }: { fanId: number; blocked: boolean }) =>
      setFanCommentsBlocked(token.value!, fanId, blocked),
    onSuccess: invalidate,
  })

  return { page, query, setHidden, remove, setBlocked }
}
