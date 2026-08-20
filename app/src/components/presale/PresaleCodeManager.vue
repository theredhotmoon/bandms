<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { useAuth } from '@/composables/useAuth'
import { fetchPresaleCodes, createPresaleCodes, deletePresaleCode } from '@/api/presale'
import type { CreatePresaleCodesPayload } from '@/api/presale'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'

interface Props {
  concertId: number
  tiers: Array<{ id: number; name: string }>
}

const props = defineProps<Props>()

const { token } = useAuth()
const qc = useQueryClient()
const qk = computed(() => ['presale-codes', props.concertId])

// ── Query ─────────────────────────────────────────────────────────────────────

const query = useQuery({
  queryKey: qk,
  queryFn: () => fetchPresaleCodes(token.value!, props.concertId),
  enabled: computed(() => !!token.value),
})

// ── Generate form state ───────────────────────────────────────────────────────

const form = ref<{
  description: string
  count: number
  valid_from: string
  valid_until: string
  tier_ids: number[]
}>({
  description: '',
  count: 1,
  valid_from: '',
  valid_until: '',
  tier_ids: [],
})

function resetForm() {
  form.value = { description: '', count: 1, valid_from: '', valid_until: '', tier_ids: [] }
}

function toggleTier(id: number) {
  const idx = form.value.tier_ids.indexOf(id)
  if (idx === -1) {
    form.value.tier_ids.push(id)
  } else {
    form.value.tier_ids.splice(idx, 1)
  }
}

// ── Create mutation ───────────────────────────────────────────────────────────

const create = useMutation({
  mutationFn: (payload: CreatePresaleCodesPayload) => createPresaleCodes(token.value!, payload),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: qk.value })
    toast.success('Codes generated')
    resetForm()
  },
  onError: () => toast.error('Failed to generate codes'),
})

function handleGenerate() {
  if (!form.value.description.trim()) {
    toast.error('Description is required')
    return
  }
  const payload: CreatePresaleCodesPayload = {
    concert_id: props.concertId,
    description: form.value.description,
    count: form.value.count,
  }
  if (form.value.valid_from) payload.valid_from = form.value.valid_from
  if (form.value.valid_until) payload.valid_until = form.value.valid_until
  if (form.value.tier_ids.length) payload.tier_ids = [...form.value.tier_ids]
  create.mutate(payload)
}

// ── Delete mutation ───────────────────────────────────────────────────────────

const confirmId = ref<number | null>(null)

const remove = useMutation({
  mutationFn: (id: number) => deletePresaleCode(token.value!, id),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: qk.value })
    toast.success('Code deleted')
    confirmId.value = null
  },
  onError: () => toast.error('Failed to delete code'),
})

// ── Copy codes ────────────────────────────────────────────────────────────────

async function copyCodes() {
  const codes = (query.data.value ?? []).map(c => c.code).join('\n')
  await navigator.clipboard.writeText(codes)
  toast.success('Codes copied to clipboard')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}
</script>

