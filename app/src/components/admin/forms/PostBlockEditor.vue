<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, nextTick, ref } from 'vue'
import { defaultPayload, move } from '@/utils/postBlocks'
import type { PostBlockDraft, PostBlockType } from '@/types/post'
import TextBlockEditor  from './blocks/TextBlockEditor.vue'
import ImageBlockEditor from './blocks/ImageBlockEditor.vue'
import EmbedBlockEditor from './blocks/EmbedBlockEditor.vue'
import RefBlockEditor   from './blocks/RefBlockEditor.vue'
import type { RefEntityLists } from './blocks/RefBlockEditor.vue'

const { t } = useI18n()

const props = defineProps<{ modelValue: PostBlockDraft[]; entities: RefEntityLists }>()
const emit = defineEmits<{ 'update:modelValue': [PostBlockDraft[]] }>()

const TYPE_LABELS = computed<Record<PostBlockType, string>>(() => ({
  text: t('content.blocks.kind.text'),
  image: t('content.blocks.kind.image'),
  embed: t('content.blocks.kind.embed'),
  ref: t('content.blocks.kind.ref'),
}))

const list = ref<HTMLElement | null>(null)

// A new block lands at the end, so bring it into view and put the caret in
// its first field — otherwise the writer presses "+ Text" and sees nothing
// happen above a list that has already overflowed the modal.
async function add(type: PostBlockType) {
  emit('update:modelValue', [...props.modelValue, { type, payload: defaultPayload(type) }])
  await nextTick()
  const rows = list.value?.querySelectorAll<HTMLElement>('.block-row')
  const last = rows?.[rows.length - 1]
  if (!last) return
  last.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  last.querySelector<HTMLElement>('textarea, input, select')?.focus({ preventScroll: true }) // i18n-ignore: CSS selector
}

function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}

function moveBy(i: number, delta: number) {
  const to = i + delta
  if (to < 0 || to >= props.modelValue.length) return
  emit('update:modelValue', move(props.modelValue, i, to))
}

function setPayload(i: number, payload: Record<string, unknown>) {
  // Clears any dangling-ref warning too: once the admin edits the block
  // (e.g. picks a replacement item), the flag no longer applies.
  emit('update:modelValue', props.modelValue.map((b, idx) => (idx === i ? { ...b, payload, dangling: false } : b)))
}

// Native HTML5 drag, matching SocialLinksEditor — no library. The row is only
// draggable while its grip is held: a row that is always draggable turns a
// text selection inside one of its textareas into a row drag.
let dragFrom = -1
const dragArmed = ref(-1)
const dragOverIndex = ref(-1)

function onDrop(to: number) {
  if (dragFrom >= 0) emit('update:modelValue', move(props.modelValue, dragFrom, to))
  endDrag()
}

function endDrag() {
  dragFrom = -1
  dragArmed.value = -1
  dragOverIndex.value = -1
}

