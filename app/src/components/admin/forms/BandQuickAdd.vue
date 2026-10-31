<script setup lang="ts">
import { ref } from 'vue'
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import BandForm from '@/components/admin/forms/BandForm.vue'
import { useCreateBand } from '@/composables/useBands'
import type { Band, BandPayload } from '@/types/band'

/**
 * A new band, promoter or festival from outside the Bands page — the
 * assistant inbox's Save as…. The contact pool is empty on purpose, as in
 * AuthorQuickAdd: contacts are linked from the band's own page.
 */
defineProps<{ prefill?: Partial<BandPayload> | null; hideButton?: boolean }>()
const emit = defineEmits<{ created: [band: Band] }>()

const create = useCreateBand()
const shell = ref<{ open: () => void } | null>(null)
defineExpose({ open: () => shell.value?.open() })
// The shell's `create` takes (payload, file); the mutation wants the payload alone.
const createRecord = (payload: BandPayload) => create.mutateAsync(payload)
</script>

<template>
  <QuickAddModal
    ref="shell"
    :hide-button="hideButton"
    :button-label="$t('more.bands.add')"
    :title="$t('more.bands.newTitle')"
    :success-message="$t('more.bands.created')"
    test-id="band-quick-add"
    :create="createRecord"
    @created="emit('created', $event)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <BandForm :initial="null" :prefill="prefill" :authors="[]" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
