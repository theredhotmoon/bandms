<script setup lang="ts">
import PressReleaseForm from '@/components/admin/forms/PressReleaseForm.vue'
import { useConcerts } from '@/composables/useConcerts'
import { useAlbums } from '@/composables/useAlbums'
import { useReleases } from '@/composables/useReleases'
import { useTours } from '@/composables/useTours'
import { useTags } from '@/composables/useTags'
import { useBandMembers } from '@/composables/useBandMembers'
import type { PressReleasePayload } from '@/types/press-release'

/** The press-coverage form with the lists it needs, for RefQuickAdd's slot. */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: PressReleasePayload]; cancel: [] }>()

const { query: concertsQ } = useConcerts()
const { query: albumsQ } = useAlbums()
const { query: releasesQ } = useReleases()
const { query: toursQ } = useTours()
const { query: tagsQ } = useTags()
const { query: membersQ } = useBandMembers()
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
    :loading="loading"
    :errors="errors"
    @submit="emit('submit', $event)"
    @cancel="emit('cancel')"
  />
</template>
