<script setup lang="ts">
/**
 * `title` and `confirmLabel` default to the delete wording; a discard-changes
 * prompt passes its own so the button names the action it performs.
 */
defineProps<{ open: boolean; title?: string; message?: string; confirmLabel?: string; loading?: boolean }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('cancel')" />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" class="relative z-10 w-full max-w-sm rounded-xl shadow-2xl" style="background:var(--c-111111); border:1px solid var(--c-222222);">
        <div class="p-6">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style="background:var(--c-3f1212);">
              <svg class="w-4 h-4" style="color:var(--c-f87171);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 id="confirm-dialog-title" class="text-sm font-semibold" style="color:var(--c-e2e8f0);">{{ title ?? $t('common.confirm.deleteTitle') }}</h3>
          </div>
          <p class="text-sm mb-5 leading-relaxed" style="color:var(--c-94a3b8);">{{ message ?? $t('common.confirm.deleteMessage') }}</p>
          <div class="flex gap-2 justify-end">
            <button @click="$emit('cancel')" :disabled="loading" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
            <button @click="$emit('confirm')" :disabled="loading" class="btn-danger">
              {{ loading ? $t('common.actions.deleting') : (confirmLabel ?? $t('common.actions.delete')) }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.btn-ghost {
  padding: 0.4rem 1rem; border-radius: 0.5rem; font-size: var(--fs-sm); font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid var(--c-2a2a2a); color: var(--c-94a3b8);
  transition: background 120ms;
}
.btn-ghost:hover { background: var(--c-1a1a1a); }
.btn-danger {
  padding: 0.4rem 1rem; border-radius: 0.5rem; font-size: var(--fs-sm); font-weight: 500;
  cursor: pointer; background: var(--c-7f1d1d); border: none; color: var(--c-fca5a5);
  transition: background 120ms;
}
.btn-danger:hover:not(:disabled) { background: var(--c-991b1b); }
.btn-danger:disabled, .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
