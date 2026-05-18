import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchSongs, createSong, updateSong, deleteSong } from '@/api/songs'
import type { SongPayload } from '@/types/song'
import { useAuth } from './useAuth'

const QK = ['songs']

export function useSongs() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const list = useQuery({
    queryKey: QK,
    queryFn: () => fetchSongs(token.value!),
  })

  const create = useMutation({
    mutationFn: (payload: SongPayload) => createSong(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<SongPayload> }) =>
      updateSong(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteSong(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QK }),
  })

  return { list, create, update, remove }
}
