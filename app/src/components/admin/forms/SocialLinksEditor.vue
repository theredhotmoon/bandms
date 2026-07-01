<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { SOCIAL_PLATFORMS } from '@/types/socialLink'
import type { SocialPlatform, SocialLinkPayload } from '@/types/socialLink'

interface Props {
  modelValue: SocialLinkPayload[]
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Social links',
})

const emit = defineEmits<{
  'update:modelValue': [links: SocialLinkPayload[]]
}>()

const platformMap = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.key, p]),
) as Record<SocialPlatform, (typeof SOCIAL_PLATFORMS)[0]>

const ALL_PLATFORMS = SOCIAL_PLATFORMS.map((p) => p.key)

const urls = reactive<Record<SocialPlatform, string>>({
  spotify: '', instagram: '', facebook: '', youtube: '',
  tiktok: '', bandcamp: '', soundcloud: '', twitter: '', website: '',
})

const orderedPlatforms = ref<SocialPlatform[]>([...ALL_PLATFORMS])

// When true, skip the next watch fire (triggered by our own emit).
let ignoreNextWatch = false

function initFromValue(val: SocialLinkPayload[]) {
  for (const p of ALL_PLATFORMS) urls[p] = ''
  for (const l of val) urls[l.platform] = l.url

  const saved = val.map((l) => l.platform)
  const unsaved = ALL_PLATFORMS.filter((p) => !saved.includes(p))
  orderedPlatforms.value = [...saved, ...unsaved]
}

watch(
  () => props.modelValue,
  (val) => {
    if (ignoreNextWatch) {
      ignoreNextWatch = false
      return
    }
    initFromValue(val ?? [])
  },
  { immediate: true },
)

function emitLinks() {
  ignoreNextWatch = true
  emit(
    'update:modelValue',
    orderedPlatforms.value
      .filter((p) => urls[p].trim())
      .map((p) => ({ platform: p, url: urls[p].trim() })),
  )
}

// ── Drag-and-drop ──────────────────────────────────────────────────────────────

let dragFrom = -1
const dragOverIndex = ref(-1)

function onDragStart(index: number, event: DragEvent) {
  dragFrom = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(toIndex: number, event: DragEvent) {
  event.preventDefault()
  dragOverIndex.value = -1
  if (dragFrom === -1 || dragFrom === toIndex) {
    dragFrom = -1
    return
  }

  const next = [...orderedPlatforms.value]
  const [moved] = next.splice(dragFrom, 1)
  next.splice(toIndex, 0, moved)
  orderedPlatforms.value = next
  dragFrom = -1
  emitLinks()
}

function onDragEnd() {
  dragFrom = -1
  dragOverIndex.value = -1
}
</script>

<template>
  <div class="social-links-editor">
    <div class="social-links-editor__heading">{{ label }}</div>
    <div class="social-links-editor__list">
      <div
        v-for="(platform, i) in orderedPlatforms"
        :key="platform"
        class="social-links-editor__row"
        :class="{ 'social-links-editor__row--drag-over': dragOverIndex === i }"
        draggable="true"
        @dragstart="onDragStart(i, $event)"
        @dragover="onDragOver(i, $event)"
        @drop="onDrop(i, $event)"
        @dragend="onDragEnd"
      >
        <span
          class="social-links-editor__handle"
          aria-hidden="true"
          title="Drag to reorder"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2"  r="1.5" /><circle cx="7" cy="2"  r="1.5" />
            <circle cx="3" cy="7"  r="1.5" /><circle cx="7" cy="7"  r="1.5" />
            <circle cx="3" cy="12" r="1.5" /><circle cx="7" cy="12" r="1.5" />
          </svg>
        </span>
        <span
          class="social-links-editor__dot"
          :style="{ background: platformMap[platform].color }"
          aria-hidden="true"
        />
        <span class="social-links-editor__name">{{ platformMap[platform].label }}</span>
        <input
          v-model="urls[platform]"
          class="field-input social-links-editor__input"
          type="url"
          :placeholder="`${platformMap[platform].label} URL…`"
          :aria-label="platformMap[platform].label"
          @input="emitLinks"
        />
      </div>
    </div>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.social-links-editor__heading {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #d0d0d0;
  margin-bottom: 0.5rem;
}

.social-links-editor__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.social-links-editor__row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  border-top: 2px solid transparent;
  transition: border-color 0.1s;
}

.social-links-editor__row--drag-over {
  border-top-color: var(--color-accent, #1f8f7a);
}

.social-links-editor__handle {
  cursor: grab;
  color: #4b5563;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 2px;
  user-select: none;
}

.social-links-editor__handle:active {
  cursor: grabbing;
}

.social-links-editor__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.social-links-editor__name {
  font-size: 0.75rem;
  font-weight: 500;
  color: #94a3b8;
  width: 7rem;
  flex-shrink: 0;
}

.social-links-editor__input {
  flex: 1;
}
</style>
