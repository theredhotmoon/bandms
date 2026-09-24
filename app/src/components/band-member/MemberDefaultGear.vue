<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import type { BandMember, DefaultGearItem, DefaultGearItemType } from '@bandms/rider-core'
import { useBandMembers } from '@/composables/useBandMembers'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { reportSaveError } from '@/utils/formErrors'

const props = defineProps<{ member: BandMember }>()
const { t } = useI18n()
const { update } = useBandMembers()

const GEAR_TYPES: DefaultGearItemType[] = [
  'microphone', 'amp_head', 'amp_combo', 'cabinet', 'di_box', 'keyboard',
  'drum_kit', 'drum_hardware', 'pedal_board', 'wireless_system', 'other',
]

const items = ref<DefaultGearItem[]>([])
const saving = ref(false)
const { isDirty: dirty, markClean } = useDirtyGuard(() => items.value)

watch(
  () => props.member.default_gear,
  (val) => {
    items.value = val ? val.map(i => ({ ...i })) : []
    markClean()
  },
  { immediate: true },
)

function addItem() {
  items.value.push({
    id: crypto.randomUUID(),
    type: 'other',
    label: '',
    brand_model: '',
    own_gear: true,
    notes: '',
  })
}

function removeItem(id: string) {
  items.value = items.value.filter(i => i.id !== id)
}

function patchItem(id: string, patch: Partial<DefaultGearItem>) {
  items.value = items.value.map(i => i.id === id ? { ...i, ...patch } : i)
}

