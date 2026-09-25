<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useInstruments } from '@/composables/useInstruments'
import { useTableControls } from '@/composables/useTableControls'
import InstrumentIcon from '@bandms/rider-core/components/InstrumentIcon.vue'
import InstrumentIconPicker from '@/components/ui/InstrumentIconPicker.vue'
import type { Instrument, InstrumentPayload } from '@bandms/rider-core'
import { guessInstrumentType } from '@bandms/rider-core'
import { reportSaveError } from '@/utils/formErrors'
import { LOCALES, DEFAULT_LOCALE, emptyBag } from '@/locales'

const { t } = useI18n()

const { query, create, update, remove } = useInstruments()

const showModal = ref(false)
const editing   = ref<Instrument | null>(null)
const form = reactive({ name: emptyBag(), category: null as string | null, stage_plot_type: null as InstrumentPayload['stage_plot_type'] })
const fieldErrors    = ref<Record<string, string[]>>({})
const confirmOpen    = ref(false)
const confirmId      = ref<number | null>(null)
const confirmLoading = ref(false)
const filterCategory = ref('')

// i18n-ignore: these are seeds for a free-text column, not chrome. They get
// STORED in instruments.category, so translating them would have a Polish
// admin create 'Smyczkowe' where an English one created 'Strings' — two
// categories for one thing. Same rule as utils/signalChainPresets.ts.
const CATEGORY_SUGGESTIONS = ['Strings', 'Brass', 'Woodwind', 'Percussion', 'Keys', 'Electronic', 'Vocal', 'Other'] // i18n-ignore: stored data seeds, see above

// Icon suggestion derived from the registry's default-locale name —
// guessInstrumentType's keyword catalogue only matches English terms, and
// DEFAULT_LOCALE is 'en' today, but the literal must not be hardcoded here.
const suggestedType = computed(() => guessInstrumentType(form.name[DEFAULT_LOCALE] ?? ''))

const filteredData = computed(() => {
  const rows = query.data.value ?? []
  return filterCategory.value ? rows.filter((i: Instrument) => i.category === filterCategory.value) : rows
})

const allCategories = computed(() =>
  [...new Set((query.data.value ?? []).map((i: Instrument) => i.category).filter(Boolean) as string[])].sort()
)

const tc = useTableControls<Instrument>({
  data: filteredData,
  searchFn: (i, q) => i.name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q),
  defaultSort: 'name',
})

function openCreate() {
  editing.value        = null
  fieldErrors.value    = {}
  form.name            = emptyBag()
  form.category        = null
  form.stage_plot_type = null
  showModal.value      = true
}

function openEdit(i: Instrument) {
  editing.value        = i
  fieldErrors.value    = {}
  for (const l of LOCALES) form.name[l] = i.translations?.name[l] ?? ''
  form.category        = i.category
  form.stage_plot_type = i.stage_plot_type ?? null
  showModal.value      = true
}

function closeModal() { showModal.value = false; editing.value = null }

async function submit() {
  fieldErrors.value = {}
  const payload: InstrumentPayload = {
    name:            Object.fromEntries(LOCALES.map(l => [l, form.name[l].trim() || null])),
    category:        form.category?.trim() || null,
    stage_plot_type: form.stage_plot_type || null,
  }
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success(t('more.instruments.updated'))
    } else {
      await create.mutateAsync(payload)
      toast.success(t('more.instruments.added'))
    }
    closeModal()
  } catch (e) {
    reportSaveError(e, t('more.instruments.saveFailed'), fieldErrors)
  }
}

function requestDelete(id: number) { confirmId.value = id; confirmOpen.value = true }

