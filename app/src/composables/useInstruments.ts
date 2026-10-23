import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import {
  fetchInstruments,
  createInstrument,
  updateInstrument,
  deleteInstrument,
} from '@/api/instruments'
import type { Instrument, InstrumentPayload } from '@bandms/rider-core'

const QKEY = ['instruments']

/**
 * The create mutation on its own, for a component that creates instruments
 * but never lists them (the member form's "New instrument"): `useInstruments()`
 * would add a second observer on the list and refetch it on every mount.
 */
export function useCreateInstrument() {
  const { token } = useAuth()
  const qc        = useQueryClient()

  return useMutation({
    mutationFn: (payload: InstrumentPayload) => createInstrument(token.value!, payload),
    // The new row goes into the list at once so a picker can select it before
    // the refetch lands; the refetch is not awaited (`mutateAsync` resolves
    // after `onSuccess`, and awaiting it would hold "Saving…" through every
    // retry when the list fetch is the thing that is failing).
    onSuccess: (instrument) => {
      qc.setQueryData<Instrument[]>(QKEY, (old) => [...(old ?? []), instrument])
      void qc.invalidateQueries({ queryKey: QKEY })
    },
  })
}

export function useInstruments() {
  const { token } = useAuth()
  const qc        = useQueryClient()

  const query = useQuery<Instrument[]>({ queryKey: QKEY, queryFn: fetchInstruments })

  const create = useCreateInstrument()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<InstrumentPayload> }) =>
      updateInstrument(token.value!, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteInstrument(token.value!, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

  return { query, create, update, remove }
}
