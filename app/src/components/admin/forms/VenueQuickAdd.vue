<script setup lang="ts">
import { ref } from 'vue'
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import VenueForm from '@/components/admin/forms/VenueForm.vue'
import { useCreateVenue } from '@/composables/useVenues'
import type { Venue, VenuePayload } from '@/types/venue'
import type { Tag } from '@/types/tag'

/**
 * "+ New venue" beside a venue select. Tags come in as a prop and the
 * mutation is the create-only composable, so opening the host form costs
 * no extra list fetches. See QuickAddModal for the shared behaviour.
 */
defineProps<{ tags: Tag[]; prefill?: Partial<VenuePayload> | null; hideButton?: boolean }>()
const emit = defineEmits<{ created: [venue: Venue] }>()

const create = useCreateVenue()
// The shell's `create` takes (payload, file); the mutation wants the payload alone.
const shell = ref<{ open: () => void } | null>(null)
defineExpose({ open: () => shell.value?.open() })
const createRecord = (payload: VenuePayload) => create.mutateAsync(payload)
</script>

<template>
  <QuickAddModal
    ref="shell"
    :hide-button="hideButton"
    :button-label="$t('shows.concerts.form.newVenue')"
    :title="$t('shows.venues.modalNew')"
    :success-message="$t('shows.venues.created')"
    test-id="venue-quick-add"
    :create="createRecord"
    @created="emit('created', $event)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <VenueForm :initial="null" :prefill="prefill" :tags="tags" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
