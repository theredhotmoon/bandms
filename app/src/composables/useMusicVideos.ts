import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import {
  fetchMusicVideos,
  createMusicVideo,
  updateMusicVideo,
  deleteMusicVideo,
  fetchMusicVideoPreview,
  retrieveVideoMetadata,
  syncYouTubeViews,
} from '@/api/musicVideos'
import type { MusicVideo, MusicVideoPayload } from '@/types/musicVideo'
import { appendToList } from '@/utils/queryCache'

const QKEY = ['music-videos']

/** The create mutation on its own (no list observer); appends the row to the list cache. */
export function useCreateMusicVideo() {
  const { token } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: MusicVideoPayload) => createMusicVideo(token.value!, payload),
    onSuccess: (video) => appendToList<MusicVideo>(qc, QKEY, video),
  })
}

/** The URL metadata lookup on its own, for the form (which must not observe the list). */
export function useRetrieveVideoMetadata() {
  const { token } = useAuth()
  return useMutation({
    mutationFn: (url: string) => retrieveVideoMetadata(token.value!, url),
  })
}

export function useMusicVideos() {
  const { token } = useAuth()
  const qc        = useQueryClient()

  const query = useQuery<MusicVideo[]>({ queryKey: QKEY, queryFn: fetchMusicVideos })

  const create = useCreateMusicVideo()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<MusicVideoPayload> }) =>
      updateMusicVideo(token.value!, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteMusicVideo(token.value!, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  const previewFetch = useMutation({
    mutationFn: (id: number) => fetchMusicVideoPreview(token.value!, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  const retrieveMetadata = useRetrieveVideoMetadata()

  const syncViews = useMutation({
    mutationFn: () => syncYouTubeViews(token.value!),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  return { query, create, update, remove, previewFetch, retrieveMetadata, syncViews }
}
