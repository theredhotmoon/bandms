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

/**
 * The concert half of RefQuickAdd: the concerts page's form and save
 * sequence (create, then the poster), mounted only while the nested modal is
 * open so its list queries do not run under every post.
 */
const emit = defineEmits<{ created: [id: number]; cancel: [] }>()

const { t } = useI18n()
const { token } = useAuth()
const queryClient = useQueryClient()
const { create } = useConcerts()
const { query: venuesQ } = useVenues()
const { query: bandsQ } = useBands()
const { query: tagsQ } = useTags()
const { query: membersQ } = useBandMembers()

const fieldErrors = ref<Record<string, string[]>>({})
const uploading = ref(false)

async function handleSubmit(payload: ConcertPayload, posterFile: File | null): Promise<void> {
  fieldErrors.value = {}
  let id: number
  try {
    id = (await create.mutateAsync(payload)).id
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
    return
  }
  // The concert exists from here on, whatever happens to the poster: the
  // block gets it and the modal closes, so a failed upload cannot be "fixed"
  // by pressing Create again and making a second concert.
  if (posterFile) {
    uploading.value = true
    try {
      await uploadConcertPoster(token.value!, id, posterFile)
      await queryClient.invalidateQueries({ queryKey: ['concerts'] })
    } catch (e) {
      reportSaveError(e, t('shows.concerts.posterFailed'))
    } finally {
      uploading.value = false
    }
  }
  toast.success(t('shows.concerts.created'))
  emit('created', id)
}
</script>

<template>
  <ConcertForm
    :initial="null"
    :venues="venuesQ.data.value ?? []"
    :bands="bandsQ.data.value ?? []"
    :tags="tagsQ.data.value ?? []"
    :members="membersQ.data.value ?? []"
    :loading="create.isPending.value || uploading"
    :errors="fieldErrors"
    @submit="handleSubmit"
    @cancel="emit('cancel')"
  />
</template>
