<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TicketStatus } from '@/types/ticket'

const props = defineProps<{ status: TicketStatus }>()

const { t } = useI18n()

// Labels come from the same keys the ticket-list filter uses, so the filter
// and the rows cannot disagree — they did: a Polish filter read "Zeskanowany"
// over rows that all read "SCANNED".
const STATUS: Record<TicketStatus, { key: string; cls: string }> = {
  active:      { key: 'shows.tickets.status.active',      cls: 'badge-active' },
  transferred: { key: 'shows.tickets.status.transferred', cls: 'badge-transferred' },
  scanned:     { key: 'shows.tickets.status.scanned',     cls: 'badge-scanned' },
  voided:      { key: 'shows.tickets.status.voided',      cls: 'badge-voided' },
}

const b = computed(() => {
  const entry = STATUS[props.status]
  return entry ? { label: t(entry.key), cls: entry.cls } : { label: props.status, cls: 'badge-voided' }
})
</script>

<template>
  <span class="badge" :class="b.cls">{{ b.label }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-active      { background: var(--c-052e16); color: var(--c-4ade80); }
.badge-transferred { background: var(--c-1c1107); color: var(--c-fbbf24); }
.badge-scanned     { background: var(--c-0c1a2e); color: var(--c-60a5fa); }
.badge-voided      { background: var(--c-1a1a1a); color: var(--c-6b7280); }
</style>
