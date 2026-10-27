<script setup lang="ts">
import BatchPhotoUpload from '@/components/admin/forms/BatchPhotoUpload.vue'
import { useVenues } from '@/composables/useVenues'
import { useConcerts } from '@/composables/useConcerts'
import { useTags } from '@/composables/useTags'
import type { AlbumUpload } from '@/composables/useAlbums'

/**
 * The Photos page's "new album" form (metadata plus the photos themselves),
 * for EntityQuickAdd's slot. An album *is* its photos, so the form still asks
 * for at least one; the payload handed on is the files and the metadata
 * together, which useCreateAlbumWithPhotos turns into one multipart create.
 */
defineProps<{ loading: boolean; errors: Record<string, string[]> }>()
const emit = defineEmits<{ submit: [payload: AlbumUpload]; cancel: [] }>()

const { query: venuesQ } = useVenues()
const { query: concertsQ } = useConcerts()
const { query: tagsQ } = useTags()
</script>

<template>
  <BatchPhotoUpload
    :venues="venuesQ.data.value ?? []"
    :concerts="concertsQ.data.value ?? []"
    :tags="tagsQ.data.value ?? []"
    :uploading="loading"
    @upload="(files, meta) => emit('submit', { files, meta })"
    @cancel="emit('cancel')"
  />
</template>
