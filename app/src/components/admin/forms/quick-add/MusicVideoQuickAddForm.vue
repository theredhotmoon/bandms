<script setup lang="ts">
import MusicVideoForm from '@/components/admin/forms/MusicVideoForm.vue'
import { useBandMembers } from '@/composables/useBandMembers'
import { useMusicVideos } from '@/composables/useMusicVideos'
import type { MusicVideoPayload } from '@/types/musicVideo'

/** The music video form with its members list, for EntityQuickAdd's slot. */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: MusicVideoPayload]; cancel: [] }>()

const { query: membersQ } = useBandMembers()
// Only for the sort order a new video gets (after the last one), the way the
// Music Videos page does it; the host already holds this list in cache.
const { query: videosQ } = useMusicVideos()
</script>

<template>
  <MusicVideoForm
    :initial="null"
    :members="membersQ.data.value ?? []"
    :next-sort-order="videosQ.data.value?.length ?? 0"
    :loading="loading"
    :errors="errors"
    @submit="emit('submit', $event)"
    @cancel="emit('cancel')"
  />
</template>
