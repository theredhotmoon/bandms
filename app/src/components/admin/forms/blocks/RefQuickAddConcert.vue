<script setup lang="ts">
import ConcertForm from '@/components/admin/forms/ConcertForm.vue'
import { useVenues } from '@/composables/useVenues'
import { useBands } from '@/composables/useBands'
import { useTags } from '@/composables/useTags'
import { useBandMembers } from '@/composables/useBandMembers'
import type { ConcertPayload } from '@/types/concert'

/**
 * The concert form with the lists it needs, for RefQuickAdd's slot. Mounted
 * only while that modal is open, so these queries do not run under every
 * post. The save itself is RefQuickAdd's (create, then the poster).
 */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: ConcertPayload, posterFile: File | null]; cancel: [] }>()

const { query: venuesQ } = useVenues()
const { query: bandsQ } = useBands()
const { query: tagsQ } = useTags()
const { query: membersQ } = useBandMembers()
</script>

<template>
  <ConcertForm
    :initial="null"
    :venues="venuesQ.data.value ?? []"
    :bands="bandsQ.data.value ?? []"
    :tags="tagsQ.data.value ?? []"
    :members="membersQ.data.value ?? []"
    :loading="loading"
    :errors="errors"
    @submit="(payload, posterFile) => emit('submit', payload, posterFile)"
    @cancel="emit('cancel')"
  />
</template>
