<script setup lang="ts">
/**
 * The confirm step before a rider is frozen and sent.
 *
 * Publishing is the moment the rider stops being live: whatever is on screen
 * becomes what the promoter sees for good. So this dialog does two things —
 * it names anything still missing, and it says plainly what publishing will do
 * to the link the venue already has.
 */
import { computed, ref, watch } from 'vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import type { RiderCompleteness } from '@bandms/rider-core'
import type { TechRiderVersion } from '@bandms/rider-core'

const props = defineProps<{
  open: boolean
  /** Version number this publish will create. */
  nextNumber: number
  completeness: RiderCompleteness
  channelCount: number
  /** The version the public link serves today, if any. */
  current: TechRiderVersion | null
  /** Unsaved editor changes — saved as part of publishing, not lost. */
  dirty: boolean
  publishing: boolean
}>()

const emit = defineEmits<{ close: []; publish: [notes: string] }>()

const notes = ref('')

// A fresh dialog every time: last publish's note must not ride along silently
// onto the next version's record.
watch(() => props.open, (open) => { if (open) notes.value = '' })

/**
 * The one condition that stops a publish outright.
 *
 * A rider with no channels is not an incomplete document, it is a blank one:
 * the engineer receives an empty input sheet and has nothing to patch. There is
 * no gig at which sending that is the right thing to do, so it is a lock rather
 * than a warning.
 */
const fatal = computed<string[]>(() =>
  props.channelCount
    ? []
    : ['The channel list is empty — the engineer would get a blank input sheet.'],
)

/**
 * What is not ready, in the promoter's terms rather than the data's.
 *
 * These stay warnings on purpose. A rider is routinely sent while one musician
 * is still confirming their rig, and an editor that refuses in that state just
 * gets worked around — the useful thing is to name the gap so that sending
 * anyway is a deliberate act rather than an oversight.
 */
const warnings = computed<string[]>(() => {
  const out: string[] = []

  if (!props.completeness.total) {
    out.push('No musicians are placed on the stage plot.')
  }
  for (const status of props.completeness.statuses.filter((s) => !s.complete)) {
    out.push(`${status.name} has no ${status.missing.join(', ')}.`)
  }

  return out
})

const blocked = computed(() => fatal.value.length > 0)
const ready = computed(() => !blocked.value && warnings.value.length === 0)
</script>

<template>
  <AdminModal
    :open="open"
    :title="`Publish v${nextNumber}`"
    max-width="32rem"
    @close="emit('close')"
  >
    <div class="publish-form">
      <p class="lede">
        This freezes the rider as it stands now. The public link keeps serving
        <strong>v{{ nextNumber }}</strong> even if a musician edits their saved rig afterwards.
      </p>

      <div class="summary">
        <div class="summary-item">
          <span class="summary-value">{{ completeness.total }}</span>
          <span class="summary-label">musicians</span>
        </div>
        <div class="summary-item">
          <span class="summary-value" :class="{ 'summary-value--stop': blocked }">{{ channelCount }}</span>
          <span class="summary-label">channels</span>
        </div>
        <div class="summary-item">
          <span class="summary-value" :class="{ 'summary-value--warn': !ready }">
            {{ completeness.complete }}/{{ completeness.total }}
          </span>
          <span class="summary-label">rigs ready</span>
        </div>
      </div>

      <div v-if="blocked" class="stop">
        <div class="stop-title">Can't publish yet</div>
        <ul class="stop-list">
          <li v-for="(reason, i) in fatal" :key="i">{{ reason }}</li>
        </ul>
        <p class="stop-hint">
          Place a musician on the stage plot, or add an extra channel under Channels.
        </p>
      </div>

      <div v-if="warnings.length" class="warn">
        <div class="warn-title">{{ blocked ? 'Also missing' : 'Publish anyway?' }}</div>
        <ul class="warn-list">
          <li v-for="(warning, i) in warnings" :key="i">{{ warning }}</li>
        </ul>
      </div>

      <p v-if="current" class="note-line">
        v{{ current.version_number }} becomes archived, but its own link keeps working —
        anyone you already sent it to still sees exactly what they were sent.
      </p>

      <p v-if="dirty" class="note-line note-line--dirty">
        Your unsaved changes are saved first, so v{{ nextNumber }} includes them.
      </p>

      <div>
        <label class="field-label" for="publish-notes">What changed? <span class="optional">(optional)</span></label>
        <input
          id="publish-notes"
          v-model="notes"
          class="field-input"
          placeholder="e.g. Added talkback + moved Ola stage left"
          maxlength="1000"
        />
        <p class="field-hint">Shown in the version history so you can tell v{{ nextNumber }} from v{{ nextNumber - 1 }}.</p>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-ghost" @click="emit('close')">Cancel</button>
        <button
          type="button"
          class="btn-primary"
          :disabled="publishing || blocked"
          :title="blocked ? fatal[0] : undefined"
          @click="emit('publish', notes.trim())"
        >
          {{ publishing ? 'Publishing…' : ready ? `Publish v${nextNumber}` : `Publish v${nextNumber} anyway` }}
        </button>
      </div>
    </div>
  </AdminModal>
</template>

<style scoped src="../admin/form-styles.css" />
<style scoped>
.publish-form { display: flex; flex-direction: column; gap: 1rem; }

.lede { font-size: 0.8rem; color: #94a3b8; line-height: 1.6; margin: 0; }
.lede strong { color: #e2e8f0; }

.summary {
  display: flex; gap: 1.5rem; padding: 0.75rem 1rem;
  border: 1px solid #1f1f1f; border-radius: 0.5rem; background: #0d0d0d;
}
.summary-item { display: flex; flex-direction: column; gap: 0.1rem; }
.summary-value { font-size: 1.1rem; font-weight: 700; color: #e2e8f0; line-height: 1; }
.summary-value--warn { color: #fbbf24; }
.summary-value--stop { color: #f87171; }
.summary-label { font-size: 0.65rem; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }

/* A stop, not a nag: this is the one thing that disables the button. */
.stop {
  border: 1px solid #991b1b; border-radius: 0.5rem;
  background: #1c0a0a; padding: 0.7rem 0.9rem;
}
.stop-title { font-size: 0.75rem; font-weight: 700; color: #f87171; margin-bottom: 0.35rem; }
.stop-list { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.2rem; }
.stop-list li { font-size: 0.75rem; color: #e0a5a5; line-height: 1.5; }
.stop-hint { font-size: 0.72rem; color: #9a6a6a; margin: 0.4rem 0 0; line-height: 1.5; }

.warn {
  border: 1px solid #78350f; border-radius: 0.5rem;
  background: #1c1207; padding: 0.7rem 0.9rem;
}
.warn-title { font-size: 0.75rem; font-weight: 700; color: #fbbf24; margin-bottom: 0.35rem; }
.warn-list { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.2rem; }
.warn-list li { font-size: 0.75rem; color: #d6bd8b; line-height: 1.5; }

.note-line { font-size: 0.72rem; color: #475569; line-height: 1.55; margin: 0; }
.note-line--dirty { color: #94a3b8; }

.optional { color: #475569; font-weight: 400; }

.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.btn-ghost {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
}
.btn-ghost:hover { border-color: #444444; color: #94a3b8; }
.btn-primary {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
}
.btn-primary:disabled { opacity: 0.45; cursor: default; }
</style>
