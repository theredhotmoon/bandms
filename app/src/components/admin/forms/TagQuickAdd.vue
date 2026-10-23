<script setup lang="ts">
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import TagForm from '@/components/admin/forms/TagForm.vue'
import { useCreateTag } from '@/composables/useTags'
import type { Tag } from '@/types/tag'

/**
 * "+ New tag" beside a tag checkbox list (concert, venue, album, and the
 * relations panel's Tags section). The created tag reaches every list
 * through the cache append in useCreateTag; the host ticks it. See
 * QuickAddModal.
 */
const emit = defineEmits<{ created: [tag: Tag] }>()

const create = useCreateTag()
</script>

<template>
  <QuickAddModal
    :button-label="$t('common.fields.newTag')"
    :title="$t('more.tags.newTitle')"
    :success-message="$t('more.tags.created')"
    test-id="tag-quick-add"
    :create="create.mutateAsync"
    @created="emit('created', $event)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <TagForm :initial="null" :loading="loading" :errors="errors" @submit="submit" @cancel="cancel" />
  </QuickAddModal>
</template>
