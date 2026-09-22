<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useConcertTickets } from '@/composables/useConcertTickets'
import { reportSaveError } from '@/utils/formErrors'
import type { TicketType, PriceTier, TicketTypePayload, PriceTierPayload } from '@/types/ticket'

const { t } = useI18n()

const props = defineProps<{ concertId: number }>()

const concertIdRef = computed(() => props.concertId)
const { query, createType, updateType, deleteType, createTier, updateTier, deleteTier } = useConcertTickets(concertIdRef)

// ── Ticket type form ──────────────────────────────────────────────────────
const showTypeForm = ref(false)
const editingType = ref<TicketType | null>(null)
const typeForm = ref({ name: '', description: '', available_from: '', on_sale_until: '', max_per_order: '', price: '', currency: 'PLN' /* i18n-ignore: ISO currency code */, total_tickets: '' })
const typeErrors = ref<Record<string, string[]>>({})

// Show inline price/currency/total fields when creating or editing a 0-or-1-tier type.
// Types with 2+ tiers (e.g. Early Bird + Regular) use the per-tier UI instead.
const showInlinePricing = computed(() =>
  editingType.value === null || editingType.value.tiers.length <= 1
)

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return ''
  // Trim to YYYY-MM-DDTHH:MM for datetime-local input
  return iso.slice(0, 16)
}

function openCreateType() {
  tierModal.value = null
  editingType.value = null
  typeForm.value = { name: '', description: '', available_from: '', on_sale_until: '', max_per_order: '', price: '', currency: 'PLN' /* i18n-ignore: ISO currency code */, total_tickets: '' }
  typeErrors.value = {}
  showTypeForm.value = true
}

function openEditType(type: TicketType) {
  tierModal.value = null
  editingType.value = type
  const singleTier = type.tiers.length === 1 ? type.tiers[0] : null
  typeForm.value = {
    name: type.name,
    description: type.description ?? '',
    available_from: toLocalDatetime(type.available_from),
    on_sale_until: toLocalDatetime(type.on_sale_until),
    max_per_order: type.max_per_order != null ? String(type.max_per_order) : '',
    price: singleTier ? String(singleTier.price) : '',
    currency: singleTier ? singleTier.currency : 'PLN', /* i18n-ignore: ISO currency code */
    total_tickets: singleTier?.available_count != null ? String(singleTier.available_count) : '',
  }
  typeErrors.value = {}
  showTypeForm.value = true
}

async function submitType() {
  typeErrors.value = {}
  const payload: TicketTypePayload = {
    name: typeForm.value.name,
    description: typeForm.value.description || null,
    available_from: typeForm.value.available_from || null,
    on_sale_until: typeForm.value.on_sale_until || null,
    max_per_order: typeForm.value.max_per_order ? parseInt(typeForm.value.max_per_order) : null,
    price: typeForm.value.price !== '' ? parseFloat(typeForm.value.price) : null,
    currency: typeForm.value.currency || null,
    total_tickets: typeForm.value.total_tickets ? parseInt(typeForm.value.total_tickets) : null,
  }
  try {
    if (editingType.value) {
      await updateType.mutateAsync({ id: editingType.value.id, payload })
      toast.success(t('shows.tickets.manager.typeUpdated'))
    } else {
      await createType.mutateAsync(payload)
      toast.success(t('shows.tickets.manager.typeCreated'))
    }
    showTypeForm.value = false
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), typeErrors)
  }
}

async function removeType(type: TicketType) {
  if (!confirm(t('shows.tickets.manager.confirmDeleteType', { name: type.name }))) return
  try {
    await deleteType.mutateAsync(type.id)
    toast.success(t('shows.tickets.manager.typeDeleted'))
  } catch (e) { reportSaveError(e, t('common.state.deleteFailed')) }
}

