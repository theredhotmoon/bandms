<script setup lang="ts">
import { computed } from 'vue'
import { useWebsiteModules } from '@/composables/useWebsiteModules'

const { query, toggleModule, setAutoRebuild, rebuild } = useWebsiteModules()

const modules     = computed(() => query.data.value?.data ?? [])
const autoRebuild = computed(() => query.data.value?.auto_rebuild ?? false)
const isRebuilding = computed(() => rebuild.isPending.value)
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-8 gap-4 flex-wrap">
      <h1 class="text-2xl font-bold text-white">Website Modules</h1>

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
          :disabled="isRebuilding || autoRebuild || rebuild.isPending.value"
          :title="autoRebuild ? 'Auto-rebuild is active — changes rebuild automatically' : 'Rebuild the public Astro site'"
          @click="rebuild.mutate()"
        >
          <span>{{ isRebuilding ? 'Rebuilding…' : '↺ Rebuild Public Site' }}</span>
        </button>
      </div>
    </div>

    <div v-if="query.isLoading.value" class="text-zinc-500">Loading…</div>

    <div v-else-if="query.isError.value" class="text-red-400">
      Failed to load modules. Check the API connection.
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="mod in modules"
        :key="mod.slug"
        class="rounded-xl border bg-zinc-900 p-5 flex flex-col gap-3 transition-colors"
        :class="mod.enabled ? 'border-zinc-700' : 'border-zinc-800 opacity-60'"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold text-white">{{ mod.display_name }}</h3>
            <p class="text-xs text-zinc-500 mt-0.5">/{{ mod.slug === 'tech-rider' ? 'rider' : mod.slug }}</p>
          </div>
          <span
            class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
            :class="mod.enabled ? 'bg-teal-900 text-teal-300' : 'bg-zinc-800 text-zinc-500'"
          >
            {{ mod.enabled ? 'Live' : 'Disabled' }}
          </span>
        </div>

        <label class="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 mt-auto">
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
