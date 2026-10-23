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
import type { RefQuickAddCreated } from './RefQuickAdd.vue'

/** The release half of RefQuickAdd — the releases page's save, cover included. */
const emit = defineEmits<{ created: [item: RefQuickAddCreated]; cancel: [] }>()

const { t } = useI18n()
const { token } = useAuth()
const queryClient = useQueryClient()
const { create } = useReleases()
const { query: membersQ } = useBandMembers()

const fieldErrors = ref<Record<string, string[]>>({})

async function handleSubmit(payload: ReleasePayload, coverFile: File | null): Promise<void> {
  fieldErrors.value = {}
  try {
    const release = await create.mutateAsync(payload)
    if (coverFile) {
      await uploadReleaseCover(token.value!, release.id, coverFile)
      await queryClient.invalidateQueries({ queryKey: ['releases'] })
    }
    toast.success(t('media.releases.created'))
    emit('created', { id: release.id, label: release.title })
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}
</script>

<template>
  <ReleaseForm
    :initial="null"
    :members="membersQ.data.value ?? []"
    :loading="create.isPending.value"
    :errors="fieldErrors"
    @submit="handleSubmit"
    @cancel="emit('cancel')"
  />
</template>