<template>
  <div class="presale-manager">
    <!-- Generate form -->
    <div class="generate-form">
      <h3 class="section-title">Generate Pre-sale Codes</h3>

      <div class="form-grid">
        <div class="form-field full-width">
          <label class="field-label">Description <span class="required">*</span></label>
          <input
            v-model="form.description"
            type="text"
            class="field-input"
            placeholder="e.g. Early bird discount"
            maxlength="255"
          />
        </div>

        <div class="form-field">
          <label class="field-label">Count (1–100)</label>
          <input
            v-model.number="form.count"
            type="number"
            class="field-input"
            min="1"
            max="100"
          />
        </div>

        <div class="form-field">
          <label class="field-label">Valid from</label>
          <input v-model="form.valid_from" type="date" class="field-input" />
        </div>

        <div class="form-field">
          <label class="field-label">Valid until</label>
          <input v-model="form.valid_until" type="date" class="field-input" />
        </div>

        <div v-if="tiers.length" class="form-field full-width">
          <label class="field-label">Apply to price tiers</label>
          <div class="tier-checks">
            <label v-for="tier in tiers" :key="tier.id" class="tier-check-label">
              <input
                type="checkbox"
                :checked="form.tier_ids.includes(tier.id)"
                @change="toggleTier(tier.id)"
              />
              {{ tier.name }}
            </label>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button
          class="btn-primary"
          :disabled="create.isPending.value"
          @click="handleGenerate"
        >
          {{ create.isPending.value ? 'Generating…' : 'Generate' }}
        </button>
      </div>
    </div>

    <!-- Table header actions -->
    <div class="table-header">
      <h3 class="section-title">Codes</h3>
      <button
        v-if="(query.data.value ?? []).length"
        class="btn-secondary"
        @click="copyCodes"
      >
        Copy codes
      </button>
    </div>

    <!-- Loading / error / empty -->
    <div v-if="query.isPending.value" class="status-msg">Loading…</div>
    <div v-else-if="query.isError.value" class="status-msg error">Failed to load codes.</div>
    <div v-else-if="!query.data.value?.length" class="status-msg muted">No codes yet.</div>

    <!-- Codes table -->
    <table v-else class="codes-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Description</th>
          <th>Used / Max</th>
          <th>Valid from</th>
          <th>Valid until</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="code in query.data.value" :key="code.id">
          <td class="code-cell">{{ code.code }}</td>
          <td>{{ code.description }}</td>
          <td>{{ code.used_count }} / {{ code.max_uses ?? '∞' }}</td>
          <td>{{ formatDate(code.valid_from) }}</td>
          <td>{{ formatDate(code.valid_until) }}</td>
          <td>
            <button class="btn-danger-sm" @click="confirmId = code.id">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Confirm delete dialog -->
    <ConfirmDialog
      :open="confirmId !== null"
      message="Delete this pre-sale code? This cannot be undone."
      :loading="remove.isPending.value"
      @confirm="remove.mutate(confirmId!)"
      @cancel="confirmId = null"
    />
  </div>
</template>

<style scoped>
.presale-manager {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0 0 0.75rem;
}

.generate-form {
  background: #111111;
  border: 1px solid #222222;
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-field { display: flex; flex-direction: column; gap: 0.35rem; }
.form-field.full-width { grid-column: 1 / -1; }

.field-label { font-size: 0.8125rem; color: #94a3b8; }
.required { color: #f87171; }

.field-input {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 0.5rem;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: #e2e8f0;
  outline: none;
  transition: border-color 120ms;
}
.field-input:focus { border-color: #3b82f6; }

.tier-checks { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.tier-check-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: #cbd5e1;
  cursor: pointer;
}

.form-actions { margin-top: 0.75rem; display: flex; justify-content: flex-end; }

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.table-header .section-title { margin: 0; }

.status-msg { font-size: 0.875rem; color: #94a3b8; }
.status-msg.error { color: #f87171; }
.status-msg.muted { color: #475569; }

.codes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.codes-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid #1e1e1e;
}
.codes-table td {
  padding: 0.6rem 0.75rem;
  color: #cbd5e1;
  border-bottom: 1px solid #1a1a1a;
}
.code-cell { font-family: monospace; letter-spacing: 0.05em; color: #93c5fd; }

.btn-primary {
  padding: 0.45rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  background: #1d4ed8;
  border: none;
  color: #fff;
  cursor: pointer;
  transition: background 120ms;
}
.btn-primary:hover:not(:disabled) { background: #1e40af; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.4rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #94a3b8;
  cursor: pointer;
  transition: background 120ms;
}
.btn-secondary:hover { background: #1a1a1a; }

.btn-danger-sm {
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: #7f1d1d;
  border: none;
  color: #fca5a5;
  cursor: pointer;
  transition: background 120ms;
}
.btn-danger-sm:hover { background: #991b1b; }
</style>