// ── Price tier form ───────────────────────────────────────────────────────
const tierModal = ref<{ typeId: number; tier: PriceTier | null } | null>(null)
const tierForm = ref({ name: '', price: '', currency: 'PLN' /* i18n-ignore: ISO currency code */, available_from: '', available_until: '', available_count: '', sort_order: '0' })
const tierErrors = ref<Record<string, string[]>>({})

function openCreateTier(typeId: number) {
  showTypeForm.value = false
  tierModal.value = { typeId, tier: null }
  tierForm.value = { name: '', price: '', currency: 'PLN' /* i18n-ignore: ISO currency code */, available_from: '', available_until: '', available_count: '', sort_order: '0' }
  tierErrors.value = {}
}

function openEditTier(typeId: number, tier: PriceTier) {
  showTypeForm.value = false
  tierModal.value = { typeId, tier }
  tierForm.value = {
    name: tier.name,
    price: String(tier.price),
    currency: tier.currency,
    available_from: tier.available_from ?? '',
    available_until: tier.available_until ?? '',
    available_count: tier.available_count != null ? String(tier.available_count) : '',
    sort_order: String(tier.sort_order),
  }
  tierErrors.value = {}
}

async function submitTier() {
  if (!tierModal.value) return
  tierErrors.value = {}
  const payload: PriceTierPayload = {
    name: tierForm.value.name,
    price: parseFloat(tierForm.value.price),
    currency: tierForm.value.currency,
    available_from: tierForm.value.available_from || null,
    available_until: tierForm.value.available_until || null,
    available_count: tierForm.value.available_count ? parseInt(tierForm.value.available_count) : null,
    sort_order: parseInt(tierForm.value.sort_order ?? '0'),
  }
  try {
    const { typeId, tier } = tierModal.value
    if (tier) {
      await updateTier.mutateAsync({ typeId, tierId: tier.id, payload })
      toast.success(t('shows.tickets.manager.tierUpdated'))
    } else {
      await createTier.mutateAsync({ typeId, payload })
      toast.success(t('shows.tickets.manager.tierCreated'))
    }
    tierModal.value = null
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), tierErrors)
  }
}

async function removeTier(typeId: number, tier: PriceTier) {
  if (!confirm(t('shows.tickets.manager.confirmDeleteTier', { name: tier.name }))) return
  try {
    await deleteTier.mutateAsync({ typeId, tierId: tier.id })
    toast.success(t('shows.tickets.manager.tierDeleted'))
  } catch (e) { reportSaveError(e, t('common.state.deleteFailed')) }
}

function fmtPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(price)
}
</script>

