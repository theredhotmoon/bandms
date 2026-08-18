<script setup lang="ts">
import { computed, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { saveErrorMessage } from '@/api/client'
import AdminModal from '@/components/admin/AdminModal.vue'
import RiderChannelList from '@/components/tech-rider/RiderChannelList.vue'
import RiderPublishModal from '@/components/tech-rider/RiderPublishModal.vue'
import RiderRequirements from '@/components/tech-rider/RiderRequirements.vue'
import RiderVersionHistory from '@/components/tech-rider/RiderVersionHistory.vue'
import StagePlotMemberSelector from '@/components/tech-rider/StagePlotMemberSelector.vue'
import TechRiderCompleteness from '@/components/tech-rider/TechRiderCompleteness.vue'
import TechRiderCover from '@/components/tech-rider/TechRiderCover.vue'
import TechRiderPaFoh from '@/components/tech-rider/TechRiderPaFoh.vue'
import TechRiderSidebar from '@/components/tech-rider/TechRiderSidebar.vue'
import TechRiderStagePlot from '@/components/tech-rider/TechRiderStagePlot.vue'
import { useBandProfile } from '@/composables/useBandProfile'
import { useConcerts } from '@/composables/useConcerts'
import { useTechRiderEditor } from '@/composables/useTechRiderEditor'
import { useTechRiders } from '@/composables/useTechRiders'
import { useTechRiderVersions } from '@/composables/useTechRiderVersions'

type Section = 'stage' | 'channels' | 'requirements' | 'pafoh' | 'cover'

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'stage',        label: 'Stage Plot',   icon: '🎭' },
  { key: 'channels',     label: 'Channels',     icon: '🎙️' },
  { key: 'requirements', label: 'Requirements', icon: '🔊' },
  { key: 'pafoh',        label: 'PA / FOH',     icon: '🎛️' },
  { key: 'cover',        label: 'Cover',        icon: '📋' },
]

const openId = ref<number | null>(null)
const activeSection = ref<Section>('stage')

const { list, create, remove, activate } = useTechRiders()
const { query: profileQ } = useBandProfile()
const { query: concertsQ } = useConcerts()

const editor = useTechRiderEditor(openId)
const { draft, dirty, patch, resolved, completeness, setups, members } = editor

const versions = useTechRiderVersions(openId)

const bandProfile = computed(() => profileQ.data.value)
const concerts = computed(() => concertsQ.data.value ?? [])

// ── Navigation guards around unsaved work ─────────────────────────────────────

function confirmDiscard(): boolean {
  return !dirty.value || confirm('This rider has unsaved changes. Discard them?')
}

function openRider(id: number) {
  if (!confirmDiscard()) return
  openId.value = id
  activeSection.value = 'stage'
}

onBeforeRouteLeave(() => confirmDiscard())

// ── Jumping from a derived row back to its musician ───────────────────────────

const focusPlacementId = ref<string | null>(null)

function openPlacement(placementId: string) {
  activeSection.value = 'stage'
  focusPlacementId.value = placementId
}

// ── Rider lifecycle ───────────────────────────────────────────────────────────

const showLineupModal = ref(false)
const showNewModal = ref(false)
const newName = ref('')
const creating = ref(false)
const confirmDeleteId = ref<number | null>(null)

async function createRider() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    const rider = await create.mutateAsync({ name: newName.value.trim(), is_active: false })
    showNewModal.value = false
    newName.value = ''
    openId.value = rider.id
    activeSection.value = 'stage'
    toast.success('Rider created')
  } catch {
    toast.error('Failed to create rider')
  } finally {
    creating.value = false
  }
}

async function confirmDelete() {
  if (!confirmDeleteId.value) return
  try {
    await remove.mutateAsync(confirmDeleteId.value)
    if (openId.value === confirmDeleteId.value) openId.value = null
    confirmDeleteId.value = null
    toast.success('Rider deleted')
  } catch {
    toast.error('Failed to delete')
  }
}

async function setActive(id: number) {
  try {
    await activate.mutateAsync(id)
    toast.success('Active rider updated')
  } catch {
    toast.error('Failed to set active rider')
  }
}

function openPreview() {
  if (openId.value) window.open(`/tech-rider/${openId.value}`, '_blank')
}

// ── Publishing ────────────────────────────────────────────────────────────────

/**
 * Channels the publish gate counts.
 *
 * A row with no instrument is not a channel — it prints as a blank line and the
 * backend rejects it (`inputs.*.instrument` is required), so counting it would
 * unblock Publish only to fail on the save that publishing performs first.
 */
const publishableChannels = computed(
  () => resolved.value.inputs.filter((row) => row.instrument.trim() !== '').length,
)

