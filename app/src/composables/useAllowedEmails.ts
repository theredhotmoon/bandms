import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchAllowedEmails,
  createAllowedEmail,
  updateAllowedEmail,
  deleteAllowedEmail,
} from '@/api/allowedEmails'
import type { AllowedEmailPayload } from '@/types/allowedEmail'
import { useAuth } from './useAuth'

const QK = ['allowed-emails']

export function useAllowedEmails() {
  const { token } = useAuth()
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: QK,
    queryFn: () => fetchAllowedEmails(token.value!),
  })

  const create = useMutation({
    mutationFn: (payload: AllowedEmailPayload) => createAllowedEmail(token.value!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AllowedEmailPayload> }) =>
      updateAllowedEmail(token.value!, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteAllowedEmail(token.value!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  return { list, create, update, remove }
}
