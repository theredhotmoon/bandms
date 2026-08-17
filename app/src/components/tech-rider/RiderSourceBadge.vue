<script setup lang="ts">
/**
 * Shows where a derived row came from. Every list on the rider is computed from
 * the placements, so each row can always name its musician — that attribution is
 * what makes a derived list trustworthy instead of mysterious.
 */
import type { RigSource } from '@/utils/riderResolver'

interface Props {
  source: RigSource
  /** Emits `open` when clicked, so the caller can jump to the placement. */
  clickable?: boolean
}
withDefaults(defineProps<Props>(), { clickable: false })

defineEmits<{ open: [placementId: string] }>()
</script>

<template>
  <component
    :is="clickable && source.placementId ? 'button' : 'span'"
    :type="clickable && source.placementId ? 'button' : undefined"
    class="source-badge"
    :class="[`source-badge--${source.kind}`, { 'source-badge--clickable': clickable && source.placementId }]"
    :title="source.overridden ? `${source.name} — changed for this gig` : source.detail"
    @click="clickable && source.placementId ? $emit('open', source.placementId) : undefined"
  >
    <span class="source-name">{{ source.name }}</span>
    <span class="source-detail">{{ source.detail }}</span>
    <span v-if="source.overridden" class="override-dot" title="Changed for this gig" />
  </component>
</template>

<style scoped>
.source-badge {
  display: inline-flex; align-items: baseline; gap: 0.3rem;
  padding: 0.1rem 0.4rem; border-radius: 0.25rem;
  font-size: 0.68rem; line-height: 1.4; white-space: nowrap;
  background: #141414; border: 1px solid #222222; color: #64748b;
  font-family: inherit; max-width: 100%; overflow: hidden;
}
.source-badge--guest { background: #1a1206; border-color: #3d2a08; }
.source-badge--extra { background: #0f1a14; border-color: #14361f; }

.source-badge--clickable { cursor: pointer; transition: border-color 100ms, color 100ms; }
.source-badge--clickable:hover { border-color: #555555; color: #94a3b8; }

.source-name { font-weight: 600; color: #94a3b8; }
.source-badge--guest .source-name { color: #fbbf24; }
.source-badge--extra .source-name { color: #4ade80; }
.source-detail { color: #475569; overflow: hidden; text-overflow: ellipsis; }

.override-dot {
  width: 0.35rem; height: 0.35rem; border-radius: 50%;
  background: #fbbf24; flex-shrink: 0; align-self: center;
}
</style>
