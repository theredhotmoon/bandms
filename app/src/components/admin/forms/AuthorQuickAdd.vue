<script setup lang="ts">
import QuickAddModal from '@/components/admin/forms/QuickAddModal.vue'
import AuthorForm from '@/components/admin/forms/AuthorForm.vue'
import { useCreateAuthor } from '@/composables/useAuthors'
import type { Author, AuthorPayload } from '@/types/author'

/**
 * "+ New contact" beside the band form's contact picker. The author form's
 * relation pickers (press, concerts, tours, bands) get empty lists on
 * purpose, which hides them: a contact made from inside a band form is
 * linked to *this* band by the band's own save, and offering every other
 * band's checkbox here would both fetch four lists the band form never
 * needs and invite a second, conflicting way to make the same link.
 */
const emit = defineEmits<{ created: [author: Author] }>()

const create = useCreateAuthor()
// The shell's `create` takes (payload, file); the mutation wants the payload alone.
const createRecord = (payload: AuthorPayload) => create.mutateAsync(payload)
</script>

<template>
  <QuickAddModal
    :button-label="$t('more.bands.form.newContact')"
    :title="$t('content.authors.modalNew')"
    :success-message="$t('content.authors.created')"
    test-id="author-quick-add"
    :create="createRecord"
    @created="emit('created', $event)"
    v-slot="{ loading, errors, submit, cancel }"
  >
    <AuthorForm
      :initial="null"
      :press-releases="[]"
      :concerts="[]"
      :tours="[]"
      :bands="[]"
      :loading="loading"
      :errors="errors"
      @submit="submit"
      @cancel="cancel"
    />
  </QuickAddModal>
</template>
