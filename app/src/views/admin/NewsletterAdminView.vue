<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUiLang } from '@/composables/useUiLang'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useNewsletterSubscribers } from '@/composables/useNewsletterSubscribers'
import type { NewsletterSubscriber } from '@/types/newsletterSubscriber'
import { reportSaveError } from '@/utils/formErrors'
import { ApiError } from '@/api/client'

const { t } = useI18n()
const { uiLang } = useUiLang()

const { query, remove, update, page } = useNewsletterSubscribers()

// The API keeps the list to superadmins; anyone else gets a 403 and a sentence.
const forbidden = computed(() => query.error.value instanceof ApiError && query.error.value.status === 403)

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
    toast.success(t('content.newsletter.removed'))
  } catch (e) {
    reportSaveError(e, t('content.newsletter.removeFailed'))
  } finally {
    confirmId.value = null
  }
}

// ── Inline edit ──────────────────────────────────────────────────────────────
const editingId   = ref<number | null>(null)
const draft       = ref({ email: '', name: '' })
const fieldErrors = ref<Record<string, string[]>>({})
const editingOriginalEmail = ref('')

// The server lower-cases and trims, so compare the same way — a case-only
// edit is not a new address and sends no mail.
const emailChanged = computed(() =>
  draft.value.email.trim().toLowerCase() !== editingOriginalEmail.value.toLowerCase(),
)

function startEdit(s: NewsletterSubscriber) {
  confirmId.value = null
  editingId.value = s.id
  editingOriginalEmail.value = s.email
  draft.value = { email: s.email, name: s.name ?? '' }
  fieldErrors.value = {}
}

function cancelEdit() {
  editingId.value = null
  fieldErrors.value = {}
}

// A row filtered out or paged away must not come back still in edit (or
// remove-confirm) mode holding a forgotten draft.
watch([search, page], () => {
  cancelEdit()
  confirmId.value = null
})

