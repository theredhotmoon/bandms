<script setup lang="ts">
import type { TicketStatus } from '@/types/ticket'

const props = defineProps<{ status: TicketStatus }>()

const badge: Record<TicketStatus, { label: string; cls: string }> = {
  active:      { label: 'Active',      cls: 'badge-active' },
  transferred: { label: 'Transferred', cls: 'badge-transferred' },
  scanned:     { label: 'Scanned',     cls: 'badge-scanned' },
  voided:      { label: 'Voided',      cls: 'badge-voided' },
}

const b = badge[props.status] ?? { label: props.status, cls: 'badge-voided' }
</script>

<template>
  <span class="badge" :class="b.cls">{{ b.label }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-active      { background: #052e16; color: #4ade80; }
.badge-transferred { background: #1c1107; color: #fbbf24; }
.badge-scanned     { background: #0c1a2e; color: #60a5fa; }
.badge-voided      { background: #1a1a1a; color: #6b7280; }
</style>
