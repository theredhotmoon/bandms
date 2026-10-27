<script setup lang="ts">
import BandMemberForm from '@/components/admin/forms/BandMemberForm.vue'
import { useInstruments } from '@/composables/useInstruments'
import type { BandMemberPayload } from '@bandms/rider-core'

/** The band member form with its instruments list, for EntityQuickAdd's slot. */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: BandMemberPayload]; cancel: [] }>()

const { query: instrumentsQ } = useInstruments()
</script>

<template>
  <BandMemberForm
    :loading="loading"
    :errors="errors"
    :available-instruments="instrumentsQ.data.value ?? []"
    :instruments-loaded="instrumentsQ.isSuccess.value"
    @submit="emit('submit', $event)"
    @cancel="emit('cancel')"
  />
</template>
