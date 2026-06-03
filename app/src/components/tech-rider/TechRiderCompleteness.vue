<script setup lang="ts">
import { computed } from 'vue'
import type { StagePlotMemberItem } from '@/types/stagePlot'
import { computeCompleteness, isMemberItemComplete, isMemberItemPartial } from '@/types/stagePlot'

interface Props {
  items: StagePlotMemberItem[]
}
const props = defineProps<Props>()

const stats = computed(() => computeCompleteness(props.items))

const barColor = computed(() => {
  if (stats.value.pct === 100) return 'bg-emerald-500'
  if (stats.value.pct >= 50)   return 'bg-amber-500'
  return 'bg-red-500'
})

const label = computed(() => {
  const { total, complete, pct } = stats.value
  if (total === 0) return 'No musicians placed on stage yet'
  if (pct === 100) return `All ${total} musicians fully configured — ready to generate`
  return `${complete} of ${total} musicians fully configured`
})
</script>

<template>
  <div class="px-4 py-3 bg-slate-900/80 border-t border-slate-700/60">
    <div class="flex items-center gap-3">
      <!-- Label -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-slate-300">Tech rider completeness</span>
          <span class="text-xs font-semibold" :class="stats.pct === 100 ? 'text-emerald-400' : 'text-slate-400'">
            {{ stats.pct }}%
          </span>
        </div>
        <!-- Progress bar -->
        <div class="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="barColor"
            :style="{ width: `${stats.pct}%` }"
          />
        </div>
        <p class="text-[11px] text-slate-500 mt-1">{{ label }}</p>
      </div>

      <!-- Member dots -->
      <div v-if="items.length > 0" class="flex gap-1 flex-shrink-0">
        <div
          v-for="item in items"
          :key="item.id"
          class="w-2 h-2 rounded-full"
          :class="
            isMemberItemComplete(item) ? 'bg-emerald-500' :
            isMemberItemPartial(item)  ? 'bg-amber-500' :
            'bg-red-500/60'
          "
          :title="
            isMemberItemComplete(item) ? 'Complete' :
            isMemberItemPartial(item)  ? 'Partial' :
            'Not configured'
          "
        />
      </div>

      <!-- Ready badge -->
      <div v-if="stats.pct === 100 && stats.total > 0" class="flex-shrink-0">
        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
          Ready
        </span>
      </div>
    </div>
  </div>
</template>
