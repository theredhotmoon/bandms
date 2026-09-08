<script setup lang="ts">
import { ref } from 'vue'
import { defaultPayload, move } from '@/utils/postBlocks'
import type { PostBlockDraft, PostBlockType } from '@/types/post'
import TextBlockEditor  from './blocks/TextBlockEditor.vue'
import ImageBlockEditor from './blocks/ImageBlockEditor.vue'
import EmbedBlockEditor from './blocks/EmbedBlockEditor.vue'
import RefBlockEditor   from './blocks/RefBlockEditor.vue'
import type { RefEntityLists } from './blocks/RefBlockEditor.vue'

const props = defineProps<{ modelValue: PostBlockDraft[]; entities: RefEntityLists }>()
const emit = defineEmits<{ 'update:modelValue': [PostBlockDraft[]] }>()

const TYPE_LABELS: Record<PostBlockType, string> = {
  text: 'Text', image: 'Image', embed: 'Embed / link', ref: 'Reference',
}

function add(type: PostBlockType) {
  emit('update:modelValue', [...props.modelValue, { type, payload: defaultPayload(type) }])
}

function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}

function setPayload(i: number, payload: Record<string, unknown>) {
  emit('update:modelValue', props.modelValue.map((b, idx) => (idx === i ? { ...b, payload } : b)))
}

// Native HTML5 drag, matching SocialLinksEditor — no library.
let dragFrom = -1
const dragOverIndex = ref(-1)

function onDrop(to: number) {
  if (dragFrom >= 0) emit('update:modelValue', move(props.modelValue, dragFrom, to))
  dragFrom = -1
  dragOverIndex.value = -1
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <label class="field-label mb-0">Content blocks</label>
      <div class="flex gap-1">
        <button v-for="(label, type) in TYPE_LABELS" :key="type" type="button"
                class="btn-add" @click="add(type as PostBlockType)">+ {{ label }}</button>
      </div>
    </div>

    <p v-if="modelValue.length === 0" class="empty-hint">
      No blocks yet. Add text, an image, an embed or a reference — they render in this order.
    </p>

    <div class="flex flex-col gap-2">
      <div v-for="(block, i) in modelValue" :key="i"
           class="block-row" :class="{ 'block-row--over': dragOverIndex === i }"
           draggable="true"
           @dragstart="dragFrom = i"
           @dragover.prevent="dragOverIndex = i"
           @dragleave="dragOverIndex = -1"
           @drop.prevent="onDrop(i)">
        <div class="block-head">
          <span class="block-grip" aria-hidden="true">⠿</span>
          <span class="block-type">{{ TYPE_LABELS[block.type] }}</span>
          <span class="block-pos">{{ i + 1 }}</span>
          <button type="button" class="btn-remove" @click="remove(i)" title="Remove block">✕</button>
        </div>

        <TextBlockEditor  v-if="block.type === 'text'"  :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <ImageBlockEditor v-else-if="block.type === 'image'" :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <EmbedBlockEditor v-else-if="block.type === 'embed'" :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <RefBlockEditor   v-else :payload="block.payload" :entities="entities" @update:payload="setPayload(i, $event)" />
      </div>
    </div>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.block-row { border: 1px solid #3f3f46; border-radius: 0.5rem; padding: 0.75rem; background: #18181b; }
.block-row--over { border-color: #60a5fa; }
.block-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.block-grip { cursor: grab; color: #71717a; }
.block-type { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #a1a1aa; }
.block-pos { margin-left: auto; font-size: 0.7rem; color: #71717a; }
.empty-hint { font-size: 0.8rem; color: #71717a; padding: 0.75rem 0; }
</style>
