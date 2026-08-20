<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import TicketStatusBadge from '@/components/admin/TicketStatusBadge.vue'
import { useAuth } from '@/composables/useAuth'
import { fetchConcertTickets } from '@/api/concerts'
import type { AdminTicket, TicketStatus } from '@/types/ticket'

const route = useRoute()
const { token } = useAuth()

const concertId = Number(route.params.concertId)

const { data, isPending, isError } = useQuery({
  queryKey: ['concert-tickets', concertId],
  queryFn: () => fetchConcertTickets(token.value!, concertId),
  enabled: !!token.value && concertId > 0,
})

const search = ref('')
const statusFilter = ref<'' | TicketStatus>('')

const filtered = computed<AdminTicket[]>(() => {
  const q = search.value.toLowerCase()
  return (data.value ?? []).filter((t) => {
    const matchStatus = !statusFilter.value || t.status === statusFilter.value
    const matchSearch = !q || (t.holder_email ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })
})
</script>

<template>
  <AdminLayout>
    <div class="p-8 max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">
          Concert Tickets <span class="text-sm font-normal" style="color:#475569;">#{{ concertId }}</span>
        </h1>
        <RouterLink to="/admin/concerts" class="text-sm" style="color:#64748b;">← Concerts</RouterLink>
      </div>

      <div class="flex gap-3 mb-4 flex-wrap">
        <input v-model="search" type="search" placeholder="Filter by email…" class="search-input" />
        <select v-model="statusFilter" class="filter-select">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="transferred">Transferred</option>
          <option value="scanned">Scanned</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      <div v-if="isPending" class="state-msg">Loading…</div>
      <div v-else-if="isError" class="state-msg" style="color:#f87171;">Failed to load tickets.</div>
      <div v-else-if="!filtered.length" class="state-msg">No tickets match your filters.</div>

      <div v-else class="table-card">
        <table class="w-full">
          <thead>
            <tr style="border-bottom:1px solid #222222;">
              <th class="th">UUID</th>
              <th class="th">Holder name</th>
              <th class="th">Holder email</th>
              <th class="th">Status</th>
              <th class="th">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in filtered" :key="t.uuid" class="table-row">
              <td class="td" style="font-family:monospace;font-size:0.75rem;color:#94a3b8;">{{ t.uuid.slice(0, 8) }}</td>
              <td class="td" style="color:#e2e8f0;">{{ t.holder_name ?? '—' }}</td>
              <td class="td" style="color:#94a3b8;">{{ t.holder_email ?? '—' }}</td>
              <td class="td"><TicketStatusBadge :status="t.status" /></td>
              <td class="td" style="color:#94a3b8;">{{ t.ticket_type ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.state-msg  { color: #64748b; padding: 2rem 0; font-size: 0.9rem; }
.search-input {
  padding: 0.375rem 0.75rem; border-radius: 0.375rem;
  border: 1px solid #252525; background: #0d0d0d;
  color: #e2e8f0; font-size: 0.875rem; outline: none; min-width: 220px;
}
.search-input:focus { border-color: #334155; }
</style>
<style scoped src="./admin-table.css" />
