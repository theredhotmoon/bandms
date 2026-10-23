<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import ConcertForm from '@/components/admin/forms/ConcertForm.vue'
import { useConcerts } from '@/composables/useConcerts'
import { useVenues } from '@/composables/useVenues'
import { useBands } from '@/composables/useBands'
import { useTags } from '@/composables/useTags'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAuth } from '@/composables/useAuth'
import { uploadConcertPoster } from '@/api/concerts'
import { reportSaveError } from '@/utils/formErrors'
import type { ConcertPayload } from '@/types/concert'
import type { RefQuickAddCreated } from './RefQuickAdd.vue'

/**
 * The concert half of RefQuickAdd: the same form and the same save sequence
 * as the concerts page (create, then the poster), mounted only while the
 * nested modal is open so its list queries do not run under every post.
 */
const emit = defineEmits<{ created: [item: RefQuickAddCreated]; cancel: [] }>()

const { t } = useI18n()
const { token } = useAuth()
const queryClient = useQueryClient()
const { create } = useConcerts()
const { query: venuesQ } = useVenues()
const { query: bandsQ } = useBands()
const { query: tagsQ } = useTags()
const { query: membersQ } = useBandMembers()

const fieldErrors = ref<Record<string, string[]>>({})

async function handleSubmit(payload: ConcertPayload, posterFile: File | null): Promise<void> {
  fieldErrors.value = {}
  try {
    const concert = await create.mutateAsync(payload)
    if (posterFile) {
      await uploadConcertPoster(token.value!, concert.id, posterFile)
      await queryClient.invalidateQueries({ queryKey: ['concerts'] })
    }
    toast.success(t('shows.concerts.created'))
    // Mirrors PostForm's concert label so the row reads the same before and
    // after the list refetch.
    emit('created', {
      id: concert.id,
      label: `${concert.date} — ${concert.venue?.name ?? t('content.posts.venueTba')}`,
    })
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}
</script>

<template>
  <ConcertForm
    :initial="null"
    :venues="venuesQ.data.value ?? []"
    :bands="bandsQ.data.value ?? []"
    :tags="tagsQ.data.value ?? []"
    :members="membersQ.data.value ?? []"
    :loading="create.isPending.value"
    :errors="fieldErrors"
    @submit="handleSubmit"
    @cancel="emit('cancel')"
  />
</template>
