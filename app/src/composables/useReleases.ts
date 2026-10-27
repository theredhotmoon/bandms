import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { createRelease, deleteRelease, fetchReleases, updateRelease, uploadReleaseCover } from '@/api/releases'
import type { Release, ReleaseSummary, ReleasePayload } from '@/types/release'
import { appendToList } from '@/utils/queryCache'
import { useAuth } from './useAuth'
import { useCreateWithUpload } from './useCreateWithUpload'
import { useLang } from './useLang'

/**
 * The create mutation on its own (no list observer). The row goes into the
 * current language's list; every language's list is invalidated.
 */
export function useCreateRelease() {
  const { token } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ReleasePayload) => createRelease(token.value!, payload),
    onSuccess: (release) => appendToList<ReleaseSummary>(queryClient, ['releases', lang.value], release, ['releases']),
  })
}

/**
 * Create, then the cover — shared by the releases page and the quick-add
 * (see useCreateWithUpload). The page passes its own `create`.
 */
export function useCreateReleaseWithCover(create = useCreateRelease()) {
  const { token } = useAuth()
  const { t } = useI18n()
  return useCreateWithUpload<ReleasePayload, Release>({
    create: (payload) => create.mutateAsync(payload),
    upload: (release, file) => uploadReleaseCover(token.value!, release.id, file),
    invalidateKey: ['releases'],
    failureMessage: () => t('media.releases.coverFailed'),
  })
}

export function useReleases() {
  const { token } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()

  const qk = computed(() => ['releases', lang.value])

  const query = useQuery<ReleaseSummary[]>({
    queryKey: qk,
    queryFn: () => fetchReleases(lang.value),
  })

  const create = useCreateRelease()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReleasePayload }) =>
      updateRelease(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['releases'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteRelease(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['releases'] }),
  })

  return { query, create, update, remove }
}
