<script setup lang="ts">
/**
 * Who has confirmed their rig for this gig.
 *
 * Sits under the completeness bar because it answers the question completeness
 * cannot: not "is this rig filled in" but "has the person who plays it looked
 * at it recently". A rig saved in March scores 100% and may still be wrong.
 */
import type { RiderConfirmation } from '@/types/riderConfirmation'

defineProps<{
  confirmations: RiderConfirmation[]
  confirmed: RiderConfirmation[]
  waiting: RiderConfirmation[]
  neverAsked: boolean
  requesting: boolean
}>()

const emit = defineEmits<{ request: [] }>()

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="confirmations">
    <div class="head">
      <span class="title">Rig confirmations</span>
      <span v-if="!neverAsked" class="count">
        {{ confirmed.length }}/{{ confirmations.length }} confirmed
      </span>
      <button
        type="button"
        class="btn-ask"
        :disabled="requesting"
        @click="emit('request')"
      >
        {{ requesting ? 'Sending…' : neverAsked ? 'Ask the band to confirm' : 'Ask again' }}
      </button>
    </div>

    <p v-if="neverAsked" class="hint">
      Emails everyone in tonight's lineup who can sign in, asking them to check
      their saved rig. Their answer is recorded against this rider.
    </p>

    <div v-else class="chips">
      <span v-for="c in confirmed" :key="c.id" class="chip chip--ok">
        {{ c.member_name }}
        <span class="chip-when">{{ when(c.confirmed_at) }}</span>
      </span>
      <span v-for="c in waiting" :key="c.id" class="chip chip--waiting">
        {{ c.member_name }}
        <span class="chip-when">waiting</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.confirmations { display: flex; flex-direction: column; gap: 0.4rem; flex-shrink: 0; }

.head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.title { font-size: 0.72rem; font-weight: 700; color: #94a3b8; }
.count { flex: 1; font-size: 0.7rem; color: #475569; }

.btn-ask {
  padding: 0.25rem 0.6rem; border-radius: 0.375rem; font-size: 0.7rem; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
}
.btn-ask:hover { border-color: #444444; color: #94a3b8; }
.btn-ask:disabled { opacity: 0.5; cursor: default; }

.hint { font-size: 0.7rem; color: #475569; margin: 0; line-height: 1.5; max-width: 40rem; }

.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.68rem; padding: 0.15rem 0.45rem; border-radius: 999px;
}
.chip--ok { color: #4ade80; background: #052e16; }
.chip--waiting { color: #94a3b8; background: #1a1a1a; }
.chip-when { opacity: 0.7; font-size: 0.62rem; }
</style>
