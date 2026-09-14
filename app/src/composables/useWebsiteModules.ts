import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchModules,
  updateModule,
  updateModuleSettings,
  reorderModules,
} from '@/api/website-modules'
import { useAuth } from './useAuth'
import type { WebsiteModuleSettingsPayload } from '@/types/website-module'

export function useWebsiteModules() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['website-modules'],
    queryFn: () => fetchModules(token.value!),
    enabled: () => token.value !== null,
  })

  const toggleModule = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      updateModule(token.value!, slug, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const updateSettings = useMutation({
    mutationFn: ({
      slug,
      payload,
    }: {
      slug: string
      payload: WebsiteModuleSettingsPayload
    }) => updateModuleSettings(token.value!, slug, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const reorder = useMutation({
    mutationFn: (slugs: string[]) => reorderModules(token.value!, slugs),
    onSuccess: (data) => queryClient.setQueryData(['website-modules'], data),
  })

  return { query, toggleModule, updateSettings, reorder }
}
