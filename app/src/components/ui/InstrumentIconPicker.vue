<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import InstrumentIcon from './InstrumentIcon.vue'
import type { StagePlotItemType } from '@/types/techRider'
import { INSTRUMENT_ICON_GROUPS, instrumentIcon, searchInstrumentIcons } from '@/utils/instrumentIcons'

interface Props {
  modelValue: StagePlotItemType | null
  /** Show an "— Not mapped —" entry that clears the selection. */
  clearable?: boolean
  /** Hide the label next to the trigger icon (compact rows). */
  iconOnly?: boolean
  placeholder?: string
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  clearable:   false,
  iconOnly:    false,
  placeholder: 'Pick an icon',
  disabled:    false,
})

const emit = defineEmits<{
  'update:modelValue': [StagePlotItemType | null]
}>()

const POPOVER_MAX_H = 320   // matches max-h-80 below

const open      = ref(false)
const dropUp    = ref(false)
const search    = ref('')
const rootRef   = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const current = computed(() => (props.modelValue ? instrumentIcon(props.modelValue) : null))

// Groups filtered by the search term; empty groups are dropped.
const groups = computed(() => {
  const matches = new Set(searchInstrumentIcons(search.value).map(d => d.type))
  return INSTRUMENT_ICON_GROUPS
    .map(g => ({ group: g.group, icons: g.icons.filter(i => matches.has(i.type)) }))
    .filter(g => g.icons.length > 0)
})

function toggle() {
  if (props.disabled) return
  if (!open.value) {
    // Flip upwards when the popover would run past the bottom of the viewport
    // (common inside the scrollable stage-plot modal).
    const rect = rootRef.value?.getBoundingClientRect()
    dropUp.value = !!rect &&
      rect.bottom + POPOVER_MAX_H > window.innerHeight &&
      rect.top > POPOVER_MAX_H
  }
  open.value = !open.value
}

function select(type: StagePlotItemType | null) {
  emit('update:modelValue', type)
  open.value = false
}

function onDocumentPointerDown(e: PointerEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

watch(open, async (isOpen) => {
  if (isOpen) {
    search.value = ''
    document.addEventListener('pointerdown', onDocumentPointerDown)
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    searchRef.value?.focus()
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <!-- Trigger -->
    <button
      type="button"
      class="flex items-center gap-2 rounded-md border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      :class="iconOnly ? 'justify-center' : 'w-full justify-between'"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="flex items-center gap-2 min-w-0">
        <InstrumentIcon v-if="current" :type="current.type" :size="18" class="text-zinc-200" />
        <svg v-else class="w-[18px] h-[18px] text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v12m6-6H6" />
        </svg>
        <span v-if="!iconOnly" class="truncate">{{ current?.label ?? placeholder }}</span>
      </span>
      <svg v-if="!iconOnly" class="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Popover -->
    <div
      v-if="open"
      class="absolute z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-2xl"
      :class="dropUp ? 'bottom-full mb-1' : 'mt-1'"
      role="listbox"
    >
      <input
        ref="searchRef"
        v-model="search"
        type="text"
        placeholder="Search instruments…"
        class="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
      />

      <button
        v-if="clearable"
        type="button"
        class="mb-2 w-full rounded-md px-2 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        @click="select(null)"
      >— Not mapped —</button>

      <div v-for="g in groups" :key="g.group" class="mb-2 last:mb-0">
        <p class="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{{ g.group }}</p>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="def in g.icons"
            :key="def.type"
            type="button"
            role="option"
            :aria-selected="def.type === modelValue"
            :title="def.label"
            class="flex flex-col items-center gap-1 rounded-md border px-1 py-2 transition-colors"
            :class="def.type === modelValue
              ? 'border-zinc-300 bg-zinc-800 text-white'
              : 'border-transparent text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100'"
            @click="select(def.type)"
          >
            <InstrumentIcon :type="def.type" :size="24" />
            <span class="w-full truncate text-center text-[9px] leading-tight">{{ def.label }}</span>
          </button>
        </div>
      </div>

      <p v-if="!groups.length" class="px-1 py-3 text-center text-xs text-zinc-500">
        No instrument matches "{{ search }}".
      </p>
    </div>
  </div>
</template>
