<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminModal from '@/components/admin/AdminModal.vue'
import VenueForm from '@/components/admin/forms/VenueForm.vue'
import { useVenues } from '@/composables/useVenues'
import { useTags } from '@/composables/useTags'
import { reportSaveError } from '@/utils/formErrors'
import type { Venue, VenuePayload } from '@/types/venue'

/**
 * "+ New venue" beside a venue select: opens the full venue form in a modal
 * stacked over whatever form the select belongs to, creates the venue, and
 * hands it back through `created` so the host can select it. The host form
 * is left exactly as it was — this component never touches it, and the
 * nested AdminModal scopes Escape and the discard guard to the venue form.
 */
const emit = defineEmits<{ created: [venue: Venue] }>()

const { t } = useI18n()
const { create } = useVenues()
const { query: tagsQ } = useTags()

const open = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})

function openModal(): void {
  fieldErrors.value = {}
  open.value = true
}

async function handleSubmit(payload: VenuePayload): Promise<void> {
  fieldErrors.value = {}
  try {
    const venue = await create.mutateAsync(payload)
    toast.success(t('shows.venues.created'))
    open.value = false
    emit('created', venue)
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}
</script>

<template>
  <button type="button" class="btn-add" data-testid="venue-quick-add" @click="openModal">
    {{ $t('shows.concerts.form.newVenue') }}
  </button>

  <AdminModal :open="open" :title="$t('shows.venues.modalNew')" @close="open = false">
    <VenueForm
      v-if="open"
      :initial="null"
      :tags="tagsQ.data.value ?? []"
      :loading="create.isPending.value"
      :errors="fieldErrors"
      @submit="handleSubmit"
      @cancel="open = false"
    />
  </AdminModal>
</template>

<style scoped src="../form-styles.css" />
