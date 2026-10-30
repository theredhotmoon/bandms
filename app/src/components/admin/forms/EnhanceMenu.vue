<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { REWRITE_MODES, type RewriteMode } from '@/utils/rewriteModes'

/**
 * The ✦ Enhance button and its menu of modes, one per TranslatedField row.
 * Rendered by TranslatedField only when the server reports the `rewrite`
 * capability and the row has text; the host decides what a pick does.
 *
 * Plain buttons with menu roles: Escape closes and returns focus to the
 * button, a click outside closes, arrow keys walk the items.
 */
const props = defineProps<{ disabled?: boolean; pending?: boolean; locale: string }>()
const emit = defineEmits<{ pick: [RewriteMode] }>()

const open = ref(false)
const button = ref<HTMLButtonElement | null>(null)
const items = ref<HTMLButtonElement[]>([])

const KEY_ESCAPE = 'Escape' // i18n-ignore: DOM key name
const KEY_DOWN = 'ArrowDown' // i18n-ignore: DOM key name
const KEY_UP = 'ArrowUp' // i18n-ignore: DOM key name

function toggle(): void {
  open.value = !open.value
}

function close(returnFocus = true): void {
  if (!open.value) return
  open.value = false
  if (returnFocus) button.value?.focus()
}

function pick(mode: RewriteMode): void {
  close()
  emit('pick', mode)
}

function onKeydown(e: KeyboardEvent): void {
  if (!open.value) return
  if (e.key === KEY_ESCAPE) {
    e.preventDefault()
    e.stopPropagation() // consumed here, so the surrounding modal stays open
    close()
    return
  }
  if (e.key === KEY_DOWN || e.key === KEY_UP) {
    e.preventDefault()
    const list = items.value
    const at = list.findIndex(el => el === document.activeElement)
    const next = e.key === KEY_DOWN ? (at + 1) % list.length : (at - 1 + list.length) % list.length
    list[next]?.focus()
  }
}

function onDocumentClick(e: MouseEvent): void {
  if (!open.value) return
  const root = button.value?.parentElement
  if (root && !root.contains(e.target as Node)) close(false)
}

watch(open, async (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onDocumentClick)
    await nextTick()
    items.value[0]?.focus()
  } else {
    document.removeEventListener('mousedown', onDocumentClick)
  }
})
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<template>
  <div class="enhance" @keydown="onKeydown">
    <button
      ref="button"
      type="button"
      class="trans-enhance"
      :class="{ 'trans-enhance--open': open }"
      :data-locale="locale"
      :disabled="props.disabled"
      :aria-expanded="open"
      aria-haspopup="menu"
      :title="$t('common.assistant.enhanceHint')"
      :aria-label="$t('common.assistant.enhance')"
      @click="toggle"
    >
      <svg v-if="props.pending" class="enhance-spinner" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" stroke-dasharray="30 14" />
      </svg>
      <svg v-else class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2.5l1.6 4.2 4.2 1.6-4.2 1.6L10 14.1l-1.6-4.2-4.2-1.6 4.2-1.6L10 2.5Zm5.5 9l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1ZM4 12.5l.6 1.5 1.5.6-1.5.6L4 16.7l-.6-1.5-1.5-.6 1.5-.6.6-1.5Z" />
      </svg>
    </button>

    <div v-if="open" class="enhance-menu" role="menu" :aria-label="$t('common.assistant.enhance')">
      <button
        v-for="mode in REWRITE_MODES"
        :key="mode"
        ref="items"
        type="button"
        role="menuitem"
        class="enhance-item"
        :data-mode="mode"
        @click="pick(mode)"
      >
        <span class="enhance-item__label">{{ $t(`common.assistant.enhanceModes.${mode}`) }}</span>
        <span class="enhance-item__hint">{{ $t(`common.assistant.enhanceModes.${mode}Hint`) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.enhance { position: absolute; right: 2.25rem; top: 0.375rem; }
.trans-enhance {
  display: flex; align-items: center; justify-content: center;
  width: 1.5rem; height: 1.5rem;
  border: none; border-radius: 0.25rem; background: transparent;
  color: var(--c-888888); cursor: pointer;
  transition: color 120ms, background 120ms;
}
.trans-enhance:hover, .trans-enhance--open { color: var(--c-e2e8f0); background: var(--c-222222); }
.trans-enhance:disabled { cursor: progress; opacity: 0.6; }
.enhance-spinner { width: 0.875rem; height: 0.875rem; animation: enhance-spin 0.8s linear infinite; }
@keyframes enhance-spin { to { transform: rotate(360deg); } }
.enhance-menu {
  position: absolute; right: 0; top: 1.75rem; z-index: 20;
  min-width: 15rem; padding: 0.25rem;
  background: var(--c-141414); border: 1px solid var(--c-2a2a2a); border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  display: flex; flex-direction: column; gap: 0.125rem;
}
.enhance-item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 0.125rem;
  width: 100%; padding: 0.4rem 0.6rem; text-align: left;
  border: none; border-radius: 0.375rem; background: transparent; cursor: pointer;
}
.enhance-item:hover, .enhance-item:focus-visible { background: var(--c-222222); outline: none; }
.enhance-item__label { font-size: var(--fs-sm); color: var(--c-e2e8f0); }
.enhance-item__hint { font-size: var(--fs-2xs); color: var(--c-888888); }
</style>
