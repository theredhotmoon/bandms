<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminModal from '@/components/admin/AdminModal.vue'
import AuthorForm from '@/components/admin/forms/AuthorForm.vue'
import { useCreateAuthor } from '@/composables/useAuthors'
import { reportSaveError } from '@/utils/formErrors'
import type { Author, AuthorPayload } from '@/types/author'

/**
 * "+ New contact" beside the band form's contact picker: opens the author
 * form in a modal stacked over the band, creates the person, and hands them
 * back through `created` so the host can tick them. Same shape as
 * VenueQuickAdd; AdminModal's stack scopes Escape and the discard guard.
 *
 * The author form's relation pickers (press, concerts, tours, bands) get
 * empty lists on purpose, which hides them: a contact made from inside a
 * band form is linked to *this* band by the band's own save, and offering
 * every other band's checkbox here would both fetch four lists the band form
 * never needs and invite a second, conflicting way to make the same link.
 */
const emit = defineEmits<{ created: [author: Author] }>()

const { t } = useI18n()
const create = useCreateAuthor()

const open = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})

function openModal(): void {
  fieldErrors.value = {}
  open.value = true
}

async function handleSubmit(payload: AuthorPayload): Promise<void> {
  fieldErrors.value = {}
  try {
    const author = await create.mutateAsync(payload)
    toast.success(t('content.authors.created'))
    open.value = false
    emit('created', author)
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}
</script>

<template>
  <button type="button" class="btn-add" data-testid="author-quick-add" @click="openModal">
    {{ $t('more.bands.form.newContact') }}
  </button>

  <AdminModal :open="open" :title="$t('content.authors.modalNew')" @close="open = false">
    <AuthorForm
      :initial="null"
      :press-releases="[]"
      :concerts="[]"
      :tours="[]"
      :bands="[]"
      :loading="create.isPending.value"
      :errors="fieldErrors"
      @submit="handleSubmit"
      @cancel="open = false"
    />
  </AdminModal>
</template>

<style scoped src="../form-styles.css" />
