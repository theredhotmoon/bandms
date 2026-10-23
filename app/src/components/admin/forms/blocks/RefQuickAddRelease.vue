<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import ReleaseForm from '@/components/admin/forms/ReleaseForm.vue'
import { useReleases } from '@/composables/useReleases'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAuth } from '@/composables/useAuth'
import { uploadReleaseCover } from '@/api/releases'
import { reportSaveError } from '@/utils/formErrors'
import type { ReleasePayload } from '@/types/release'

/** The release half of RefQuickAdd — the releases page's save, cover included. */
const emit = defineEmits<{ created: [id: number]; cancel: [] }>()

const { t } = useI18n()
const { token } = useAuth()
const queryClient = useQueryClient()
const { create } = useReleases()
const { query: membersQ } = useBandMembers()

const fieldErrors = ref<Record<string, string[]>>({})
const uploading = ref(false)

async function handleSubmit(payload: ReleasePayload, coverFile: File | null): Promise<void> {
  fieldErrors.value = {}
  let id: number
  try {
    id = (await create.mutateAsync(payload)).id
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
    return
  }
  // The release exists from here on, whatever happens to the cover — see
  // RefQuickAddConcert for why a failed upload must not keep the modal open.
  if (coverFile) {
    uploading.value = true
    try {
      await uploadReleaseCover(token.value!, id, coverFile)
      await queryClient.invalidateQueries({ queryKey: ['releases'] })
    } catch (e) {
      reportSaveError(e, t('media.releases.coverFailed'))
    } finally {
      uploading.value = false
    }
  }
  toast.success(t('media.releases.created'))
  emit('created', id)
}
</script>

<template>
  <ReleaseForm
    :initial="null"
    :members="membersQ.data.value ?? []"
    :loading="create.isPending.value || uploading"
    :errors="fieldErrors"
    @submit="handleSubmit"
    @cancel="emit('cancel')"
  />
</template>
