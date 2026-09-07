import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchHeroImages, saveHeroImageScope } from '@/api/heroImages'
import { useAuth } from './useAuth'
import type { HeroImagesResponse } from '@/types/heroImage'

const HERO_IMAGES_KEY = ['hero-images'] as const

export function useHeroImages() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: HERO_IMAGES_KEY,
    queryFn: () => fetchHeroImages(token.value!),
    enabled: () => token.value !== null,
  })

  const save = useMutation({
    mutationFn: ({ scope, photoIds }: { scope: string; photoIds: number[] }) =>
      saveHeroImageScope(token.value!, scope, photoIds),
    // The endpoint returns every scope already ordered, so seeding the cache
    // avoids a refetch that would briefly snap thumbnails back to their old
    // order — the same reason useFaqs seeds after a reorder.
    onSuccess: (data: HeroImagesResponse) => queryClient.setQueryData(HERO_IMAGES_KEY, data),
  })

  return { query, save }
}
