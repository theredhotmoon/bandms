<script setup lang="ts">
/**
 * Who has confirmed their rig for this gig.
 *
 * Sits under the completeness bar because it answers the question completeness
 * cannot: not "is this rig filled in" but "has the person who plays it looked
 * at it recently". A rig saved in March scores 100% and may still be wrong.
 */
import type { RiderConfirmation } from '@/types/riderConfirmation'
import { formatDayMonth } from '@/utils/formatDate'
import { useUiLang } from '@/composables/useUiLang'
import { dateLocale } from '@/locales'

defineProps<{
  confirmations: RiderConfirmation[]
  confirmed: RiderConfirmation[]
  waiting: RiderConfirmation[]
  neverAsked: boolean
  requesting: boolean
}>()

const emit = defineEmits<{ request: [] }>()

const { uiLang } = useUiLang()

/** Chrome locale, and month:'long' — see formatDayMonth(). */
function when(iso: string | null): string {
  if (!iso) return ''
  return formatDayMonth(iso, dateLocale(uiLang.value), 'instant')
}
</script>

<template>
  <div class="confirmations">
    <div class="head">
      <span class="title">{{ $t('rider.confirmations.title') }}</span>
      <span v-if="!neverAsked" class="count">
        {{ $t('rider.confirmations.count', { done: confirmed.length, total: confirmations.length }) }}
      </span>
      <button
        type="button"
        class="btn-ask"
        :disabled="requesting"
        @click="emit('request')"
      >
        {{ requesting ? $t('rider.confirmations.sending') : neverAsked ? $t('rider.confirmations.ask') : $t('rider.confirmations.askAgain') }}
      </button>
    </div>

    <p v-if="neverAsked" class="hint">
      {{ $t('rider.confirmations.hint') }}
    </p>

    <div v-else class="chips">
      <span v-for="c in confirmed" :key="c.id" class="chip chip--ok">
        {{ c.member_name }}
        <span class="chip-when">{{ when(c.confirmed_at) }}</span>
      </span>
      <span v-for="c in waiting" :key="c.id" class="chip chip--waiting">
        {{ c.member_name }}
        <span class="chip-when">{{ $t('rider.confirmations.waiting') }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.confirmations { display: flex; flex-direction: column; gap: 0.4rem; flex-shrink: 0; }

.head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.title { font-size: var(--fs-xs); font-weight: 700; color: var(--c-94a3b8); }
.count { flex: 1; font-size: var(--fs-2xs); color: var(--c-475569); }

.btn-ask {
  padding: 0.25rem 0.6rem; border-radius: 0.375rem; font-size: var(--fs-2xs); font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid var(--c-2a2a2a); color: var(--c-64748b);
}
.btn-ask:hover { border-color: var(--c-444444); color: var(--c-94a3b8); }
.btn-ask:disabled { opacity: 0.5; cursor: default; }

.hint { font-size: var(--fs-2xs); color: var(--c-475569); margin: 0; line-height: 1.5; max-width: 40rem; }

.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: var(--fs-2xs); padding: 0.15rem 0.45rem; border-radius: 999px;
}
.chip--ok { color: var(--c-4ade80); background: var(--c-052e16); }
.chip--waiting { color: var(--c-94a3b8); background: var(--c-1a1a1a); }
.chip-when { opacity: 0.7; font-size: var(--fs-2xs); }
</style>
