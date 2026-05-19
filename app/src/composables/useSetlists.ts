import { computed } from 'vue'
import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchSetlists, fetchSetlist,
  createSetlist, updateSetlist, deleteSetlist,
  addSetlistItem, updateSetlistItem, removeSetlistItem, reorderSetlistItems,
  importFromSetlistFm,
  searchSetlistFmArtist, fetchSetlistFmSetlists,
} from '@/api/setlists'
import { fetchConcertSetlist } from '@/api/concerts'
import type { SetlistPayload, SetlistItemPayload, Setlist, PublicSetlist } from '@/types/setlist'
import { useAuth } from './useAuth'

const LIST_QK = ['setlists']

export function useSetlists() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const list = useQuery({
    queryKey: LIST_QK,
    queryFn: () => fetchSetlists(token.value!),
  })

  const create = useMutation({
    mutationFn: (payload: SetlistPayload) => createSetlist(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_QK }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteSetlist(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_QK }),
  })

  const importFm = useMutation({
    mutationFn: (payload: Parameters<typeof importFromSetlistFm>[1]) =>
      importFromSetlistFm(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_QK }),
  })

  return { list, create, remove, importFm }
}

export function useSetlist(openId: Ref<number | null>) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const qk = computed(() => ['setlists', openId.value])

  const query = useQuery<Setlist>({
    queryKey: qk,
    queryFn: () => fetchSetlist(token.value!, openId.value!),
    enabled: computed(() => openId.value !== null),
  })

  const update = useMutation({
    mutationFn: (payload: SetlistPayload) => updateSetlist(token.value!, openId.value!, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.value, data)
      queryClient.invalidateQueries({ queryKey: LIST_QK })
    },
  })

  const addItem = useMutation({
    mutationFn: (payload: SetlistItemPayload & { song_id: number }) =>
      addSetlistItem(token.value!, openId.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.value }),
  })

  const updateItem = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: SetlistItemPayload }) =>
      updateSetlistItem(token.value!, openId.value!, itemId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.value }),
  })

  const removeItem = useMutation({
    mutationFn: (itemId: number) => removeSetlistItem(token.value!, openId.value!, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.value }),
  })

  const reorder = useMutation({
    mutationFn: (order: number[]) => reorderSetlistItems(token.value!, openId.value!, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.value }),
  })

  return { query, update, addItem, updateItem, removeItem, reorder }
}

export function useConcertSetlist(concertId: Ref<number | null>) {
  const query = useQuery<PublicSetlist | null>({
    queryKey: computed(() => ['concert-setlist', concertId.value]),
    queryFn: () => fetchConcertSetlist(concertId.value!),
    enabled: computed(() => concertId.value !== null),
  })

  return { query }
}

export function useSetlistFmSearch() {
  const { token } = useAuth()

  const searchArtist = useMutation({
    mutationFn: (q: string) => searchSetlistFmArtist(token.value!, q),
  })

  const fetchArtistSetlists = useMutation({
    mutationFn: ({ mbid, page }: { mbid: string; page?: number }) =>
      fetchSetlistFmSetlists(token.value!, mbid, page ?? 1),
  })

  return { searchArtist, fetchArtistSetlists }
}
