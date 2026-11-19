import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchWelcomeSettings, saveWelcomeSettings, stampWelcomeCampaign } from '@/api/welcomeSettings'
import type { WelcomeSettings, WelcomeSettingsInput } from '@/types/welcome'
import { useAuth } from './useAuth'

const KEY = ['welcome-settings'] as const

/** The welcome screen's settings, edited on the Website modules page. */
export function useWelcomeSettings() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => fetchWelcomeSettings(token.value!),
    enabled: () => token.value !== null,
  })

  const save = useMutation({
    mutationFn: (input: WelcomeSettingsInput) => saveWelcomeSettings(token.value!, input),
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  })

  const stampCampaign = useMutation({
    mutationFn: () => stampWelcomeCampaign(token.value!),
    // Patch only `campaign`: a refetch would hand back the saved settings and
    // overwrite whatever the band has typed but not yet saved.
    onSuccess: (data) => queryClient.setQueryData<WelcomeSettings>(KEY, (old) =>
      old ? { ...old, campaign: data.campaign } : data),
  })

  return { query, save, stampCampaign }
}