const showPublishModal = ref(false)
const showVersionsModal = ref(false)

/**
 * Publishing freezes whatever is *stored*, so an unsaved draft has to land
 * first. Doing it here rather than refusing to publish keeps the user out of a
 * save-then-publish two-step whose only purpose would be to avoid this line.
 */
async function publish(notes: string) {
  if (openId.value === null) return
  try {
    // A refused save must stop the publish: `save()` reports its own reason
    // (an unnamed channel, a rejected field), and freezing the rider anyway
    // would publish the last saved state while the user reads about the draft.
    if (dirty.value && !(await editor.save())) return
    const version = await versions.publish.mutateAsync(notes ? { notes } : {})
    showPublishModal.value = false
    toast.success(`Published v${version.version_number} — the rider link now serves it`)
  } catch (e) {
    toast.error(saveErrorMessage(e, 'Failed to publish this rider'))
  }
}

async function discardVersion(id: number) {
  try {
    await versions.discard.mutateAsync(id)
    toast.success('Version deleted')
  } catch {
    toast.error('Could not delete that version')
  }
}
</script>

<template>
  <AdminLayout>
    <div class="rider-shell">
      <TechRiderSidebar
        :riders="list.data.value ?? []"
        :loading="list.isPending.value"
        :error="list.isError.value"
        :open-id="openId"
        @open="openRider"
        @activate="setActive"
        @delete="confirmDeleteId = $event"
        @new="showNewModal = true"
      />

      <main class="editor-pane">
        <div v-if="openId === null" class="empty-state">
          <div class="empty-icon">🎛️</div>
          <div class="empty-title">No rider open</div>
          <p class="empty-hint">Select a rider from the sidebar, or create a new one.</p>
          <button type="button" class="btn-primary-lg" @click="showNewModal = true">Create first rider</button>
        </div>

        <div v-else-if="editor.riderQ.isPending.value" class="empty-state">Loading rider…</div>

        <template v-else-if="editor.riderQ.data.value">
          <!-- Top bar -->
          <div class="editor-topbar">
            <div class="topbar-left">
              <input
                :value="draft.name"
                class="title-input"
                placeholder="Rider name"
                @input="patch('name', ($event.target as HTMLInputElement).value)"
              />
              <div class="topbar-meta">
                <span v-if="draft.is_active" class="badge-active">Active</span>
                <span v-else class="meta-dim">Not active</span>
                <button type="button" class="version-chip" @click="showVersionsModal = true">
                  <template v-if="versions.published.value">
                    v{{ versions.published.value.version_number }} published
                  </template>
                  <template v-else>Never published</template>
                </button>
                <select
                  :value="draft.concert_id ?? ''"
                  class="concert-select"
                  @change="patch('concert_id', Number(($event.target as HTMLSelectElement).value) || null)"
                >
                  <option value="">No concert linked</option>
                  <option v-for="c in concerts" :key="c.id" :value="c.id">
                    {{ c.date }} — {{ c.venue?.name ?? 'Unknown venue' }}
                  </option>
                </select>
              </div>
            </div>

            <div class="topbar-actions">
              <span v-if="dirty" class="dirty-hint">Unsaved changes</span>
              <button type="button" class="btn-ghost" @click="openPreview">Preview / PDF</button>
              <button
                type="button"
                class="btn-publish"
                :disabled="versions.publish.isPending.value"
                @click="showPublishModal = true"
              >
                Publish v{{ versions.nextNumber.value }}
              </button>
              <button
                type="button"
                class="btn-save"
                :class="{ 'btn-save--ok': editor.saved.value }"
                :disabled="editor.saving.value"
                @click="editor.save"
              >
                {{ editor.saved.value ? 'Saved ✓' : editor.saving.value ? 'Saving…' : 'Save rider' }}
              </button>
            </div>
          </div>

          <!-- Section tabs -->
          <div class="section-tabs">
            <button
              v-for="s in SECTIONS"
              :key="s.key"
              type="button"
              class="section-tab"
              :class="{ active: activeSection === s.key }"
              @click="activeSection = s.key"
            >
              <span class="tab-icon">{{ s.icon }}</span>{{ s.label }}
              <span v-if="s.key === 'channels'" class="tab-count">{{ resolved.inputs.length }}</span>
            </button>
          </div>

          <!-- Sections -->
          <div class="section-content" :class="{ 'section-content--stage': activeSection === 'stage' }">
            <template v-if="activeSection === 'stage'">
              <div class="stage-toolbar">
                <div class="lineup-avatars">
                  <div
                    v-for="m in members.filter(m => m.is_current)"
                    :key="m.id"
                    class="lineup-avatar"
                    :title="m.nickname ?? `${m.first_name} ${m.last_name}`"
                  >
                    <img v-if="m.photo" :src="m.photo" class="avatar-img" />
                    <span v-else>{{ (m.first_name[0] ?? '') + (m.last_name[0] ?? '') }}</span>
                  </div>
                  <div
                    v-for="t in draft.gig_lineup.temp_musicians"
                    :key="t.id"
                    class="lineup-avatar lineup-avatar--guest"
                    :title="t.name"
                  >{{ t.name[0]?.toUpperCase() }}</div>
                </div>
                <button type="button" class="btn-ghost btn-ghost--sm" @click="showLineupModal = true">
                  ✏️ Edit lineup
                </button>
              </div>

              <div class="stage-wrapper">
                <TechRiderStagePlot
                  :model-value="draft.placements"
                  :lineup="draft.gig_lineup"
                  :band-members="members"
                  :setups="setups"
                  :public-token="editor.riderQ.data.value?.public_token"
                  :focus-id="focusPlacementId"
                  :promoting="editor.promoting.value"
                  @update:model-value="patch('placements', $event)"
                  @promote="editor.promotePlacement"
                  @focus-handled="focusPlacementId = null"
                />
              </div>

              <TechRiderCompleteness :completeness="completeness" @open="openPlacement" />
            </template>

            <RiderChannelList
              v-else-if="activeSection === 'channels'"
              :rows="resolved.inputs"
              :extras="draft.extra_inputs"
              :channel-order="draft.channel_order"
              @update:extras="patch('extra_inputs', $event)"
              @update:channel-order="patch('channel_order', $event)"
              @open="openPlacement"
            />

            <RiderRequirements
              v-else-if="activeSection === 'requirements'"
              :resolved="resolved"
              :extra-monitors="draft.extra_monitors"
              :extra-backline="draft.extra_backline"
              :extra-wireless="draft.extra_wireless"
              :power-notes="draft.power_notes"
              @update:extra-monitors="patch('extra_monitors', $event)"
              @update:extra-backline="patch('extra_backline', $event)"
              @update:extra-wireless="patch('extra_wireless', $event)"
              @update:power-notes="patch('power_notes', $event)"
              @open="openPlacement"
            />

            <TechRiderPaFoh
              v-else-if="activeSection === 'pafoh'"
              :model-value="draft.pa_foh"
              @update:model-value="patch('pa_foh', $event)"
            />

            <TechRiderCover
              v-else-if="activeSection === 'cover'"
              :profile="bandProfile ?? null"
              :rider-name="draft.name"
            />
          </div>
        </template>
      </main>
    </div>

    <RiderPublishModal
      :open="showPublishModal"
      :next-number="versions.nextNumber.value"
      :completeness="completeness"
      :channel-count="publishableChannels"
      :current="versions.published.value"
      :dirty="dirty"
      :publishing="versions.publish.isPending.value"
      @close="showPublishModal = false"
      @publish="publish"
    />

    <RiderVersionHistory
      :open="showVersionsModal"
      :versions="versions.versions.value"
      :loading="versions.query.isPending.value"
      :discarding="versions.discard.isPending.value"
      @close="showVersionsModal = false"
      @discard="discardVersion"
    />

    <AdminModal :open="showLineupModal" title="Tonight's Lineup" max-width="38rem" @close="showLineupModal = false">
      <StagePlotMemberSelector
        :model-value="draft.gig_lineup"
        :band-members="members"
        @update:model-value="patch('gig_lineup', $event)"
        @close="showLineupModal = false"
      />
    </AdminModal>

    <AdminModal :open="showNewModal" title="New Rider" max-width="28rem" @close="showNewModal = false">
      <form class="modal-form" @submit.prevent="createRider">
        <div>
          <label class="field-label">Rider name</label>
          <input v-model="newName" class="field-input" placeholder="e.g. Festival rider, Club show" autofocus />
          <p class="field-hint">
            Riders reference each musician's saved rig, so a new one is ready as soon
            as you place people on the stage plot.
          </p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="showNewModal = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="!newName.trim() || creating">
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </form>
    </AdminModal>

    <AdminModal :open="confirmDeleteId !== null" title="Delete rider?" max-width="24rem" @close="confirmDeleteId = null">
      <div class="modal-form">
        <p class="confirm-text">
          This deletes the rider and its stage plot. The musicians' saved rigs are not affected.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="confirmDeleteId = null">Cancel</button>
          <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.rider-shell { display: flex; height: 100vh; overflow: hidden; }

