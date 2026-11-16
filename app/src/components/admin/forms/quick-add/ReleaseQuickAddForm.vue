<script setup lang="ts">
import ReleaseForm from '@/components/admin/forms/ReleaseForm.vue'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAlbums } from '@/composables/useAlbums'
import type { ReleasePayload } from '@/types/release'

/** The release form with its members list, for EntityQuickAdd's slot. */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: ReleasePayload, coverFile: File | null]; cancel: [] }>()

const { query: membersQ } = useBandMembers()
const { query: albumsQ } = useAlbums()
</script>

<template>
  <ReleaseForm
    :initial="null"
    :members="membersQ.data.value ?? []"
    :albums="albumsQ.data.value ?? []"
    :loading="loading"
    :errors="errors"
    @submit="(payload, coverFile) => emit('submit', payload, coverFile)"
    @cancel="emit('cancel')"
  />
</template>
