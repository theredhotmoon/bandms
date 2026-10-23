import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createVenue, deleteVenue, fetchVenues, updateVenue } from '@/api/venues'
import type { Venue, VenuePayload } from '@/types/venue'
import { useAuth } from './useAuth'

export function useVenues() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: () => fetchVenues(token.value!),
    enabled: () => !!token.value,
  })

  const create = useMutation({
    mutationFn: (payload: VenuePayload) => createVenue(token.value!, payload),
    // Append before invalidating: a form that selects the new venue by id the
    // moment this resolves (the concert form's "New venue") would otherwise
    // show an empty select until the refetch lands.
    onSuccess: (venue) => {
      queryClient.setQueryData<Venue[]>(['venues'], (old) => (old ? [...old, venue] : old))
      return queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })

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
