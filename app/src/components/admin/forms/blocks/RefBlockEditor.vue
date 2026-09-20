<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import ClipCategoryPicker from '@/components/admin/forms/ClipCategoryPicker.vue'
import { useClips } from '@/composables/useClips'
import { detectProvider, providerLabel } from '@/utils/postBlocks'
import { reportSaveError } from '@/utils/formErrors'
import type { RefEntity } from '@/types/post'

export interface RefEntityLists {
  concert:       { id: number; label: string }[]
  album:         { id: number; label: string }[]
  release:       { id: number; label: string }[]
  music_video:   { id: number; label: string }[]
  press_release: { id: number; label: string }[]
  shop_item:     { id: number; label: string }[]
  clip:          { id: number; label: string }[]
}

const props = defineProps<{ payload: Record<string, unknown>; entities: RefEntityLists }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

// `tour` is absent on purpose: tours have no public page, so a tour reference
// could only link somewhere that isn't built.
const ENTITY_LABELS: Record<RefEntity, string> = {
  concert: 'Concert', album: 'Photo album', release: 'Release',
  music_video: 'Music video', press_release: 'Press coverage', shop_item: 'Shop item',
  clip: 'Clip',
}

const entity = computed(() => (props.payload.entity as RefEntity) ?? 'concert')
const items  = computed(() => props.entities[entity.value] ?? [])

function setEntity(value: RefEntity) {
  // Reset the id: an id from the previous list means nothing in the new one.
  addingClip.value = false
  emit('update:payload', { ...props.payload, entity: value, id: 0 })
}

// "Add a new clip…" creates the clip in the library first (POST /api/clips),
// then points this block at it. The clip stays in the library even if the
// post is never saved — it was explicitly created, and the library is the
// source of truth.
const { create: createClip } = useClips()
const addingClip = ref(false)
const newClipUrl = ref('')
const newClipCategory = ref('live')
const newClipConcert = ref<number | ''>('')

async function attachNewClip() {
  const url = newClipUrl.value.trim()
  if (!url) return
  try {
    const clip = await createClip.mutateAsync({
      url,
      category: newClipCategory.value,
      attach: newClipConcert.value ? [{ type: 'concert', id: Number(newClipConcert.value) }] : [],
    })
    emit('update:payload', { ...props.payload, entity: 'clip', id: clip.id })
    addingClip.value = false
    newClipUrl.value = ''
    toast.success('Clip added to the library')
  } catch (e) { reportSaveError(e, 'Failed to add clip') }
}

function onClipSelect(value: string) {
  if (value === '__new__') { addingClip.value = true; return }
  addingClip.value = false
  emit('update:payload', { ...props.payload, id: Number(value) || 0 })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <select :value="entity" @change="setEntity(($event.target as HTMLSelectElement).value as RefEntity)"
              class="field-input" style="width:11rem; flex-shrink:0;">
        <option v-for="(label, key) in ENTITY_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <!-- The placeholder's value must be "" — the HTML spec only treats an
           option with no value (or an empty one) as a select's "placeholder
           label option", which is what makes a required select actually block
           submission while it's the selected one. A non-empty placeholder value
           (id 0, say) is a normal option as far as the browser is concerned,
           so `required` never engages and an incomplete block reaches the
           server with no client-side warning at all. -->
      <select v-if="entity !== 'clip'" :value="(payload.id as number) ? String(payload.id) : ''"
              @change="emit('update:payload', { ...payload, id: Number(($event.target as HTMLSelectElement).value) || 0 })"
              class="field-input flex-1" required>
        <option value="" disabled>Choose an item…</option>
        <option v-for="i in items" :key="i.id" :value="i.id">{{ i.label }}</option>
      </select>

      <!-- `required` is dropped while the add panel is open so the Attach
           button can be clicked without the browser demanding a selection;
           once attached, payload.id is set and the select shows it. -->
      <select v-else :value="addingClip ? '__new__' : ((payload.id as number) ? String(payload.id) : '')"
              @change="onClipSelect(($event.target as HTMLSelectElement).value)"
              class="field-input flex-1" :required="!addingClip" data-testid="clip-select">
        <option value="" disabled>Choose a clip…</option>
        <option value="__new__">＋ Add a new clip…</option>
        <option v-for="i in items" :key="i.id" :value="i.id">{{ i.label }}</option>
      </select>
    </div>

    <div v-if="entity === 'clip' && addingClip" class="new-clip" data-testid="new-clip">
      <div class="flex items-center gap-2">
        <input v-model="newClipUrl" type="url" class="field-input flex-1" placeholder="Paste a video URL…" data-testid="new-clip-url" />
        <span v-if="newClipUrl" class="provider-badge">{{ providerLabel(detectProvider(newClipUrl)) }}</span>
      </div>
      <ClipCategoryPicker v-model="newClipCategory" />
      <div class="flex gap-2 items-center">
        <select v-model="newClipConcert" class="field-input flex-1" data-testid="new-clip-concert">
          <option value="">No concert</option>
          <option v-for="c in entities.concert" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
        <button type="button" class="btn-attach" :disabled="createClip.isPending.value || !newClipUrl.trim()" @click="attachNewClip">Attach</button>
      </div>
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
<style scoped>
.new-clip { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.6rem; border: 1px dashed #3f3f46; border-radius: 0.5rem; }
.provider-badge { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.25rem 0.5rem; border-radius: 0.25rem; flex-shrink: 0; background: #1e3a5f; color: #60a5fa; text-transform: uppercase; }
.btn-attach { flex-shrink: 0; padding: 0.4rem 0.875rem; border-radius: 0.375rem; border: 1px solid #555555; background: #2a2a2a; color: #d0d0d0; font-size: 0.8125rem; cursor: pointer; }
.btn-attach:disabled { opacity: .5; cursor: default; }
</style>