async function save() {
  saving.value = true
  try {
    await update.mutateAsync({ id: props.member.id, payload: { default_gear: items.value } })
    toast.success(t('band.gear.saved'))
    markClean()
  } catch (e) {
    reportSaveError(e, t('band.gear.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="gear-section">
    <i18n-t keypath="band.gear.hint" tag="div" class="section-hint" scope="global">
      <template #ownGear><strong>{{ $t('band.gear.ownGear') }}</strong></template>
      <template #backline><strong>{{ $t('band.gear.backlineRequired') }}</strong></template>
    </i18n-t>

    <div v-if="!items.length" class="no-items">
      {{ $t('band.gear.empty') }}
    </div>

    <div v-else class="gear-list">
      <div v-for="item in items" :key="item.id" class="gear-card">

        <div class="card-header">
          <select
            :value="item.type"
            class="type-select"
            @change="patchItem(item.id, { type: ($event.target as HTMLSelectElement).value as DefaultGearItemType })"
          >
            <option v-for="g in GEAR_TYPES" :key="g" :value="g">{{ $t(`band.gear.types.${g}`) }}</option>
          </select>
          <button type="button" class="btn-remove" @click="removeItem(item.id)">{{ $t('band.gear.remove') }}</button>
        </div>

        <div class="gear-fields">
          <div class="field-group">
            <label class="field-label">{{ $t('band.gear.label') }}</label>
            <input
              :value="item.label"
              class="field-input"
              :placeholder="$t('band.gear.labelPlaceholder')"
              @input="patchItem(item.id, { label: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('band.gear.brand') }}</label>
            <input
              :value="item.brand_model"
              class="field-input"
              :placeholder="$t('band.gear.brandPlaceholder')"
              @input="patchItem(item.id, { brand_model: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group field-group--wide">
            <div class="own-gear-row">
              <span class="field-label">{{ $t('band.gear.provision') }}</span>
              <label class="toggle-label">
                <button
                  type="button"
                  class="toggle"
                  :class="{ 'toggle--on': item.own_gear }"
                  :aria-pressed="item.own_gear"
                  @click="patchItem(item.id, { own_gear: !item.own_gear })"
                >
                  <span class="toggle-thumb" />
                </button>
                <span class="toggle-text" :class="item.own_gear ? 'toggle-text--own' : 'toggle-text--backline'">
                  {{ item.own_gear ? $t('band.gear.bringsOwn') : $t('band.gear.backlineNeeded') }}
                </span>
              </label>
            </div>
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">{{ $t('band.gear.notes') }} <span class="field-opt">{{ $t('band.gear.optional') }}</span></label>
            <input
              :value="item.notes"
              class="field-input"
              :placeholder="$t('band.gear.notesPlaceholder')"
              @input="patchItem(item.id, { notes: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>

      </div>
    </div>

    <div class="footer-row">
      <button type="button" class="btn-add" @click="addItem">{{ $t('band.gear.add') }}</button>
      <button
        type="button"
        class="btn-save"
        :class="{ 'btn-save--dirty': dirty }"
        :disabled="saving || !dirty"
        @click="save"
      >
        {{ saving ? $t('common.actions.saving') : $t('common.actions.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.gear-section { display: flex; flex-direction: column; gap: 1rem; }

.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.55;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.section-hint strong { color: #d0d0d0; font-weight: 600; }

.no-items {
  font-size: 0.8rem; color: #334155; text-align: center;
  padding: 2rem 0; border: 1px dashed #2a2a2a; border-radius: 0.5rem;
}

.gear-list { display: flex; flex-direction: column; gap: 0.75rem; }

.gear-card {
  background: #111111; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  padding: 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.75rem;
}

.card-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }

.type-select {
  flex: 1; min-width: 0; padding: 0.35rem 0.6rem; border-radius: 0.375rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; outline: none; cursor: pointer; font-family: inherit;
  appearance: none; -webkit-appearance: none; padding-right: 1.75rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.5rem center;
  transition: border-color 150ms;
}
.type-select:focus { border-color: #5154e5; }
.type-select option { background: #141414; }

.btn-remove {
  font-size: 0.68rem; font-weight: 500; color: #f87171; flex-shrink: 0;
  background: transparent; border: 1px solid #7f1d1d; border-radius: 0.25rem;
  cursor: pointer; padding: 0.2rem 0.5rem; transition: background 100ms;
}
.btn-remove:hover { background: #450a0a; }

.gear-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
.field-group { display: flex; flex-direction: column; gap: 0.2rem; }
.field-group--wide { grid-column: span 2; }

.field-label { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }
.field-opt   { color: #334155; font-weight: 400; }

.field-input {
  display: block; width: 100%; padding: 0.4rem 0.6rem; border-radius: 0.4rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input::placeholder { color: #1e2a40; }

.own-gear-row { display: flex; align-items: center; gap: 0.875rem; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }

.toggle {
  position: relative; width: 2.5rem; height: 1.375rem; border-radius: 9999px;
  border: none; cursor: pointer; background: #1e293b; transition: background 200ms; flex-shrink: 0;
}
.toggle--on { background: #2a2a2a; }
.toggle-thumb {
  position: absolute; top: 0.1875rem; left: 0.1875rem;
  width: 1rem; height: 1rem; border-radius: 9999px;
  background: #475569; transition: transform 200ms, background 200ms;
}
.toggle--on .toggle-thumb { transform: translateX(1.125rem); background: #c0c0c0; }

.toggle-text { font-size: 0.75rem; }
.toggle-text--own      { color: #c0c0c0; font-weight: 600; }
.toggle-text--backline { color: #f59e0b; font-weight: 600; }

.footer-row {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding-top: 0.25rem;
}

.btn-add {
  font-size: 0.75rem; font-weight: 600; color: #c0c0c0;
  background: transparent; border: 1px dashed #444444; border-radius: 0.375rem;
  cursor: pointer; padding: 0.375rem 0.875rem; transition: background 100ms, border-color 100ms;
}
.btn-add:hover { background: #1a1a1a; border-color: #888888; }

.btn-save {
  padding: 0.4rem 1.25rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #2a2a2a; border: 1px solid #444444; color: #888888;
  transition: background 100ms, border-color 100ms, color 100ms;
}
.btn-save--dirty {
  background: #e8e8e8; border-color: #e8e8e8; color: #111111;
}
.btn-save--dirty:hover:not(:disabled) { background: #ffffff; }
.btn-save:disabled { opacity: 0.4; cursor: default; }
</style>
