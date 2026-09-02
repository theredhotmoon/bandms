/**
 * Publishing a rider and its version history.
 *
 * Kept apart from useTechRiderEditor: the editor owns a draft that changes on
 * every keystroke, versions are a small immutable log. The one place they meet
 * is `publish`, which has to save the draft first — publishing a rider while
 * unsaved edits sit in the form would freeze the wrong sheet, silently.
 */
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  deleteTechRiderVersion,
  fetchTechRiderVersion,
  fetchTechRiderVersions,
  publishTechRiderVersion,
} from '@/api/techRiderVersions'
import type { TechRiderVersion, TechRiderVersionPayload } from '@bandms/rider-core'
import { diffRiders } from '@/utils/riderDiff'
import type { RiderDiff } from '@/utils/riderDiff'
import { useAuth } from './useAuth'

/** Pass a Ref<number | null>; the query is disabled while the id is null. */
export function useTechRiderVersions(riderId: Ref<number | null>) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const qk = computed(() => ['tech-rider-versions', riderId.value])

  const query = useQuery<TechRiderVersion[]>({
    queryKey: qk,
    queryFn: () => fetchTechRiderVersions(token.value!, riderId.value!),
    enabled: computed(() => riderId.value !== null && !!token.value),
  })

  /** Publishing changes what the rider's public link serves, so both refresh. */
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['tech-rider-versions', riderId.value] })
    queryClient.invalidateQueries({ queryKey: ['tech-riders', riderId.value] })
    queryClient.invalidateQueries({ queryKey: ['tech-riders'] })
  }

  const publish = useMutation({
    mutationFn: (payload: TechRiderVersionPayload = {}) =>
      publishTechRiderVersion(token.value!, riderId.value!, payload),
    onSuccess: invalidate,
  })

  const discard = useMutation({
    mutationFn: (id: number) => deleteTechRiderVersion(token.value!, id),
    onSuccess: invalidate,
  })

  /**
   * The diff between two versions, fetched on demand.
   *
   * Snapshots are heavy and only wanted when someone asks "what changed", so
   * they are loaded per comparison rather than alongside the list.
   */
  const diff = ref<RiderDiff | null>(null)
  const diffing = ref(false)

  async function compare(olderId: number, newerId: number): Promise<void> {
    diffing.value = true
    diff.value = null
    try {
      const [before, after] = await Promise.all([
        fetchTechRiderVersion(token.value!, olderId),
        fetchTechRiderVersion(token.value!, newerId),
      ])
      diff.value = diffRiders(before, after)
    } finally {
      diffing.value = false
    }
  }

  function clearDiff(): void {
    diff.value = null
  }

  const versions = computed(() => query.data.value ?? [])
  const published = computed(() => versions.value.find((v) => v.status === 'published') ?? null)
  const nextNumber = computed(() => (versions.value[0]?.version_number ?? 0) + 1)

  return {
    query, versions, published, nextNumber,
    publish, discard,
    diff, diffing, compare, clearDiff,
  }
}
