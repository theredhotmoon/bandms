/**
 * All the state behind the tech-rider editor: the draft, dirty tracking, live
 * resolution of the printed lists, saving, and promoting a per-gig change into
 * a member's saved rig.
 *
 * Kept out of the view so the view stays a thin orchestrator, and so the
 * resolution rules live next to the data rather than inside a template.
 */
import { computed, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { updateMemberSetup } from '@/api/bandMemberSetups'
import { useAuth } from './useAuth'
import { useBandMembers } from './useBandMembers'
import { useAllMemberSetups } from './useBandMemberSetups'
import { useTechRider } from './useTechRiders'
import type { SetupLookup } from '@/types/bandMemberSetup'
import { setupLookupFromGroups } from '@/types/bandMemberSetup'
import type { RigSpec } from '@/types/rig'
import { RIG_FIELDS } from '@/types/rig'
import type { StagePlacement } from '@/types/stagePlot'
import { defaultGigLineup } from '@/types/stagePlot'
import type { TechRiderPayload } from '@/types/techRider'
import { defaultPaFoh, defaultPowerNotes } from '@/types/techRider'
import { resolveRider, riderCompleteness } from '@/utils/riderResolver'
import type { ResolvableRider } from '@/utils/riderResolver'

/** The editable rider. Everything printable is derived from it, not stored. */
type RiderDraft = Required<Omit<TechRiderPayload, 'is_active'>> & { is_active: boolean }

function emptyDraft(): RiderDraft {
  return {
    name: '',
    is_active: false,
    concert_id: null,
    gig_lineup: defaultGigLineup(),
    placements: [],
    extra_inputs: [],
    extra_monitors: [],
    extra_backline: [],
    extra_wireless: [],
    channel_order: [],
    power_notes: defaultPowerNotes(),
    pa_foh: defaultPaFoh(),
  }
}

export function useTechRiderEditor(openId: Ref<number | null>) {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const { query: riderQ, update: riderMut } = useTechRider(openId)
  const { query: membersQ } = useBandMembers()
  const setupsQ = useAllMemberSetups()

  const members = computed(() => membersQ.data.value ?? [])

  /**
   * Saved rigs the editor resolves against. While editing we use the full
   * library (the picker needs it); the API also ships the referenced subset
   * with the rider so the public view can resolve without authentication.
   */
  const setups = computed<SetupLookup>(() => {
    const fromLibrary = setupLookupFromGroups(setupsQ.data.value ?? [])
    const fromRider = riderQ.data.value?.referenced_setups ?? {}
    // Library wins: it is the live copy, the shipped one is a point-in-time echo.
    return { ...Object.fromEntries(Object.entries(fromRider).map(([k, v]) => [Number(k), v])), ...fromLibrary }
  })

  // ── Draft ───────────────────────────────────────────────────────────────────

  const draft = reactive<RiderDraft>(emptyDraft())
  const dirty = ref(false)

  watch(
    () => riderQ.data.value,
    (rider) => {
      if (!rider) return
      Object.assign(draft, {
        name: rider.name,
        is_active: rider.is_active,
        concert_id: rider.concert_id ?? null,
        gig_lineup: {
          regular_members: rider.gig_lineup?.regular_members ?? [],
          temp_musicians: rider.gig_lineup?.temp_musicians ?? [],
        },
        placements: rider.placements ?? [],
        extra_inputs: rider.extra_inputs ?? [],
        extra_monitors: rider.extra_monitors ?? [],
        extra_backline: rider.extra_backline ?? [],
        extra_wireless: rider.extra_wireless ?? [],
        channel_order: rider.channel_order ?? [],
        power_notes: { ...defaultPowerNotes(), ...(rider.power_notes ?? {}) },
        pa_foh: { ...defaultPaFoh(), ...(rider.pa_foh ?? {}) },
      })
      dirty.value = false
    },
    { immediate: true },
  )

  /** Every mutation of the draft goes through here so `dirty` cannot go stale. */
  function patch<K extends keyof RiderDraft>(key: K, value: RiderDraft[K]) {
    draft[key] = value
    dirty.value = true
  }

  // ── Derived rider ───────────────────────────────────────────────────────────

  const resolvable = computed<ResolvableRider>(() => ({
    placements: draft.placements,
    gig_lineup: draft.gig_lineup,
    extra_inputs: draft.extra_inputs,
    extra_monitors: draft.extra_monitors,
    extra_backline: draft.extra_backline,
    extra_wireless: draft.extra_wireless,
    channel_order: draft.channel_order,
    power_notes: draft.power_notes,
  }))

  const resolved = computed(() => resolveRider(resolvable.value, setups.value, members.value))
  const completeness = computed(() => riderCompleteness(resolvable.value, setups.value, members.value))

  // ── Save ────────────────────────────────────────────────────────────────────

  const saving = ref(false)
  const saved = ref(false)

  async function save() {
    if (openId.value === null) return
    saving.value = true
    try {
      await riderMut.mutateAsync({ ...draft })
      dirty.value = false
      saved.value = true
      setTimeout(() => { saved.value = false }, 2000)
      toast.success('Rider saved')
    } catch {
      toast.error('Failed to save rider')
    } finally {
      saving.value = false
    }
  }

  // ── Promote an override into the member's saved rig ─────────────────────────

  const promoting = ref(false)

  /**
   * Writes the placement's resolved rig back to the setup it references, then
   * clears the override. The rider keeps rendering exactly the same thing —
   * the difference is that the change now belongs to the member's library.
   */
  async function promotePlacement(placement: StagePlacement) {
    if (placement.setup_id == null) return
    const member = placement.band_member_id
    if (member == null) return

    promoting.value = true
    try {
      const rig: Partial<RigSpec> = {}
      for (const field of RIG_FIELDS) {
        const value = placement.overrides?.[field]
        if (value !== undefined) Object.assign(rig, { [field]: value })
      }

      await updateMemberSetup(token.value!, member, placement.setup_id, rig)

      patch(
        'placements',
        draft.placements.map((p) => (p.id === placement.id ? { ...p, overrides: {} } : p)),
      )

      await queryClient.invalidateQueries({ queryKey: ['all-member-setups'] })
      await queryClient.invalidateQueries({ queryKey: ['member-setups', member] })
      toast.success('Saved to the member\'s rig — remember to save the rider too')
    } catch {
      toast.error('Could not save to the saved rig')
    } finally {
      promoting.value = false
    }
  }

  return {
    riderQ,
    membersQ,
    setupsQ,
    members,
    setups,
    draft,
    dirty,
    patch,
    resolved,
    completeness,
    saving,
    saved,
    save,
    promoting,
    promotePlacement,
  }
}
