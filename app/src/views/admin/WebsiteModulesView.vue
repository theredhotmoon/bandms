<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import type { WebsiteModule } from '@/types/website-module'

const { query, rebuildStatusQuery, toggleModule, reorder, setAutoRebuild, rebuild } = useWebsiteModules()

const autoRebuild = computed(() => query.data.value?.auto_rebuild ?? false)

const rebuildStatus  = computed(() => rebuildStatusQuery.data.value?.status ?? 'idle')
const rebuildStarted = computed(() => rebuildStatusQuery.data.value?.startedAt ?? null)

// ── Elapsed-time ticker ───────────────────────────────────────────────────────

const ESTIMATED_MS = 45_000

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

watch(rebuildStatus, (status) => {
  if (ticker) { clearInterval(ticker); ticker = null }
  if (status === 'building') {
    ticker = setInterval(() => { now.value = Date.now() }, 1000)
  }
}, { immediate: true })

onUnmounted(() => { if (ticker) clearInterval(ticker) })

const elapsedSec = computed(() => {
  if (!rebuildStarted.value) return 0
  return Math.floor((now.value - rebuildStarted.value) / 1000)
})

const progressPct = computed(() => {
  if (rebuildStatus.value === 'done')  return 100
  if (rebuildStatus.value === 'error') return 100
  if (rebuildStatus.value !== 'building' || !rebuildStarted.value) return 0
  return Math.min((elapsedSec.value / (ESTIMATED_MS / 1000)) * 90, 90)
})

const showBar = computed(() =>
  rebuildStatus.value === 'building' ||
  rebuildStatus.value === 'done'     ||
  rebuildStatus.value === 'error'
)

// ── Draggable ordered list ────────────────────────────────────────────────────

const localModules = ref<WebsiteModule[]>([])

watch(() => query.data.value?.data, (data) => {
  if (data) localModules.value = [...data]
}, { immediate: true, deep: false })

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
  if (dragFrom === -1 || dragFrom === toIndex) { dragFrom = -1; return }

  const next = [...localModules.value]
  const [moved] = next.splice(dragFrom, 1)
  next.splice(toIndex, 0, moved)
  localModules.value = next
  dragFrom = -1

  reorder.mutate(next.map((m) => m.slug))
}

function onDragEnd() {
  dragFrom = -1
  dragOverIndex.value = -1
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-white">Website Modules</h1>
        <p class="text-sm text-zinc-500 mt-1">Drag rows to set the nav order. Order takes effect after a rebuild.</p>
      </div>

      <div class="flex items-center gap-4 flex-wrap">
        <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            class="w-4 h-4 rounded accent-teal-500"
            :checked="autoRebuild"
            :disabled="setAutoRebuild.isPending.value"
            @change="setAutoRebuild.mutate(!autoRebuild)"
          />
          Auto-rebuild on changes
        </label>

        <button
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          :disabled="rebuildStatus === 'building' || autoRebuild"
          :title="autoRebuild ? 'Auto-rebuild is active — changes rebuild automatically' : 'Rebuild the public Astro site'"
          @click="rebuild.mutate()"
        >
          <span>{{ rebuildStatus === 'building' ? 'Rebuilding…' : '↺ Rebuild Public Site' }}</span>
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div v-if="showBar" class="mb-6 rounded-xl overflow-hidden bg-zinc-800">
      <div
        class="h-2 transition-all duration-1000 ease-out"
        :class="{
          'bg-teal-500': rebuildStatus === 'building',
          'bg-green-500': rebuildStatus === 'done',
          'bg-red-500': rebuildStatus === 'error',
        }"
        :style="{ width: `${progressPct}%` }"
      />
      <div class="px-4 py-2 flex items-center justify-between text-xs">
        <span
          :class="{
            'text-teal-400': rebuildStatus === 'building',
            'text-green-400': rebuildStatus === 'done',
            'text-red-400': rebuildStatus === 'error',
          }"
        >
          <template v-if="rebuildStatus === 'building'">Building… {{ elapsedSec }}s</template>
          <template v-else-if="rebuildStatus === 'done'">Rebuild complete ✓</template>
          <template v-else-if="rebuildStatus === 'error'">Rebuild failed — check container logs</template>
        </span>
        <span class="text-zinc-500">~{{ Math.round(ESTIMATED_MS / 1000) }}s estimated</span>
      </div>
    </div>

    <div v-if="query.isLoading.value" class="text-zinc-500">Loading…</div>

    <div v-else-if="query.isError.value" class="text-red-400">
      Failed to load modules. Check the API connection.
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(mod, i) in localModules"
        :key="mod.slug"
        class="flex items-center gap-3 rounded-xl border bg-zinc-900 px-4 py-3 transition-colors select-none"
        :class="{
          'border-zinc-700': mod.enabled,
          'border-zinc-800 opacity-60': !mod.enabled,
          'border-t-2 border-t-teal-500': dragOverIndex === i,
        }"
        draggable="true"
        @dragstart="onDragStart(i, $event)"
        @dragover="onDragOver(i, $event)"
        @drop="onDrop(i, $event)"
        @dragend="onDragEnd"
      >
        <!-- Drag handle -->
        <span class="cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing flex-shrink-0" aria-hidden="true">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="3" cy="2"  r="1.5" /><circle cx="7" cy="2"  r="1.5" />
            <circle cx="3" cy="7"  r="1.5" /><circle cx="7" cy="7"  r="1.5" />
            <circle cx="3" cy="12" r="1.5" /><circle cx="7" cy="12" r="1.5" />
          </svg>
        </span>

        <!-- Position number -->
        <span class="w-5 text-center text-xs font-mono text-zinc-500 flex-shrink-0">{{ i + 1 }}</span>

        <!-- Module info -->
        <div class="flex-1 min-w-0">
          <span class="font-semibold text-white text-sm">{{ mod.display_name }}</span>
          <span class="ml-2 text-xs text-zinc-500">/{{ mod.slug === 'tech-rider' ? 'rider' : mod.slug }}</span>
        </div>

        <!-- Status badge -->
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          :class="mod.enabled ? 'bg-teal-900 text-teal-300' : 'bg-zinc-800 text-zinc-500'"
        >
          {{ mod.enabled ? 'Live' : 'Off' }}
        </span>

        <!-- Toggle -->
        <label class="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-400 flex-shrink-0">
          <input
            type="checkbox"
            class="w-4 h-4 rounded accent-teal-500"
            :checked="mod.enabled"
            :disabled="toggleModule.isPending.value"
            @change="toggleModule.mutate({ slug: mod.slug, enabled: !mod.enabled })"
          />
          {{ mod.enabled ? 'Enabled' : 'Disabled' }}
        </label>
      </div>
    </div>
  </div>
</template>
