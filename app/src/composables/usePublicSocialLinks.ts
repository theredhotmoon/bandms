import { useQuery } from '@tanstack/vue-query'
import { fetchProfileSocialLinks } from '@/api/socialLinks'
import type { SocialLink } from '@/types/socialLink'

export function usePublicSocialLinks() {
  const query = useQuery<SocialLink[]>({
    queryKey: ['band-profile-social-links'],
    queryFn: fetchProfileSocialLinks,
  })
  return { query }
}
