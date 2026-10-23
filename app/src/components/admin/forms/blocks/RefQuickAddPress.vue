<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import PressReleaseForm from '@/components/admin/forms/PressReleaseForm.vue'
import { usePressReleases } from '@/composables/usePressReleases'
import { useConcerts } from '@/composables/useConcerts'
import { useAlbums } from '@/composables/useAlbums'
import { useReleases } from '@/composables/useReleases'
import { useTours } from '@/composables/useTours'
import { useTags } from '@/composables/useTags'
import { useBandMembers } from '@/composables/useBandMembers'
import { reportSaveError } from '@/utils/formErrors'
import type { PressReleasePayload } from '@/types/press-release'

/** The press-coverage half of RefQuickAdd — the press page's form and save. */
const emit = defineEmits<{ created: [id: number]; cancel: [] }>()

const { t } = useI18n()
const { create } = usePressReleases()
const { query: concertsQ } = useConcerts()
const { query: albumsQ } = useAlbums()
const { query: releasesQ } = useReleases()
const { query: toursQ } = useTours()
const { query: tagsQ } = useTags()
const { query: membersQ } = useBandMembers()

const fieldErrors = ref<Record<string, string[]>>({})

async function handleSubmit(payload: PressReleasePayload): Promise<void> {
  fieldErrors.value = {}
  try {
    const press = await create.mutateAsync(payload)
    toast.success(t('content.press.created'))
    emit('created', press.id)
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}
</script>

<template>
  <PressReleaseForm
    :initial="null"
    :concerts="concertsQ.data.value ?? []"
    :albums="albumsQ.data.value ?? []"
    :releases="releasesQ.data.value ?? []"
    :tours="toursQ.data.value ?? []"
    :tags="tagsQ.data.value ?? []"
    :members="membersQ.data.value ?? []"
    :loading="create.isPending.value"
    :errors="fieldErrors"
    @submit="handleSubmit"
    @cancel="emit('cancel')"
  />
</template>
