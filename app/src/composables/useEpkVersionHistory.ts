import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useEpkVersions } from './useEpkVersions'
import { reportSaveError } from '@/utils/formErrors'
import type { EpkVersion } from '@/types/epkVersion'

/**
 * Everything the version-history modal needs, from either place it opens —
 * the Dashboard widget and Band Profile → EPK both show the same list and
 * take the same actions on it, so the toasts and the open flag live here
 * rather than being written twice.
 *
 * "Make live" on an archived version and "Publish" on a pending one are the
 * same request; the server treats a restore as a publish.
 */
export function useEpkVersionHistory() {
  const { query, publish, discard } = useEpkVersions()
  const { t } = useI18n()

  const open = ref(false)

  const versions = computed<EpkVersion[]>(() => query.data.value ?? [])
  const pendingVersion   = computed(() => versions.value.find((v) => v.status === 'pending') ?? null)
  const publishedVersion = computed(() => versions.value.find((v) => v.status === 'published') ?? null)

  async function makeLive(version: EpkVersion): Promise<void> {
    try {
      await publish.mutateAsync(version.id)
      toast.success(t('dashboard.epk.nowLive', { version: version.version_number }))
    } catch (e) { reportSaveError(e, t('dashboard.epk.publishFailed')) }
  }

  async function remove(version: EpkVersion): Promise<void> {
    try {
      await discard.mutateAsync(version.id)
      toast.success(version.status === 'pending'
        ? t('dashboard.epk.discarded')
        : t('dashboard.epk.deleted', { version: version.version_number }))
    } catch (e) { reportSaveError(e, t('dashboard.epk.deleteFailed')) }
  }

  return {
    open,
    versions,
    pendingVersion,
    publishedVersion,
    loaded:     computed(() => query.data.value !== undefined),
    loading:    computed(() => query.isPending.value),
    error:      computed(() => query.isError.value),
    publishing: computed(() => publish.isPending.value),
    deleting:   computed(() => discard.isPending.value),
    makeLive,
    remove,
  }
}
