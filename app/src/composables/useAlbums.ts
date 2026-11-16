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
    // Its Concert field links it from that concert server-side; a cached
    // concert without it would resend album_ids and drop the new link.
    if (album.concert) void queryClient.invalidateQueries({ queryKey: ['concerts'] })
    return album
  }
}

/**
 * Records whose cached copy carries `album_ids` — "Link to… → Photo albums".
 * An album edit can change them (its Concert field links that concert) and
 * a delete drops ids from them, so a stale copy would resend a deleted id
 * and the next save of that record would 422.
 */
const LINKING_QUERIES = [['concerts'], ['posts'], ['releases'], ['shop-item']] as const

export function useAlbums() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Album[]>({
    queryKey: ['albums'],
    queryFn: fetchAlbums,
  })

  const invalidateWithLinks = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['albums'] }),
    ...LINKING_QUERIES.map(queryKey => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
  ])

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AlbumPayload> }) =>
      updateAlbum(token.value!, id, payload),
    onSuccess: invalidateWithLinks,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteAlbum(token.value!, id),
    onSuccess: invalidateWithLinks,
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
