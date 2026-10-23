<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminModal from '@/components/admin/AdminModal.vue'
import InstrumentForm from '@/components/admin/forms/InstrumentForm.vue'
import { useCreateInstrument } from '@/composables/useInstruments'
import { reportSaveError } from '@/utils/formErrors'
import type { Instrument, InstrumentPayload } from '@bandms/rider-core'

/**
 * "+ New instrument" in the band member form: opens the instrument form in a
 * modal stacked over the member, creates it, and hands it back through
 * `created` so the host can select it. Same shape as VenueQuickAdd.
 */
const emit = defineEmits<{ created: [instrument: Instrument] }>()

const { t } = useI18n()
const create = useCreateInstrument()

const open = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})

function openModal(): void {
  fieldErrors.value = {}
  open.value = true
}

async function handleSubmit(payload: InstrumentPayload): Promise<void> {
  fieldErrors.value = {}
  try {
    const instrument = await create.mutateAsync(payload)
    toast.success(t('more.instruments.added'))
    open.value = false
    emit('created', instrument)
  } catch (e) {
    reportSaveError(e, t('more.instruments.saveFailed'), fieldErrors)
  }
}
</script>

<template>
  <button type="button" class="btn-add" data-testid="instrument-quick-add" @click="openModal">
    {{ $t('band.members.form.newInstrument') }}
  </button>

  <AdminModal :open="open" :title="$t('more.instruments.addTitle')" max-width="28rem" @close="open = false">
    <InstrumentForm
      :initial="null"
      :loading="create.isPending.value"
      :errors="fieldErrors"
      @submit="handleSubmit"
      @cancel="open = false"
    />
  </AdminModal>
</template>

<style scoped src="../form-styles.css" />
