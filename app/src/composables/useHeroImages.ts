import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchHeroImages,
  uploadHeroImages,
  updateHeroImage,
  reorderHeroImages,
  deleteHeroImage,
} from '@/api/heroImages'
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

  // Upload/update/reorder all return the full map already ordered, so seeding
  // the cache from the response avoids a refetch that would briefly snap
  // thumbnails back to their pre-mutation order.
  const onMapResponse = (data: HeroImagesResponse) => queryClient.setQueryData(HERO_IMAGES_KEY, data)

  const upload = useMutation({
    mutationFn: ({ scope, files }: { scope: string; files: { file: File; caption: string }[] }) =>
      uploadHeroImages(token.value!, scope, files),
    onSuccess: onMapResponse,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { caption?: string | null; active?: boolean } }) =>
      updateHeroImage(token.value!, id, payload),
    onSuccess: onMapResponse,
  })

  const reorder = useMutation({
    mutationFn: ({ scope, order }: { scope: string; order: number[] }) =>
      reorderHeroImages(token.value!, scope, order),
    onSuccess: onMapResponse,
  })

  // DELETE returns 204, not the map — invalidate and refetch instead, the
  // same handling PhotosAdminView already uses for removeAlbumPhoto.
  const remove = useMutation({
    mutationFn: (id: number) => deleteHeroImage(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HERO_IMAGES_KEY }),
  })

  return { query, upload, update, reorder, remove }
}
