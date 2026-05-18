import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import {
  fetchMusicVideos,
  createMusicVideo,
  updateMusicVideo,
  deleteMusicVideo,
  fetchMusicVideoPreview,
  syncYouTubeViews,
} from '@/api/musicVideos'
import type { MusicVideo, MusicVideoPayload } from '@/types/musicVideo'

export function useMusicVideos() {
  const { token } = useAuth()
  const qc        = useQueryClient()
  const QKEY      = ['music-videos']

  const query = useQuery<MusicVideo[]>({ queryKey: QKEY, queryFn: fetchMusicVideos })

  const create = useMutation({
    mutationFn: (payload: MusicVideoPayload) => createMusicVideo(token.value!, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

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

  const syncViews = useMutation({
    mutationFn: () => syncYouTubeViews(token.value!),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  return { query, create, update, remove, previewFetch, syncViews }
}
