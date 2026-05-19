<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useNewsletterSubscribers } from '@/composables/useNewsletterSubscribers'
import type { NewsletterSubscriber } from '@/types/newsletterSubscriber'

const { query, remove, page } = useNewsletterSubscribers()

const subscribers = computed<NewsletterSubscriber[]>(() => query.data.value?.data ?? [])
const meta        = computed(() => query.data.value?.meta)
const total       = computed(() => meta.value?.total ?? 0)

const search = ref('')
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return subscribers.value
  return subscribers.value.filter(s =>
    s.email.toLowerCase().includes(q) || (s.name ?? '').toLowerCase().includes(q)
  )
})

const confirmId = ref<number | null>(null)

async function doDelete(id: number) {
  try {
    await remove.mutateAsync(id)
    toast.success('Subscriber removed.')
  } catch {
    toast.error('Failed to remove subscriber.')
  } finally {
    confirmId.value = null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function exportCsv() {
  const rows = [['Email', 'Name', 'Source', 'Subscribed at']]
  for (const s of subscribers.value) {
    rows.push([s.email, s.name ?? '', s.source ?? '', formatDate(s.subscribed_at)])
  }
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'newsletter-subscribers.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <AdminLayout>
    <div class="view-wrap">
      <div class="view-header">
        <div class="header-left">
          <h1 class="view-title">Newsletter</h1>
          <span class="subscriber-count">{{ total }} subscriber{{ total !== 1 ? 's' : '' }}</span>
        </div>
        <button v-if="subscribers.length" class="btn-export" @click="exportCsv">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Export CSV
        </button>
      </div>

      <div class="toolbar">
        <input
          v-model="search"
          type="search"
          class="search-input"
          placeholder="Search by email or name…"
        />
      </div>

      <div v-if="query.isPending.value" class="state-msg">Loading…</div>
      <div v-else-if="query.isError.value" class="state-msg state-msg--error">Failed to load subscribers.</div>
      <div v-else-if="!subscribers.length" class="state-msg">No subscribers yet.</div>
      <div v-else-if="!filtered.length" class="state-msg">No results for "{{ search }}".</div>

      <div v-else class="table-wrap">
        <table class="sub-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Source</th>
              <th>Subscribed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.id">
              <td class="cell-email">{{ s.email }}</td>
              <td class="cell-secondary">{{ s.name ?? '—' }}</td>
              <td class="cell-secondary">
                <span class="source-badge">{{ s.source ?? 'website' }}</span>
              </td>
              <td class="cell-secondary">{{ formatDate(s.subscribed_at) }}</td>
              <td class="cell-action">
                <template v-if="confirmId === s.id">
                  <span class="confirm-text">Remove?</span>
                  <button class="btn-confirm-yes" @click="doDelete(s.id)">Yes</button>
                  <button class="btn-confirm-no"  @click="confirmId = null">No</button>
                </template>
                <button v-else class="btn-delete" @click="confirmId = s.id" title="Remove subscriber">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="meta && meta.last_page > 1" class="pagination">
        <button :disabled="page <= 1" @click="page--">← Prev</button>
        <span>Page {{ page }} of {{ meta.last_page }}</span>
        <button :disabled="page >= meta.last_page" @click="page++">Next →</button>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.view-wrap { padding: 2rem; max-width: 900px; }

.view-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;
}
.header-left { display: flex; align-items: baseline; gap: 0.75rem; }
.view-title {
  font-size: 1.375rem; font-weight: 700; color: #e2e8f0; margin: 0;
}
.subscriber-count {
  font-size: 0.8rem; color: #64748b; font-weight: 500;
}

.btn-export {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #1e293b; color: #94a3b8;
  border: 1px solid #334155; cursor: pointer;
  transition: background 120ms, color 120ms;
}
.btn-export:hover { background: #273549; color: #e2e8f0; }

.toolbar { margin-bottom: 1rem; }
.search-input {
  width: 100%; max-width: 360px;
  padding: 0.5rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #1e293b; background: #0f172a;
  color: #e2e8f0; font-size: 0.875rem; outline: none;
}
.search-input:focus { border-color: #334155; }

.state-msg { color: #64748b; padding: 2rem 0; font-size: 0.9rem; }
.state-msg--error { color: #f87171; }

.table-wrap { overflow-x: auto; }

.sub-table {
  width: 100%; border-collapse: collapse;
  font-size: 0.8375rem;
}
.sub-table th {
  text-align: left; padding: 0.5rem 0.75rem;
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: #475569;
  border-bottom: 1px solid #1e293b;
}
.sub-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid #0f172a;
  vertical-align: middle;
}
.sub-table tr:hover td { background: #0d0d25; }

.cell-email    { color: #e2e8f0; font-weight: 500; }
.cell-secondary { color: #64748b; }
.cell-action   { text-align: right; white-space: nowrap; }

.source-badge {
  display: inline-block;
  padding: 0.1rem 0.4rem; border-radius: 0.25rem;
  font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  background: #1e293b; color: #64748b;
}

.confirm-text  { font-size: 0.78rem; color: #94a3b8; margin-right: 0.375rem; }
.btn-confirm-yes {
  padding: 0.2rem 0.6rem; border-radius: 0.25rem;
  font-size: 0.75rem; font-weight: 600;
  background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b;
  cursor: pointer; margin-right: 0.25rem;
  transition: background 100ms;
}
.btn-confirm-yes:hover { background: #991b1b; }
.btn-confirm-no {
  padding: 0.2rem 0.6rem; border-radius: 0.25rem;
  font-size: 0.75rem; font-weight: 600;
  background: #1e293b; color: #94a3b8; border: 1px solid #334155;
  cursor: pointer;
  transition: background 100ms;
}
.btn-confirm-no:hover { background: #273549; }

.btn-delete {
  padding: 0.3rem; border-radius: 0.375rem;
  background: transparent; border: 1px solid transparent;
  color: #475569; cursor: pointer;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.btn-delete:hover { background: #1f0a0a; color: #f87171; border-color: #7f1d1d; }

.pagination {
  display: flex; align-items: center; gap: 0.75rem;
  margin-top: 1.5rem; color: #64748b; font-size: 0.875rem;
}
.pagination button {
  padding: 0.35rem 0.75rem; border-radius: 0.375rem;
  background: #1e293b; color: #94a3b8;
  border: 1px solid #334155; cursor: pointer; font-size: 0.8125rem;
  transition: background 100ms;
}
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination button:not(:disabled):hover { background: #273549; }
</style>
