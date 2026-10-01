<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import TranslatedSlugInput from '@/components/admin/forms/TranslatedSlugInput.vue'
import { LOCALES, bagFrom, compactBag, emptyBag, shortLabel, type Lang } from '@/locales'
import { useContentLocales } from '@/composables/useContentLocales'
import type { Tag, TagPayload } from '@/types/tag'

// Inputs render in the band's writing order; the registry order stays for
// building payloads, where order carries no meaning.
const { order: contentLocales } = useContentLocales()

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

watch(() => props.initial, (val) => {
  for (const l of LOCALES) {
    form.name[l] = val?.translations?.name[l] ?? ''
  }
  form.slug = bagFrom(val?.translations?.slug)
}, { immediate: true })

function submit() {
  emit('submit', {
    name: Object.fromEntries(LOCALES.map(l => [l, form.name[l].trim() || null])) as TagPayload['name'],
    slug: Object.fromEntries(
      Object.entries(compactBag(form.slug)).map(([l, v]) => [l, slugAuto.value[l as Lang] ? null : v]),
    ) as TagPayload['slug'],
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">{{ $t('more.tags.cols.name') }} <span style="color:#f87171;">*</span></label>
      <div class="trans-group">
        <div v-for="l in contentLocales" :key="l" class="trans-row" :data-locale="l">
          <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
          <input v-model="form.name[l]" class="field-input flex-1" :placeholder="$t('more.tags.namePlaceholder')" />
        </div>
      </div>
      <template v-for="l in contentLocales" :key="`name-err-${l}`">
        <p v-if="errors?.[`name.${l}`]" class="field-error">{{ errors[`name.${l}`][0] }}</p>
      </template>
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>
    <div>
      <label class="field-label">{{ $t('more.tags.slug') }}</label>
      <TranslatedSlugInput
        v-model="form.slug"
        v-model:auto="slugAuto"
        :sources="form.name"
        :errors="slugErrors"
      />
      <p v-if="errors?.slug" class="field-error">{{ errors.slug[0] }}</p>
    </div>
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : (initial ? $t('common.actions.update') : $t('common.actions.create')) }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