async function confirmDelete() {
  if (confirmId.value == null) return
  confirmLoading.value = true
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success(t('more.instruments.deleted'))
  } catch (e) { reportSaveError(e, t('more.instruments.deleteFailed')) }
  finally { confirmLoading.value = false; confirmOpen.value = false; confirmId.value = null }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:#e2e8f0;">{{ $t('more.instruments.title') }}</h1>
          <p class="text-xs mt-0.5" style="color:#334155;">{{ $t('more.instruments.lead') }}</p>
        </div>
        <button @click="openCreate" class="btn-add-primary">{{ $t('more.instruments.add') }}</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">{{ $t('more.instruments.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-if="allCategories.length" v-model="filterCategory" class="filter-select">
                <option value="">{{ $t('more.instruments.allCategories') }}</option>
                <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!(query.data.value?.length)">{{ $t('more.instruments.empty') }}</span>
            <span v-else>{{ $t('more.instruments.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <SortHeader :label="$t('more.instruments.cols.name')" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('more.instruments.cols.category')" sort-key="category" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">{{ $t('more.instruments.cols.stageIcon') }}</th>
                <th class="th text-right" style="width:8rem;">{{ $t('more.instruments.cols.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in tc.paginated.value" :key="i.id" class="table-row">
                <td class="td" style="color:#e2e8f0; font-weight:500;">{{ i.name }}</td>
                <td class="td">
                  <span v-if="i.category" class="category-badge">{{ i.category }}</span>
                  <span v-else style="color:#334155; font-size:0.75rem;">—</span>
                </td>
                <td class="td stage-icon-cell">
                  <InstrumentIcon v-if="i.stage_plot_type" :type="i.stage_plot_type" :size="22" />
                  <span v-else style="color:#334155; font-size:0.75rem;">—</span>
                </td>
                <td class="td text-right">
                  <button @click="openEdit(i)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="requestDelete(i.id)" class="btn-delete">{{ $t('common.actions.delete') }}</button>
                </td>
              </tr>
            </tbody>
          </table>

          <Pagination
            v-if="tc.totalPages.value > 1"
            :page="tc.page.value"
            :total-pages="tc.totalPages.value"
            :total="tc.total.value"
            :per-page="tc.perPage"
            :from="tc.from.value"
            :to="tc.to.value"
            @update:page="tc.page.value = $event"
          />
        </template>
      </div>
    </div>

    <AdminModal :open="showModal" :title="editing ? $t('more.instruments.editTitle') : $t('more.instruments.addTitle')" max-width="28rem" @close="closeModal">
      <form @submit.prevent="submit" class="flex flex-col gap-4">
        <div>
          <label class="field-label">{{ $t('more.instruments.name') }} <span class="field-req">*</span></label>
          <div class="trans-group">
            <div v-for="l in LOCALES" :key="l" class="trans-row">
              <span class="lang-badge" :class="{ 'lang-badge--pl': l !== DEFAULT_LOCALE }">{{ l.toUpperCase() }}</span>
              <input v-model="form.name[l]" class="field-input flex-1" :placeholder="$t('more.instruments.namePlaceholder')" />
            </div>
          </div>
          <template v-for="l in LOCALES" :key="`name-err-${l}`">
            <p v-if="fieldErrors[`name.${l}`]" class="field-error">{{ fieldErrors[`name.${l}`][0] }}</p>
          </template>
          <p v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name[0] }}</p>
        </div>
        <div>
          <label class="field-label">{{ $t('more.instruments.category') }}</label>
          <input v-model="form.category" class="field-input" list="category-suggestions" :placeholder="$t('more.instruments.categoryPlaceholder')" />
          <datalist id="category-suggestions">
            <option v-for="c in CATEGORY_SUGGESTIONS" :key="c" :value="c" />
          </datalist>
        </div>
        <div>
          <label class="field-label">{{ $t('more.instruments.stagePlotIcon') }}</label>
          <InstrumentIconPicker
            :model-value="form.stage_plot_type ?? null"
            clearable
            :placeholder="$t('more.instruments.notMapped')"
            @update:model-value="form.stage_plot_type = $event"
          />
          <button
            v-if="!form.stage_plot_type && suggestedType"
            type="button"
            class="icon-suggestion"
            @click="form.stage_plot_type = suggestedType"
          >
            <InstrumentIcon :type="suggestedType" :size="16" />
            {{ $t('more.instruments.useSuggested', { name: form.name[DEFAULT_LOCALE].trim() }) }}
          </button>
        </div>
        <div class="flex gap-2 justify-end pt-1">
          <button type="button" class="btn-ghost" @click="closeModal">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" :disabled="create.isPending.value || update.isPending.value" class="btn-primary">
            {{ (create.isPending.value || update.isPending.value) ? $t('common.actions.saving') : $t('common.actions.save') }}
          </button>
        </div>
      </form>
    </AdminModal>

    <ConfirmDialog
      :open="confirmOpen"
      :message="$t('more.instruments.deleteMessage')"
      :loading="confirmLoading"
      @confirm="confirmDelete"
      @cancel="confirmOpen = false"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.field-req { color: #f87171; }
.category-badge {
  display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px;
  font-size: 0.7rem; font-weight: 600;
  background: #2a2a2a; color: #c0c0c0;
}
.stage-icon-cell { color: #cbd5e1; }
.icon-suggestion {
  display: inline-flex; align-items: center; gap: 0.375rem;
  margin-top: 0.5rem; padding: 0.25rem 0.5rem;
  border: 1px solid #334155; border-radius: 0.375rem;
  font-size: 0.7rem; color: #94a3b8; background: transparent;
  cursor: pointer; transition: color .15s, border-color .15s;
}
.icon-suggestion:hover { color: #e2e8f0; border-color: #64748b; }
</style>