// Keyboard path for the grip: arrows move the block, and focus follows it
// so a second press keeps moving the same block.
async function onGripKeydown(e: KeyboardEvent, i: number) {
  const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0 // i18n-ignore: key names, not copy
  if (!delta) return
  e.preventDefault()
  moveBy(i, delta)
  await nextTick()
  list.value?.querySelectorAll<HTMLElement>('.block-grip')[i + delta]?.focus()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3 mb-2">
      <h3 class="section-title" style="margin-bottom:0;">{{ $t('content.blocks.title') }}</h3>
      <slot name="tools" />
    </div>

    <p v-if="modelValue.length === 0" class="empty-hint">
      {{ $t('content.blocks.empty') }}
    </p>

    <div ref="list" class="flex flex-col gap-2">
      <div v-for="(block, i) in modelValue" :key="i"
           class="block-row" :class="{ 'block-row--over': dragOverIndex === i }"
           :draggable="dragArmed === i"
           @dragstart="dragFrom = i"
           @dragend="endDrag"
           @dragover.prevent="dragOverIndex = i"
           @dragleave="dragOverIndex = -1"
           @drop.prevent="onDrop(i)">
        <div class="block-head">
          <button type="button" class="block-grip"
                  :aria-label="$t('content.blocks.dragHandle')" :title="$t('content.blocks.dragHandle')"
                  @pointerdown="dragArmed = i" @pointerup="dragArmed = -1"
                  @keydown="onGripKeydown($event, i)">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
          </button>
          <span class="block-type">{{ TYPE_LABELS[block.type] }}</span>
          <span class="block-pos">{{ i + 1 }}</span>
          <span class="block-head-spacer" />
          <button type="button" class="btn-icon" :disabled="i === 0"
                  :aria-label="$t('content.blocks.moveUp')" :title="$t('content.blocks.moveUp')" @click="moveBy(i, -1)">
            <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button type="button" class="btn-icon" :disabled="i === modelValue.length - 1"
                  :aria-label="$t('content.blocks.moveDown')" :title="$t('content.blocks.moveDown')" @click="moveBy(i, 1)">
            <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button type="button" class="btn-icon btn-icon--danger"
                  :aria-label="$t('content.blocks.remove')" :title="$t('content.blocks.remove')" @click="remove(i)">
            <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <p v-if="block.dangling" class="block-dangling" role="status">
          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{{ $t('content.blocks.danglingRef') }}</span>
        </p>

        <TextBlockEditor  v-if="block.type === 'text'"  :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <ImageBlockEditor v-else-if="block.type === 'image'" :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <EmbedBlockEditor v-else-if="block.type === 'embed'" :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <RefBlockEditor   v-else :payload="block.payload" :entities="entities" @update:payload="setPayload(i, $event)" />
      </div>
    </div>

    <!-- The add bar sits where a new block will appear. -->
    <div class="block-add-bar" :class="{ 'block-add-bar--first': modelValue.length === 0 }">
      <span class="block-add-label">{{ $t('content.blocks.add') }}</span>
      <button v-for="(label, type) in TYPE_LABELS" :key="type" type="button"
              class="btn-add-block" @click="add(type as PostBlockType)">+ {{ label }}</button>
    </div>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
/* touch-action: the row becomes draggable="true" while its grip is held, for
   mouse reordering; without this, a touch drag started on a row is captured as
   a native HTML5 drag instead of a scroll. Once enough blocks exist to fill the
   modal's scrollable area, every touch point lands on a row and scrolling the
   modal becomes impossible on touch input. "pinch-zoom" is kept alongside
   "pan-y" so this doesn't trade that bug for blocking pinch-to-zoom on the
   same rows. Touch users reorder with the up/down buttons instead. */
.block-row {
  border: 1px solid var(--c-222222);
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem 0.75rem;
  background: var(--c-111111);
  touch-action: pan-y pinch-zoom;
  transition: border-color 120ms;
}
.block-row--over { border-color: var(--c-e2e8f0); }
.block-head { display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.5rem; }
.block-head-spacer { flex: 1; }
.block-grip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.5rem; height: 1.75rem; margin-left: -0.25rem;
  border: none; border-radius: 0.375rem; background: transparent;
  color: var(--c-888888); cursor: grab;
  transition: color 120ms, background 120ms;
}
.block-grip svg { width: 1rem; height: 1rem; }
.block-grip:hover { color: var(--c-e2e8f0); background: var(--c-2a2a2a); }
.block-grip:active { cursor: grabbing; }
.block-type { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c-aaaaaa); }
.block-pos { font-size: var(--fs-2xs); color: var(--c-888888); font-variant-numeric: tabular-nums; }
.empty-hint { font-size: var(--fs-sm); color: var(--c-888888); padding: 0.5rem 0 0.25rem; line-height: 1.5; }
.block-dangling {
  display: flex; align-items: flex-start; gap: 0.5rem;
  font-size: var(--fs-xs); color: var(--c-f87171); background: var(--c-3f1212);
  border-radius: 0.375rem; padding: 0.4rem 0.6rem; margin-bottom: 0.5rem; line-height: 1.45;
}
.block-dangling svg { width: 0.875rem; height: 0.875rem; flex-shrink: 0; margin-top: 0.1rem; }

.block-add-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem;
  margin-top: 0.625rem; padding-top: 0.625rem;
  border-top: 1px dashed var(--c-2a2a2a);
}
.block-add-bar--first { border-top: none; padding-top: 0; margin-top: 0.25rem; }
.block-add-label { font-size: var(--fs-xs); color: var(--c-888888); margin-right: 0.25rem; }
.btn-add-block {
  font-size: var(--fs-xs); font-weight: 500;
  padding: 0.3rem 0.625rem; border-radius: 0.375rem;
  border: 1px solid var(--c-333333); background: transparent; color: var(--c-c0c0c0);
  cursor: pointer; transition: background 120ms, color 120ms, border-color 120ms;
}
.btn-add-block:hover { background: var(--c-2a2a2a); color: var(--c-e2e8f0); border-color: var(--c-444444); }

@media (prefers-reduced-motion: reduce) { .block-row { transition: none; } }
</style>
