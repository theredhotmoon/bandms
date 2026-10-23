<script setup lang="ts">
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import VenueForm from '@/components/admin/forms/VenueForm.vue'
import { useCreateVenue } from '@/composables/useVenues'
import type { Venue } from '@/types/venue'
import type { Tag } from '@/types/tag'

/**
 * "+ New venue" beside a venue select. Tags come in as a prop and the
 * mutation is the create-only composable, so opening the host form costs
 * no extra list fetches. See QuickAddModal for the shared behaviour.
 */
defineProps<{ tags: Tag[] }>()
const emit = defineEmits<{ created: [venue: Venue] }>()

const create = useCreateVenue()
</script>

<template>
  <QuickAddModal
    :button-label="$t('shows.concerts.form.newVenue')"
    :title="$t('shows.venues.modalNew')"
    :success-message="$t('shows.venues.created')"
    test-id="venue-quick-add"
    :create="create.mutateAsync"
    @created="emit('created', $event)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <VenueForm :initial="null" :tags="tags" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
