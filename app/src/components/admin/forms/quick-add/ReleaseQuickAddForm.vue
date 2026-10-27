<script setup lang="ts">
import ReleaseForm from '@/components/admin/forms/ReleaseForm.vue'
import { useBandMembers } from '@/composables/useBandMembers'
import type { ReleasePayload } from '@/types/release'

/** The release form with its members list, for EntityQuickAdd's slot. */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: ReleasePayload, coverFile: File | null]; cancel: [] }>()

const { query: membersQ } = useBandMembers()
</script>

<template>
  <ReleaseForm
    :initial="null"
    :members="membersQ.data.value ?? []"
    :loading="loading"
    :errors="errors"
    @submit="(payload, coverFile) => emit('submit', payload, coverFile)"
    @cancel="emit('cancel')"
  />
</template>
