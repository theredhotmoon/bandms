<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { fetchFanAccountsAdmin } from '@/api/admin'
import type { AdminFanAccount } from '@/types/ticket'

const { token } = useAuth()

const { data, isPending, isError } = useQuery({
  queryKey: ['admin-fan-accounts'],
  queryFn: () => fetchFanAccountsAdmin(token.value!),
  enabled: !!token.value,
})

const search = ref('')
const rows = computed<AdminFanAccount[]>(() => {
  const q = search.value.toLowerCase()
  if (!q) return data.value ?? []
  return (data.value ?? []).filter(
    (f) => f.email.toLowerCase().includes(q) || f.name.toLowerCase().includes(q),
  )
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <AdminLayout>
    <div class="p-8 max-w-4xl">
      <h1 class="text-lg font-semibold mb-4" style="color:#e2e8f0;">Fan Accounts</h1>

      <input v-model="search" type="search" placeholder="Search by email or name…" class="search-input mb-4" />

      <div v-if="isPending" class="state-msg">Loading…</div>
      <div v-else-if="isError" class="state-msg" style="color:#f87171;">Failed to load fan accounts.</div>
      <div v-else-if="!rows.length" class="state-msg">No fan accounts found.</div>

      <div v-else class="table-card">
        <table class="w-full">
          <thead>
            <tr style="border-bottom:1px solid #222222;">
              <th class="th">Email</th>
              <th class="th">Name</th>
              <th class="th">Tickets</th>
              <th class="th">Newsletter</th>
              <th class="th">Joined</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in rows" :key="f.id" class="table-row">
              <td class="td" style="color:#e2e8f0;font-weight:500;">{{ f.email }}</td>
              <td class="td" style="color:#94a3b8;">{{ f.name }}</td>
              <td class="td" style="color:#94a3b8;font-variant-numeric:tabular-nums;">{{ f.tickets_count }}</td>
              <td class="td">
                <span class="newsletter-badge" :class="f.newsletter_subscribed ? 'badge-yes' : 'badge-no'">
                  {{ f.newsletter_subscribed ? 'Yes' : 'No' }}
                </span>
              </td>
              <td class="td" style="color:#64748b;font-size:0.75rem;">{{ formatDate(f.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.state-msg { color: #64748b; padding: 2rem 0; font-size: 0.9rem; }
.search-input {
  display: block; width: 100%; max-width: 360px;
  padding: 0.5rem 0.75rem; border-radius: 0.375rem;
  border: 1px solid #1f1f1f; background: #0d0d0d;
  color: #e2e8f0; font-size: 0.875rem; outline: none;
}
.search-input:focus { border-color: #334155; }
.newsletter-badge {
  display: inline-block; padding: 0.15rem 0.5rem;
  border-radius: 0.25rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
}
.badge-yes { background: #052e16; color: #4ade80; }
.badge-no  { background: #1a1a1a; color: #6b7280; }
</style>
<style scoped src="./admin-table.css" />
