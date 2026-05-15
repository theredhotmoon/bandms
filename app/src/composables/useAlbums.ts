import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { fetchAlbum, fetchAlbums, updateAlbum, deleteAlbum, reorderAlbumPhotos } from '@/api/albums'
import type { Album, AlbumPayload } from '@/types/album'
import { useAuth } from './useAuth'

export function useAlbums() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Album[]>({
    queryKey: ['albums'],
    queryFn: fetchAlbums,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AlbumPayload> }) =>
      updateAlbum(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albums'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteAlbum(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albums'] }),
  })

  const reorderPhotos = useMutation({
    mutationFn: ({ albumId, order }: { albumId: number; order: number[] }) =>
      reorderAlbumPhotos(token.value!, albumId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albums'] }),
  })

  return { query, update, remove, reorderPhotos }
}

export function useAlbum(id: Ref<number | null>) {
  return useQuery<Album>({
    queryKey: ['albums', id],
    queryFn: () => fetchAlbum(id.value!),
    enabled: () => id.value !== null,
  })
}
