<script setup lang="ts">
import { computed } from 'vue'
import type { StagePlotItemType } from '@/types/techRider'
import { instrumentIcon } from '@/utils/instrumentIcons'

interface Props {
  type: StagePlotItemType | null | undefined
  /** Rendered width/height in px. Omit to size via CSS (width/height: 1em). */
  size?: number
  strokeWidth?: number
  /** Adds a <title> element for screen readers. Defaults to the icon label. */
  title?: string
  /** Nested-SVG placement — required when embedding inside another <svg>. */
  x?: number
  y?: number
}
const props = withDefaults(defineProps<Props>(), {
  size:        undefined,
  strokeWidth: 1.5,
  title:       undefined,
  x:           undefined,
  y:           undefined,
})

const icon   = computed(() => instrumentIcon(props.type))
const label  = computed(() => props.title ?? icon.value.label)
const boxCss = computed(() =>
  props.size !== undefined ? { width: `${props.size}px`, height: `${props.size}px` } : undefined,
)
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :x="x"
    :y="y"
    :style="boxCss"
    class="instrument-icon"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="label"
  >
    <title>{{ label }}</title>
    <template v-for="(shape, i) in icon.shapes" :key="i">
      <path
        v-if="shape.kind === 'path'"
        :d="shape.d"
        :fill="shape.filled ? 'currentColor' : 'none'"
        :stroke="shape.filled ? 'none' : 'currentColor'"
      />
      <circle
        v-else-if="shape.kind === 'circle'"
        :cx="shape.cx"
        :cy="shape.cy"
        :r="shape.r"
        :fill="shape.filled ? 'currentColor' : 'none'"
        :stroke="shape.filled ? 'none' : 'currentColor'"
      />
      <ellipse
        v-else-if="shape.kind === 'ellipse'"
        :cx="shape.cx"
        :cy="shape.cy"
        :rx="shape.rx"
        :ry="shape.ry"
        :fill="shape.filled ? 'currentColor' : 'none'"
        :stroke="shape.filled ? 'none' : 'currentColor'"
      />
      <rect
        v-else-if="shape.kind === 'rect'"
        :x="shape.x"
        :y="shape.y"
        :width="shape.w"
        :height="shape.h"
        :rx="shape.rx"
        :fill="shape.filled ? 'currentColor' : 'none'"
        :stroke="shape.filled ? 'none' : 'currentColor'"
      />
      <line
        v-else
        :x1="shape.x1"
        :y1="shape.y1"
        :x2="shape.x2"
        :y2="shape.y2"
      />
    </template>
  </svg>
</template>

<style scoped>
.instrument-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  overflow: visible;
}
</style>
