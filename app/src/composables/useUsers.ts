import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchUsers, createUser, updateUser, deleteUser } from '@/api/users'
import type { ManagedUser, UserPayload } from '@/types/user'

const QK = ['users']

export function useUsers() {
  const qc = useQueryClient()

  const list = useQuery<ManagedUser[]>({
    queryKey: QK,
    queryFn: fetchUsers,
  })

  const create = useMutation({
    mutationFn: (payload: UserPayload) => createUser(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<UserPayload> }) =>
      updateUser(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  return { list, create, update, remove }
}
