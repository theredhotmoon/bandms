import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createProfileSocialLink,
  deleteProfileSocialLink,
  fetchProfileSocialLinks,
  updateProfileSocialLink,
} from '@/api/socialLinks'
import type { SocialLinkPayload } from '@/types/socialLink'
import { useAuth } from './useAuth'

export function useSocialLinks() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const qk = ['band-profile-social-links']

  const query = useQuery({ queryKey: qk, queryFn: fetchProfileSocialLinks })

  const create = useMutation({
    mutationFn: (payload: SocialLinkPayload) => createProfileSocialLink(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SocialLinkPayload }) =>
      updateProfileSocialLink(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteProfileSocialLink(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  return { query, create, update, remove }
}
