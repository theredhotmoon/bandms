<script setup lang="ts" generic="TPayload, TRecord">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminModal from '@/components/admin/AdminModal.vue'
import { reportSaveError } from '@/utils/formErrors'

/**
 * The shell every "+ New …" quick-add shares: a button beside a picker, a
 * modal stacked over the host form (AdminModal's stack scopes Escape, inert
 * and the discard guard to it), and one save that creates the record, toasts,
 * closes and hands the record back through `created` so the host can select
 * it. The host form is never touched.
 *
 * The entity's own form goes in the default slot and is wired to the slot
 * props: `:loading`, `:errors`, `@submit="submit"`, `@cancel="cancel"`.
 * `create` is the create-only mutation's `mutateAsync` (useCreateVenue and
 * friends), which appends the row to the list cache so the host's picker
 * shows it the moment this closes.
 */
const props = defineProps<{
  buttonLabel: string
  title: string
  testId: string
  successMessage: string
  create: (payload: TPayload) => Promise<TRecord>
  maxWidth?: string
  /** The toast when the save fails; defaults to the generic one. */
  errorMessage?: string
}>()

const emit = defineEmits<{ created: [record: TRecord] }>()

defineSlots<{
  default(props: {
    loading: boolean
    errors: Record<string, string[]>
    submit: (payload: TPayload) => void
    cancel: () => void
  }): unknown
}>()

const { t } = useI18n()

const open = ref(false)
const loading = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})

function openModal(): void {
  fieldErrors.value = {}
  open.value = true
}

async function submit(payload: TPayload): Promise<void> {
  fieldErrors.value = {}
  loading.value = true
  try {
    const record = await props.create(payload)
    toast.success(props.successMessage)
    open.value = false
    emit('created', record)
  } catch (e) {
    reportSaveError(e, props.errorMessage ?? t('common.state.somethingWentWrong'), fieldErrors)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <button type="button" class="btn-add" :data-testid="testId" @click="openModal">
    {{ buttonLabel }}
  </button>

  <AdminModal :open="open" :title="title" :max-width="maxWidth" @close="open = false">
    <slot :loading="loading" :errors="fieldErrors" :submit="submit" :cancel="() => { open = false }" />
  </AdminModal>
</template>

<style scoped src="../form-styles.css" />
