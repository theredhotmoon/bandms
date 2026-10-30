<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDirtyGuard, useModalGuard } from '@/composables/useDirtyGuard'
import TranslatedSlugInput from '@/components/admin/forms/TranslatedSlugInput.vue'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import { LOCALES, bagFrom, emptyBag, slugPayload, type Lang } from '@/locales'
import type { Tag, TagPayload } from '@/types/tag'

const props = defineProps<{
  initial?: Tag | null
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [TagPayload]; cancel: [] }>()

// Which locales' slugs are still following their name. Those go to the API as
// null so it generates them — see TranslatedSlugInput.
const slugAuto = ref<Partial<Record<Lang, boolean>>>({})

// Laravel keys a bag's errors per locale: `slug.en`, `slug.pl`.
const slugErrors = computed(() =>
  Object.fromEntries(LOCALES.map(l => [l, props.errors?.[`slug.${l}`]?.[0]])),
)

const form = reactive({
  name: emptyBag(),
  slug: emptyBag(),
})

const { isDirty, markClean } = useDirtyGuard(() => form)
const { cancel } = useModalGuard(isDirty, () => emit('cancel'))

watch(() => props.initial, (val) => {
  for (const l of LOCALES) {
    form.name[l] = val?.translations?.name[l] ?? ''
  }
  form.slug = bagFrom(val?.translations?.slug)
  markClean()
}, { immediate: true })

function submit() {
  emit('submit', {
    name: Object.fromEntries(LOCALES.map(l => [l, form.name[l].trim() || null])) as TagPayload['name'],
    slug: slugPayload(form.slug, slugAuto.value),
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">{{ $t('more.tags.cols.name') }} <span style="color:var(--c-f87171);">*</span></label>
      <TranslatedField
        v-model="form.name"
        kind="input"
        field-key="tag.name"
        :label="$t('more.tags.cols.name')"
        :placeholders="Object.fromEntries(LOCALES.map(l => [l, $t('more.tags.namePlaceholder')]))"
        :errors="Object.fromEntries(LOCALES.map(l => [l, errors?.[`name.${l}`]?.[0]]))"
      />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>
    <div>
      <label class="field-label">{{ $t('more.tags.slug') }}</label>
      <TranslatedSlugInput
        v-model="form.slug"
        v-model:auto="slugAuto"
        follow-loaded
        :sources="form.name"
        :errors="slugErrors"
      />
      <p v-if="errors?.slug" class="field-error">{{ errors.slug[0] }}</p>
    </div>
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="cancel()" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : (initial ? $t('common.actions.update') : $t('common.actions.create')) }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
