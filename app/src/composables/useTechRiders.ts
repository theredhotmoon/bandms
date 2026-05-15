import { computed } from 'vue'
import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchTechRiders,
  fetchTechRider,
  createTechRider,
  updateTechRider,
  activateTechRider,
  deleteTechRider,
} from '@/api/techRiders'
import type { TechRiderPayload } from '@/types/techRider'
import { useAuth } from './useAuth'

const LIST_QK = ['tech-riders']

export function useTechRiders() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const list = useQuery({ queryKey: LIST_QK, queryFn: fetchTechRiders })

  const create = useMutation({
    mutationFn: (payload: TechRiderPayload) => createTechRider(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_QK }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteTechRider(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_QK }),
  })

  const activate = useMutation({
    mutationFn: (id: number) => activateTechRider(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_QK }),
  })

  return { list, create, remove, activate }
}

/**
 * Pass a Ref<number | null>; the query is disabled while id is null.
 * Call this ONCE at the component's setup root — never inside computed().
 */
export function useTechRider(openId: Ref<number | null>) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const qk = computed(() => ['tech-riders', openId.value])

  const query = useQuery({
    queryKey: qk,
    queryFn: () => fetchTechRider(openId.value!),
    enabled: computed(() => openId.value !== null),
  })

  const update = useMutation({
    mutationFn: (payload: TechRiderPayload) => updateTechRider(token.value!, openId.value!, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.value, data)
      queryClient.invalidateQueries({ queryKey: LIST_QK })
    },
  })

  return { query, update }
}
