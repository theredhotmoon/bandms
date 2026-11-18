<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useCommentLimit } from '@/composables/useCommentLimit'
import { saveErrorMessage } from '@/api/client'

/**
 * "One fan may post at most N comments in M minutes" — the band's own brake
 * on a fan who posts too much. The bounds mirror App\Support\CommentSettings.
 */
const MAX_COMMENTS = 100
const MAX_MINUTES = 1440

const { t } = useI18n()
const { query, save } = useCommentLimit()

const form = reactive({ max: 5, minutes: 10 })
watch(() => query.data.value, (limit) => {
  if (limit) Object.assign(form, limit)
}, { immediate: true })

const dirty = computed(() => {
  const saved = query.data.value
  return !!saved && (saved.max !== form.max || saved.minutes !== form.minutes)
})

async function submit() {
  try {
    await save.mutateAsync({ max: form.max, minutes: form.minutes })
    toast.success(t('content.comments.limit.saved'))
  } catch (e) {
    toast.error(saveErrorMessage(e, t('content.comments.failed')))
  }
}
</script>

<template>
  <section class="cl" data-testid="comment-limit">
    <h2 class="cl-title">{{ $t('content.comments.limit.title') }}</h2>
    <p v-if="query.isError.value" class="cl-hint" style="color:var(--c-f87171);">{{ $t('content.comments.limit.loadFailed') }}</p>
    <form v-else class="cl-form" @submit.prevent="submit">
      <span>{{ $t('content.comments.limit.sentenceStart') }}</span>
      <input
        v-model.number="form.max" type="number" min="1" :max="MAX_COMMENTS" required class="cl-input"
        :aria-label="$t('content.comments.limit.maxLabel')" data-testid="comment-limit-max"
        :disabled="query.isPending.value"
      />
      <span>{{ $t('content.comments.limit.sentenceMiddle') }}</span>
      <input
        v-model.number="form.minutes" type="number" min="1" :max="MAX_MINUTES" required class="cl-input"
        :aria-label="$t('content.comments.limit.minutesLabel')" data-testid="comment-limit-minutes"
        :disabled="query.isPending.value"
      />
      <span>{{ $t('content.comments.limit.sentenceEnd') }}</span>
      <button type="submit" class="cl-btn" :disabled="!dirty || save.isPending.value" data-testid="comment-limit-save">
        {{ $t('content.comments.limit.save') }}
      </button>
    </form>
    <p class="cl-hint">{{ $t('content.comments.limit.hint') }}</p>
  </section>
</template>

<style scoped>
.cl {
  margin-bottom: 1.25rem; padding: 0.875rem 1rem;
  border: 1px solid var(--c-222222); border-radius: var(--radius-card); background: var(--c-111111);
}
.cl-title { font-size: var(--fs-sm); font-weight: 600; color: var(--c-e2e8f0); margin-bottom: 0.5rem; }
.cl-form {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  font-size: var(--fs-sm); color: var(--c-d0d0d0);
}
.cl-input {
  width: 5rem; padding: 0.35rem 0.5rem; border-radius: 0.375rem;
  border: 1px solid var(--c-334155-line); background: var(--c-0d0d0d);
  color: var(--c-e2e8f0); font-size: var(--fs-sm); font-variant-numeric: tabular-nums;
}
.cl-btn {
  margin-left: 0.5rem; padding: 0.35rem 0.85rem; border-radius: 0.375rem; border: none;
  background: var(--c-e8e8e8); color: var(--c-111111); font-size: var(--fs-sm); font-weight: 600; cursor: pointer;
}
.cl-btn:disabled { cursor: not-allowed; background: var(--c-2a2a2a); color: var(--c-6b6b6b); }
.cl-hint { margin-top: 0.5rem; font-size: var(--fs-xs); color: var(--c-94a3b8); }
</style>
