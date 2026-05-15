import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import {
  fetchInstruments,
  createInstrument,
  updateInstrument,
  deleteInstrument,
} from '@/api/instruments'
import type { Instrument, InstrumentPayload } from '@/types/instrument'

export function useInstruments() {
  const { token } = useAuth()
  const qc        = useQueryClient()
  const QKEY      = ['instruments']

  const query = useQuery<Instrument[]>({ queryKey: QKEY, queryFn: fetchInstruments })

  const create = useMutation({
    mutationFn: (payload: InstrumentPayload) => createInstrument(token.value!, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: QKEY }),
  })

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
