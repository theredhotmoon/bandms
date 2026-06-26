<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useFanAccount } from '@/composables/useFanAccount'
import { fetchFanTickets } from '@/api/fan'
import TicketDownloadCard from '@/components/TicketDownloadCard.vue'

const { token } = useFanAccount()
const { data: tickets, isPending, isError } = useQuery({
  queryKey: ['fan', 'tickets'],
  queryFn: () => fetchFanTickets(token.value!),
  enabled: computed(() => !!token.value),
})

const STATUS_COLOR: Record<string, string> = {
  active: 'ftl-badge--active',
  scanned: 'ftl-badge--scanned',
  transferred: 'ftl-badge--transferred',
  voided: 'ftl-badge--voided',
}
</script>

<template>
  <section class="ftl-section">
    <p v-if="isPending" class="ftl-state">Loading tickets…</p>
    <p v-else-if="isError" class="ftl-state ftl-state--error" role="alert">Failed to load tickets.</p>
    <p v-else-if="!tickets || tickets.length === 0" class="ftl-state">No tickets yet.</p>
    <ul v-else class="ftl-list">
      <li v-for="ticket in tickets" :key="ticket.uuid" class="ftl-item">
        <div class="ftl-info">
          <p class="ftl-venue">{{ ticket.venue ?? 'Unknown venue' }}</p>
          <p class="ftl-date">{{ ticket.concert_date ?? '' }}</p>
          <p class="ftl-type">{{ ticket.ticket_type ?? '' }}</p>
          <p class="ftl-holder">{{ ticket.holder_name }}</p>
          <span :class="['ftl-badge', STATUS_COLOR[ticket.status] ?? '']">{{ ticket.status }}</span>
        </div>
        <TicketDownloadCard v-if="ticket.status === 'active'" :uuid="ticket.uuid" />
      </li>
    </ul>
  </section>
</template>
