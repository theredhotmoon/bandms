import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { createRelease, deleteRelease, fetchReleases, updateRelease, uploadReleaseCover } from '@/api/releases'
import type { Release, ReleaseSummary, ReleasePayload } from '@/types/release'
import { appendToList } from '@/utils/queryCache'
import { createThenUpload } from '@/utils/createThenUpload'
import { reportSaveError } from '@/utils/formErrors'
import { useAuth } from './useAuth'
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
 * (see createThenUpload for the policy). Pass the page's own `create` so its
 * `isPending` covers this path too.
 */
export function useCreateReleaseWithCover(create = useCreateRelease()) {
  const { token } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()

  return (payload: ReleasePayload, coverFile: File | null): Promise<Release> =>
    createThenUpload(
      () => create.mutateAsync(payload),
      coverFile && (async (release) => {
        await uploadReleaseCover(token.value!, release.id, coverFile)
        void queryClient.invalidateQueries({ queryKey: ['releases'] })
      }),
      (e) => reportSaveError(e, t('media.releases.coverFailed')),
    )
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
  const createWithCover = useCreateReleaseWithCover(create)

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReleasePayload }) =>
      updateRelease(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['releases'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteRelease(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['releases'] }),
  })

  return { query, create, createWithCover, update, remove }
}