<template>
  <div class="tkm">
    <div class="tkm-header">
      <span class="tkm-title">{{ $t('shows.tickets.manager.title') }}</span>
      <button class="btn-add" @click="openCreateType">{{ $t('shows.tickets.manager.addType') }}</button>
    </div>

    <div v-if="query.isPending.value" class="tkm-state">{{ $t('common.state.loading') }}</div>
    <div v-else-if="query.isError.value" class="tkm-state err">{{ $t('shows.tickets.manager.loadFailed') }}</div>
    <div v-else-if="!query.data.value?.length" class="tkm-state">{{ $t('shows.tickets.manager.empty') }}</div>

    <div v-else class="type-list">
      <div v-for="tt in query.data.value" :key="tt.id" class="type-card">
        <!-- Type header -->
        <div class="type-head">
          <div class="type-meta">
            <span class="type-name">{{ tt.name }}</span>
            <span class="type-sold">{{ $t('shows.tickets.manager.soldCount', { n: tt.sold_count }) }}</span>
            <span v-if="tt.active_tier" class="badge badge-sale">
              {{ $t('shows.tickets.manager.onSalePrice', { price: fmtPrice(tt.active_tier.price, tt.active_tier.currency) }) }}
            </span>
            <span v-else class="badge badge-off">{{ $t('shows.tickets.manager.notOnSale') }}</span>
            <span v-if="tt.available_from" class="type-info">{{ $t('shows.tickets.manager.fromDate', { date: tt.available_from.slice(0, 16).replace('T', ' ') }) }}</span>
            <span v-if="tt.on_sale_until" class="type-info">{{ $t('shows.tickets.manager.untilDate', { date: tt.on_sale_until.slice(0, 16).replace('T', ' ') }) }}</span>
            <span v-if="tt.max_per_order" class="type-info">{{ $t('shows.tickets.manager.maxPerOrderCount', { n: tt.max_per_order }) }}</span>
          </div>
          <div class="type-actions">
            <button class="btn-edit" @click="openEditType(tt)">{{ $t('common.actions.edit') }}</button>
            <button class="btn-delete" @click="removeType(tt)">{{ $t('common.actions.delete') }}</button>
          </div>
        </div>

        <!-- Tiers -->
        <div class="tiers">
          <div v-if="!tt.tiers.length" class="tier-empty">{{ $t('shows.tickets.manager.noTiers') }}</div>
          <div v-for="tier in tt.tiers" :key="tier.id" class="tier-row">
            <span class="tier-name">{{ tier.name }}</span>
            <span class="tier-price">{{ fmtPrice(tier.price, tier.currency) }}</span>
            <span v-if="tier.available_from || tier.available_until" class="tier-dates">
              {{ tier.available_from ?? '—' }} → {{ tier.available_until ?? '—' }}
            </span>
            <span v-if="tier.available_count != null" class="tier-count">
              {{ $t('shows.tickets.manager.leftCount', { available: tier.available_count - tier.sold_count, total: tier.available_count }) }}
            </span>
            <div class="tier-acts">
              <button class="btn-edit-sm" @click="openEditTier(tt.id, tier)">{{ $t('common.actions.edit') }}</button>
              <button class="btn-del-sm" @click="removeTier(tt.id, tier)">✕</button>
            </div>
          </div>
          <button class="btn-add-tier" @click="openCreateTier(tt.id)">{{ $t('shows.tickets.manager.addTier') }}</button>
        </div>
      </div>
    </div>

    <!-- Type form inline -->
    <div v-if="showTypeForm" class="form-panel">
      <div class="form-title">{{ editingType ? $t('shows.tickets.manager.editType') : $t('shows.tickets.manager.newType') }}</div>
      <div class="field">
        <label class="lbl"><i18n-t keypath="common.fields.name" tag="span" scope="global" /> *</label>
        <input v-model="typeForm.name" class="inp" required />
        <p v-if="typeErrors.name" class="err-txt">{{ typeErrors.name[0] }}</p>
      </div>
      <div class="field">
        <label class="lbl">{{ $t('common.fields.description') }}</label>
        <textarea v-model="typeForm.description" class="inp" rows="2" />
      </div>
      <div v-if="showInlinePricing" class="field-row">
        <div class="field">
          <label class="lbl">{{ $t('shows.tickets.manager.price') }}</label>
          <input v-model="typeForm.price" type="number" step="0.01" min="0" class="inp" placeholder="e.g. 25.00" />
          <p v-if="typeErrors.price" class="err-txt">{{ typeErrors.price[0] }}</p>
        </div>
        <div class="field" style="max-width:7rem;">
          <label class="lbl">{{ $t('shows.tickets.manager.currency') }}</label>
          <input v-model="typeForm.currency" class="inp" maxlength="3" style="text-transform:uppercase;" />
        </div>
        <div class="field" style="max-width:10rem;">
          <label class="lbl">{{ $t('shows.tickets.manager.totalTickets') }}</label>
          <input v-model="typeForm.total_tickets" type="number" min="1" class="inp" :placeholder="$t('shows.tickets.manager.unlimited')" />
          <p v-if="typeErrors.total_tickets" class="err-txt">{{ typeErrors.total_tickets[0] }}</p>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="lbl">{{ $t('shows.tickets.manager.onSaleFrom') }}</label>
          <input v-model="typeForm.available_from" type="datetime-local" class="inp" />
          <p v-if="typeErrors.available_from" class="err-txt">{{ typeErrors.available_from[0] }}</p>
        </div>
        <div class="field">
          <label class="lbl">{{ $t('shows.tickets.manager.saleCutoff') }}</label>
          <input v-model="typeForm.on_sale_until" type="datetime-local" class="inp" />
          <p v-if="typeErrors.on_sale_until" class="err-txt">{{ typeErrors.on_sale_until[0] }}</p>
        </div>
        <div class="field" style="max-width:10rem;">
          <label class="lbl">{{ $t('shows.tickets.manager.maxPerOrder') }}</label>
          <input v-model="typeForm.max_per_order" type="number" min="1" class="inp" :placeholder="$t('shows.tickets.manager.unlimited')" />
          <p v-if="typeErrors.max_per_order" class="err-txt">{{ typeErrors.max_per_order[0] }}</p>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-ghost" @click="showTypeForm = false">{{ $t('common.actions.cancel') }}</button>
        <button class="btn-primary" :disabled="createType.isPending.value || updateType.isPending.value" @click="submitType">
          {{ createType.isPending.value || updateType.isPending.value ? $t('common.actions.saving') : $t('common.actions.save') }}
        </button>
      </div>
    </div>

    <!-- Tier modal -->
    <div v-if="tierModal" class="form-panel">
      <div class="form-title">{{ tierModal.tier ? $t('shows.tickets.manager.editTier') : $t('shows.tickets.manager.newTier') }}</div>
      <div class="field">
        <label class="lbl"><i18n-t keypath="shows.tickets.manager.tierName" tag="span" scope="global" /> *</label>
        <input v-model="tierForm.name" class="inp" :placeholder="$t('shows.tickets.manager.tierNamePlaceholder')" required />
        <p v-if="tierErrors.name" class="err-txt">{{ tierErrors.name[0] }}</p>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="lbl"><i18n-t keypath="shows.tickets.manager.price" tag="span" scope="global" /> *</label>
          <input v-model="tierForm.price" type="number" step="0.01" min="0" class="inp" />
          <p v-if="tierErrors.price" class="err-txt">{{ tierErrors.price[0] }}</p>
        </div>
        <div class="field" style="max-width:7rem;">
          <label class="lbl">{{ $t('shows.tickets.manager.currency') }}</label>
          <input v-model="tierForm.currency" class="inp" maxlength="3" style="text-transform:uppercase;" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="lbl">{{ $t('shows.tickets.manager.availableFrom') }}</label>
          <input v-model="tierForm.available_from" type="date" class="inp" />
        </div>
        <div class="field">
          <label class="lbl">{{ $t('shows.tickets.manager.availableUntil') }}</label>
          <input v-model="tierForm.available_until" type="date" class="inp" />
        </div>
      </div>
      <div class="field-row">
        <div class="field" style="max-width:12rem;">
          <label class="lbl">{{ $t('shows.tickets.manager.ticketCount') }}</label>
          <input v-model="tierForm.available_count" type="number" min="1" class="inp" :placeholder="$t('shows.tickets.manager.unlimited')" />
          <p v-if="tierErrors.available_count" class="err-txt">{{ tierErrors.available_count[0] }}</p>
        </div>
        <div class="field" style="max-width:7rem;">
          <label class="lbl">{{ $t('shows.tickets.manager.sortOrder') }}</label>
          <input v-model="tierForm.sort_order" type="number" min="0" class="inp" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-ghost" @click="tierModal = null">{{ $t('common.actions.cancel') }}</button>
        <button class="btn-primary" :disabled="createTier.isPending.value || updateTier.isPending.value" @click="submitTier">
          {{ createTier.isPending.value || updateTier.isPending.value ? $t('common.actions.saving') : $t('common.actions.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tkm { display: flex; flex-direction: column; gap: 12px; }
.tkm-header { display: flex; justify-content: space-between; align-items: center; }
.tkm-title { font: 600 13px/1 system-ui; color: #e2e8f0; }
.tkm-state { font-size: 13px; color: #64748b; padding: 12px 0; }
.tkm-state.err { color: #f87171; }

.type-list { display: flex; flex-direction: column; gap: 8px; }
.type-card { border: 1px solid #2a2a2a; border-radius: 6px; overflow: hidden; }
.type-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 12px; background: #1a1a1a; gap: 10px; }
.type-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.type-name { font: 600 13px/1 system-ui; color: #e2e8f0; }
.type-sold { font-size: 11px; color: #64748b; }
.type-info { font-size: 11px; color: #94a3b8; }
.type-actions { display: flex; gap: 6px; flex-shrink: 0; }

.badge { font: 700 10px/1 system-ui; padding: 3px 7px; border-radius: 4px; letter-spacing: .05em; text-transform: uppercase; }
.badge-sale { background: #14532d; color: #4ade80; }
.badge-off  { background: #2a2a2a; color: #64748b; }

.tiers { display: flex; flex-direction: column; gap: 0; border-top: 1px solid #222; }
.tier-empty { padding: 8px 12px; font-size: 12px; color: #475569; }
.tier-row { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-bottom: 1px solid #1a1a1a; font-size: 12px; }
.tier-row:last-of-type { border-bottom: none; }
.tier-name { color: #d0d0d0; font-weight: 500; min-width: 90px; }
.tier-price { color: #4ade80; font-variant-numeric: tabular-nums; min-width: 70px; }
.tier-dates { color: #64748b; font-size: 11px; }
.tier-count { color: #94a3b8; font-size: 11px; margin-left: auto; }
.tier-acts { display: flex; gap: 4px; margin-left: auto; }
.btn-add-tier { padding: 5px 12px; font-size: 11px; color: #94a3b8; background: transparent; border: none; cursor: pointer; text-align: left; }
.btn-add-tier:hover { color: #e2e8f0; }

.form-panel { border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; background: #111; margin-top: 4px; display: flex; flex-direction: column; gap: 10px; }
.form-title { font: 600 13px/1 system-ui; color: #e2e8f0; margin-bottom: 2px; }
.field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.field-row { display: flex; gap: 10px; }
.lbl { font: 500 11px/1 system-ui; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; }
.inp { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 5px; color: #e2e8f0; padding: 7px 9px; font-size: 13px; width: 100%; box-sizing: border-box; }
.inp:focus { outline: 2px solid #3b82f6; border-color: transparent; }
.err-txt { font-size: 11px; color: #f87171; margin: 0; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

/* Shared btn classes from parent */
.btn-add { padding: 6px 12px; border-radius: 5px; font: 600 12px/1 system-ui; background: #3b82f6; color: #fff; border: none; cursor: pointer; }
.btn-add:hover { background: #2563eb; }
.btn-edit { padding: 4px 10px; border-radius: 4px; font-size: 12px; background: #1e3a5f; color: #93c5fd; border: 1px solid #1e3a5f; cursor: pointer; }
.btn-edit:hover { background: #1d4ed8; color: #fff; }
.btn-delete { padding: 4px 10px; border-radius: 4px; font-size: 12px; background: #3f1515; color: #fca5a5; border: 1px solid #3f1515; cursor: pointer; }
.btn-delete:hover { background: #b91c1c; color: #fff; }
.btn-edit-sm { padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #1e3a5f; color: #93c5fd; border: none; cursor: pointer; }
.btn-del-sm { padding: 2px 6px; border-radius: 4px; font-size: 11px; background: #3f1515; color: #fca5a5; border: none; cursor: pointer; }
.btn-primary { padding: 7px 16px; border-radius: 5px; font: 600 13px/1 system-ui; background: #3b82f6; color: #fff; border: none; cursor: pointer; }
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-primary:disabled { opacity: .5; cursor: default; }
.btn-ghost { padding: 7px 14px; border-radius: 5px; font: 600 13px/1 system-ui; background: transparent; color: #94a3b8; border: 1px solid #2a2a2a; cursor: pointer; }
.btn-ghost:hover { color: #e2e8f0; }
</style>