.editor-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }

.empty-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.75rem; text-align: center; padding: 2rem; color: #475569; font-size: 0.875rem;
}
.empty-icon { font-size: 3rem; }
.empty-title { font-size: 1.1rem; font-weight: 700; color: #e2e8f0; }
.empty-hint { max-width: 28rem; }
.btn-primary-lg {
  padding: 0.6rem 1.5rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111; margin-top: 0.5rem;
}

/* Top bar */
.editor-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.75rem 1.25rem; border-bottom: 1px solid #1a1a1a; background: #0d0d0d; flex-shrink: 0;
}
.topbar-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.title-input {
  background: transparent; border: none; outline: none; padding: 0;
  font-size: 1rem; font-weight: 700; color: #e2e8f0; font-family: inherit; width: 100%;
  border-bottom: 1px solid transparent; transition: border-color 120ms;
}
.title-input:focus { border-bottom-color: #444444; }
.topbar-meta { display: flex; align-items: center; gap: 0.625rem; }
.meta-dim { font-size: 0.7rem; color: #334155; }
.badge-active {
  font-size: 0.6rem; font-weight: 700; color: #4ade80; background: #052e16;
  padding: 0.1rem 0.4rem; border-radius: 999px; text-transform: uppercase;
}
.concert-select {
  height: 1.6rem; font-size: 0.72rem; padding: 0 0.4rem; max-width: 16rem;
  background: #0d0d0d; border: 1px solid #2a2a2a; color: #94a3b8;
  border-radius: 0.3rem; cursor: pointer; outline: none; font-family: inherit;
}
.concert-select:focus { border-color: #444444; }
.concert-select option { background: #0d0d0d; }

.topbar-actions { display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; }
.dirty-hint { font-size: 0.7rem; color: #fbbf24; }

/* The rider's published state, and the way into its history. */
.version-chip {
  font-size: 0.65rem; font-weight: 600; color: #64748b;
  background: #141414; border: 1px solid #262626; border-radius: 999px;
  padding: 0.1rem 0.5rem; cursor: pointer; font-family: inherit;
}
.version-chip:hover { color: #94a3b8; border-color: #3f3f3f; }

.btn-publish {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #166534; color: #4ade80;
}
.btn-publish:hover { background: #052e16; }
.btn-publish:disabled { opacity: 0.5; cursor: default; }

/* Tabs */
.section-tabs {
  display: flex; overflow-x: auto; border-bottom: 1px solid #1a1a1a;
  background: #0d0d0d; flex-shrink: 0; scrollbar-width: none;
}
.section-tabs::-webkit-scrollbar { display: none; }
.section-tab {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.5rem 0.875rem; font-size: 0.75rem; font-weight: 500; color: #475569;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; white-space: nowrap; margin-bottom: -1px;
  transition: color 120ms, border-color 120ms;
}
.section-tab:hover { color: #64748b; }
.section-tab.active { color: #d0d0d0; border-bottom-color: #888888; }
.tab-icon { font-size: 0.85rem; }
.tab-count {
  font-size: 0.62rem; font-weight: 700; color: #94a3b8;
  background: #1a1a1a; border-radius: 999px; padding: 0.05rem 0.35rem;
}

/* Content */
.section-content {
  flex: 1; overflow-y: auto; padding: 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
}
.section-content--stage { overflow: hidden; padding: 0.75rem; }

.stage-toolbar { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
.lineup-avatars { display: flex; }
.lineup-avatar {
  width: 1.75rem; height: 1.75rem; border-radius: 50%;
  background: #3730a3; color: #fff; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem; font-weight: 700;
  border: 2px solid #0a0b1a; margin-left: -0.5rem;
}
.lineup-avatar:first-child { margin-left: 0; }
.lineup-avatar--guest { background: #92400e; color: #fde68a; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.stage-wrapper {
  flex: 1; min-height: 360px; overflow: hidden; border-radius: 0.5rem;
  border: 1px solid #2a2a2a; background: #0a0b1a;
}

/* Buttons */
.btn-save {
  padding: 0.45rem 1.25rem; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111; min-width: 7.5rem;
}
.btn-save:disabled { opacity: 0.55; cursor: default; }
.btn-save--ok { background: #166534 !important; color: #dcfce7; }

.btn-ghost {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
}
.btn-ghost:hover { border-color: #444444; color: #94a3b8; }
.btn-ghost--sm { padding: 0.25rem 0.6rem; font-size: 0.72rem; }

.btn-primary {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
}
.btn-primary:disabled { opacity: 0.45; cursor: default; }
.btn-danger {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}

.modal-form { display: flex; flex-direction: column; gap: 1rem; }
.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.confirm-text { font-size: 0.875rem; color: #94a3b8; line-height: 1.6; }

@media print {
  .editor-topbar, .section-tabs { display: none !important; }
  .rider-shell { height: auto; }
  .editor-pane { overflow: visible; }
  .section-content { overflow: visible; padding: 0; }
}
</style>
