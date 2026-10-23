import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createVenue, deleteVenue, fetchVenues, updateVenue } from '@/api/venues'
import type { Venue, VenuePayload } from '@/types/venue'
import { useAuth } from './useAuth'

/**
 * The create mutation on its own, for a component that creates venues but
 * never lists them (the concert form's "New venue"): `useVenues()` would add
 * a second observer on the list and refetch it on every mount.
 */
export function useCreateVenue() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: VenuePayload) => createVenue(token.value!, payload),
    // The new row goes into the cache at once and the refetch is not awaited:
    // `mutateAsync` resolves after `onSuccess`, so returning the invalidate
    // promise would hold "Saving…" until the list came back — through every
    // retry, when the list fetch is the thing that is failing. Seeding from
    // `[]` covers that failing-fetch case too, where the list never loaded
    // and the select would otherwise hold an id with no option behind it.
    onSuccess: (venue) => {
      queryClient.setQueryData<Venue[]>(['venues'], (old) => [...(old ?? []), venue])
      void queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })
}

export function useVenues() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => fetchVenues(token.value!),
    enabled: () => !!token.value,
  })

  const create = useCreateVenue()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<VenuePayload> }) =>
      updateVenue(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteVenue(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })

  return { query, create, update, remove }
}