async function saveEdit(id: number) {
  // Enter in an input bypasses the disabled Save button; each extra PUT of a
  // changed address would rotate the token and send another mail.
  if (update.isPending.value) return
  fieldErrors.value = {}
  try {
    const result = await update.mutateAsync({
      id,
      payload: { email: draft.value.email.trim(), name: draft.value.name.trim() || null },
    })
    if (result.email_changed && !result.confirmation_sent) {
      toast.warning(t('content.newsletter.savedConfirmationFailed', { email: result.data.email }))
    } else {
      toast.success(result.confirmation_sent
        ? t('content.newsletter.savedConfirmationSent', { email: result.data.email })
        : t('content.newsletter.saved'))
    }
    editingId.value = null
  } catch (e) {
    reportSaveError(e, t('content.newsletter.saveFailed'), fieldErrors)
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(uiLang.value, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function exportCsv() {
  const rows = [[t('content.newsletter.csv.email'), t('content.newsletter.csv.name'), t('content.newsletter.csv.source'), t('content.newsletter.csv.subscribedAt'), t('content.newsletter.csv.status')]]
  for (const s of subscribers.value) {
    rows.push([s.email, s.name ?? '', s.source ?? '', formatDate(s.subscribed_at), s.confirmed_at ? t('content.newsletter.status.confirmed') : t('content.newsletter.status.pending')])
  }
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
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
          <h1 class="view-title">{{ $t('content.newsletter.title') }}</h1>
          <span class="subscriber-count">{{ $t('content.newsletter.subscribers', { n: total }, total) }}</span>
        </div>
        <button v-if="subscribers.length" class="btn-export" @click="exportCsv">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          {{ $t('content.newsletter.exportCsv') }}
        </button>
      </div>

      <div class="toolbar">
        <input
          v-model="search"
          type="search"
          class="search-input"
          :placeholder="$t('content.newsletter.searchPlaceholder')"
        />
      </div>

      <div v-if="query.isPending.value" class="state-msg">{{ $t('common.state.loading') }}</div>
      <div v-else-if="forbidden" class="state-msg" data-testid="newsletter-forbidden">{{ $t('content.newsletter.forbidden') }}</div>
      <div v-else-if="query.isError.value" class="state-msg state-msg--error">{{ $t('content.newsletter.loadFailed') }}</div>
      <div v-else-if="!subscribers.length" class="state-msg">{{ $t('content.newsletter.empty') }}</div>
      <div v-else-if="!filtered.length" class="state-msg">{{ $t('content.newsletter.noResults', { q: search }) }}</div>

      <div v-else class="table-wrap">
        <table class="sub-table">
          <thead>
            <tr>
              <th>{{ $t('common.fields.email') }}</th>
              <th>{{ $t('common.fields.name') }}</th>
              <th>{{ $t('content.newsletter.columns.source') }}</th>
              <th>{{ $t('content.newsletter.columns.subscribed') }}</th>
              <th>{{ $t('content.newsletter.columns.status') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.id" :data-testid="`subscriber-row-${s.id}`">
              <template v-if="editingId === s.id">
                <td class="cell-edit">
                  <input
                    v-model="draft.email"
                    type="email"
                    class="edit-input"
                    :class="{ 'edit-input--error': fieldErrors.email }"
                    :aria-label="$t('common.fields.email')"
                    data-testid="subscriber-email-input"
                    @keydown.enter="saveEdit(s.id)"
                    @keydown.esc="cancelEdit"
                  />
                  <p v-if="fieldErrors.email" class="edit-error">{{ fieldErrors.email[0] }}</p>
                  <p v-else-if="emailChanged" class="edit-hint" data-testid="subscriber-email-hint">
                    {{ $t('content.newsletter.emailChangeHint') }}
                  </p>
                </td>
                <td class="cell-edit">
                  <input
                    v-model="draft.name"
                    type="text"
                    class="edit-input"
                    :class="{ 'edit-input--error': fieldErrors.name }"
                    :aria-label="$t('common.fields.name')"
                    :placeholder="$t('content.newsletter.namePlaceholder')"
                    data-testid="subscriber-name-input"
                    @keydown.enter="saveEdit(s.id)"
                    @keydown.esc="cancelEdit"
                  />
                  <p v-if="fieldErrors.name" class="edit-error">{{ fieldErrors.name[0] }}</p>
                </td>
              </template>
              <template v-else>
                <td class="cell-email">{{ s.email }}</td>
                <td class="cell-secondary">{{ s.name ?? '—' }}</td>
              </template>
              <td class="cell-secondary">
                <span class="source-badge">{{ s.source ?? 'website' }}</span>
              </td>
              <td class="cell-secondary">{{ formatDate(s.subscribed_at) }}</td>
              <td class="cell-secondary">
                <span class="status-badge" :class="s.confirmed_at ? 'status-badge--confirmed' : 'status-badge--pending'">
                  {{ s.confirmed_at ? t('content.newsletter.status.confirmed') : t('content.newsletter.status.pending') }}
                </span>
              </td>
              <td class="cell-action">
                <template v-if="editingId === s.id">
                  <button
                    class="btn-save"
                    :disabled="update.isPending.value"
                    data-testid="subscriber-save"
                    @click="saveEdit(s.id)"
                  >{{ $t('content.newsletter.save') }}</button>
                  <button class="btn-confirm-no" @click="cancelEdit">{{ $t('content.newsletter.cancel') }}</button>
                </template>
                <template v-else-if="confirmId === s.id">
                  <span class="confirm-text">{{ $t('content.newsletter.confirmRemove') }}</span>
                  <button class="btn-confirm-yes" @click="doDelete(s.id)">{{ $t('content.newsletter.yes') }}</button>
                  <button class="btn-confirm-no"  @click="confirmId = null">{{ $t('content.newsletter.no') }}</button>
                </template>
                <template v-else>
                <button
                  class="btn-icon"
                  :title="$t('content.newsletter.editTitle')"
                  :aria-label="$t('content.newsletter.editTitle')"
                  data-testid="subscriber-edit"
                  @click="startEdit(s)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
                  </svg>
                </button>
                <button class="btn-delete" @click="confirmId = s.id" :title="$t('content.newsletter.removeTitle')" :aria-label="$t('content.newsletter.removeTitle')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="meta && meta.last_page > 1" class="pagination">
        <button :disabled="page <= 1" @click="page--">{{ $t('common.pagination.prevShort') }}</button>
        <span>{{ $t('common.pagination.pageOf', { page, total: meta.last_page }) }}</span>
        <button :disabled="page >= meta.last_page" @click="page++">{{ $t('common.pagination.nextShort') }}</button>
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
  font-size: var(--fs-xl); font-weight: 700; color: var(--c-e2e8f0); margin: 0;
}
.subscriber-count {
  font-size: var(--fs-sm); color: var(--c-64748b); font-weight: 500;
}

.btn-export {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.875rem; border-radius: 0.5rem;
  font-size: var(--fs-sm); font-weight: 500;
  background: var(--c-1f1f1f); color: var(--c-94a3b8);
  border: 1px solid var(--c-334155-line); cursor: pointer;
  transition: background 120ms, color 120ms;
}
.btn-export:hover { background: var(--c-273549); color: var(--c-e2e8f0); }

.toolbar { margin-bottom: 1rem; }
.search-input {
  width: 100%; max-width: 360px;
  padding: 0.5rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid var(--c-1f1f1f); background: var(--c-0d0d0d);
  color: var(--c-e2e8f0); font-size: var(--fs-base); outline: none;
}
.search-input:focus { border-color: var(--c-334155-line); }

.state-msg { color: var(--c-64748b); padding: 2rem 0; font-size: var(--fs-base); }
.state-msg--error { color: var(--c-f87171); }

.table-wrap { overflow-x: auto; }

.sub-table {
  width: 100%; border-collapse: collapse;
  font-size: var(--fs-sm);
}
.sub-table th {
  text-align: left; padding: 0.5rem 0.75rem;
  font-size: var(--fs-2xs); font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-475569);
  border-bottom: 1px solid var(--c-1f1f1f);
}
.sub-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--c-0d0d0d);
  vertical-align: middle;
}
.sub-table tr:hover td { background: var(--c-181818); }

.cell-email    { color: var(--c-e2e8f0); font-weight: 500; }
.cell-secondary { color: var(--c-64748b); }
.cell-action   { text-align: right; white-space: nowrap; }

.source-badge {
  display: inline-block;
  padding: 0.1rem 0.4rem; border-radius: 0.25rem;
  font-size: var(--fs-2xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  background: var(--c-1f1f1f); color: var(--c-64748b);
}

.status-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem; border-radius: 0.25rem;
  font-size: var(--fs-2xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
}
.status-badge--confirmed { background: var(--c-052e16); color: var(--c-4ade80); }
.status-badge--pending   { background: var(--c-1c1107); color: var(--c-fbbf24); }

.confirm-text  { font-size: var(--fs-xs); color: var(--c-94a3b8); margin-right: 0.375rem; }
.btn-confirm-yes {
  padding: 0.2rem 0.6rem; border-radius: 0.25rem;
  font-size: var(--fs-xs); font-weight: 600;
  background: var(--c-7f1d1d); color: var(--c-fca5a5); border: 1px solid var(--c-991b1b);
  cursor: pointer; margin-right: 0.25rem;
  transition: background 100ms;
}
.btn-confirm-yes:hover { background: var(--c-991b1b); }
.btn-confirm-no {
  padding: 0.2rem 0.6rem; border-radius: 0.25rem;
  font-size: var(--fs-xs); font-weight: 600;
  background: var(--c-1f1f1f); color: var(--c-94a3b8); border: 1px solid var(--c-334155-line);
  cursor: pointer;
  transition: background 100ms;
}
.btn-confirm-no:hover { background: var(--c-273549); }

.cell-edit { vertical-align: top; }
.edit-input {
  width: 100%; min-width: 10rem;
  padding: 0.35rem 0.5rem; border-radius: 0.375rem;
  border: 1px solid var(--c-334155-line); background: var(--c-0d0d0d);
  color: var(--c-e2e8f0); font-size: var(--fs-sm); outline: none;
}
.edit-input:focus { border-color: var(--c-94a3b8); }
.edit-input--error { border-color: var(--c-f87171); }
.edit-hint  { margin: 0.35rem 0 0; font-size: var(--fs-2xs); color: var(--c-fbbf24); max-width: 22rem; }
.edit-error { margin: 0.35rem 0 0; font-size: var(--fs-2xs); color: var(--c-f87171); }

.btn-save {
  padding: 0.2rem 0.6rem; border-radius: 0.25rem;
  font-size: var(--fs-xs); font-weight: 600;
  background: var(--c-052e16); color: var(--c-4ade80); border: 1px solid var(--c-4ade80);
  cursor: pointer; margin-right: 0.25rem;
}
.btn-save:disabled { opacity: 0.5; cursor: wait; }

.btn-icon {
  padding: 0.3rem; border-radius: 0.375rem; margin-right: 0.25rem;
  background: transparent; border: 1px solid transparent;
  color: var(--c-475569); cursor: pointer;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.btn-icon:hover { background: var(--c-1f1f1f); color: var(--c-e2e8f0); border-color: var(--c-334155-line); }

.btn-delete {
  padding: 0.3rem; border-radius: 0.375rem;
  background: transparent; border: 1px solid transparent;
  color: var(--c-475569); cursor: pointer;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.btn-delete:hover { background: var(--c-1f0a0a); color: var(--c-f87171); border-color: var(--c-7f1d1d); }

.pagination {
  display: flex; align-items: center; gap: 0.75rem;
  margin-top: 1.5rem; color: var(--c-64748b); font-size: var(--fs-base);
}
.pagination button {
  padding: 0.35rem 0.75rem; border-radius: 0.375rem;
  background: var(--c-1f1f1f); color: var(--c-94a3b8);
  border: 1px solid var(--c-334155-line); cursor: pointer; font-size: var(--fs-sm);
  transition: background 100ms;
}
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination button:not(:disabled):hover { background: var(--c-273549); }
</style>
