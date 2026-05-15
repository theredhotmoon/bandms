import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '@/api/categories'
import type { CategoryPayload } from '@/types/category'
import { useAuth } from './useAuth'

export function useCategories() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const create = useMutation({
    mutationFn: (payload: CategoryPayload) => createCategory(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CategoryPayload }) =>
      updateCategory(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteCategory(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })

  return { query, create, update, remove }
}
