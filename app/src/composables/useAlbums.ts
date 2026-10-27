import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { batchCreateAlbum, fetchAlbum, fetchAlbums, updateAlbum, deleteAlbum, reorderAlbumPhotos } from '@/api/albums'
import type { UploadProgress } from '@/api/albums'
import type { Album, AlbumPayload, BatchAlbumUploadMeta } from '@/types/album'
import { appendToList } from '@/utils/queryCache'
import { useAuth } from './useAuth'

/** What the "new album" form hands over: the photos and the album's metadata. */
export interface AlbumUpload {
  files: { file: File; caption: string }[]
  meta: BatchAlbumUploadMeta
}

/**
 * One multipart create: the album and its photos together, the way the
 * Photos page makes a new album — shared with the quick-add. The created
 * album goes into the list cache at once.
 */
export function useCreateAlbumWithPhotos() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return async (upload: AlbumUpload, onProgress: (p: UploadProgress) => void = () => {}): Promise<Album> => {
    const album = await batchCreateAlbum(token.value!, upload.files, upload.meta, onProgress)
    appendToList<Album>(queryClient, ['albums'], album)
    return album
  }
}

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
