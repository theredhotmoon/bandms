<script setup lang="ts">
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import InstrumentForm from '@/components/admin/forms/InstrumentForm.vue'
import { useCreateInstrument } from '@/composables/useInstruments'
import type { Instrument, InstrumentPayload } from '@bandms/rider-core'

/** "+ New instrument" in the band member form. See QuickAddModal. */
const emit = defineEmits<{ created: [instrument: Instrument] }>()

const create = useCreateInstrument()
// The shell's `create` takes (payload, file); the mutation wants the payload alone.
const createRecord = (payload: InstrumentPayload) => create.mutateAsync(payload)
</script>

<template>
  <QuickAddModal
    :button-label="$t('band.members.form.newInstrument')"
    :title="$t('more.instruments.addTitle')"
    :success-message="$t('more.instruments.added')"
    :error-message="$t('more.instruments.saveFailed')"
    test-id="instrument-quick-add"
    max-width="28rem"
    :create="createRecord"
    @created="emit('created', $event)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <InstrumentForm :initial="null" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
