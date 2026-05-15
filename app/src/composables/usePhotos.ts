import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchPhoto, fetchPhotos, updatePhoto, deletePhoto } from '@/api/photos'
import type { PhotoPayload } from '@/types/photo'
import { useAuth } from './useAuth'

export function usePhotos() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['photos'],
    queryFn: fetchPhotos,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PhotoPayload }) =>
      updatePhoto(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deletePhoto(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos'] }),
  })

  return { query, update, remove }
}

export function usePhoto(id: { value: number | null }) {
  return useQuery({
    queryKey: ['photos', id],
    queryFn: () => fetchPhoto(id.value!),
    enabled: () => id.value !== null,
  })
}
