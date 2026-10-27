import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createVenue, deleteVenue, fetchVenues, updateVenue } from '@/api/venues'
import type { Venue, VenuePayload } from '@/types/venue'
import { appendToList } from '@/utils/queryCache'
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
    onSuccess: (venue) => appendToList<Venue>(queryClient, ['venues'], venue),
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
