<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentLocales } from '@/composables/useContentLocales'
import { shortLabel, type Lang } from '@/locales'
import { VISIBLE_LOCALES } from '@/utils/editorLocales'

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const { t } = useI18n()
const { order } = useContentLocales()

// The host form may narrow the view to one language; without a provider every
// locale renders, as it always did.
const visible = inject(VISIBLE_LOCALES, null)
const locales = computed<Lang[]>(() => visible?.value ?? order.value)

const placeholder = (l: Lang): string => t('content.blocks.text.placeholder', {}, { locale: l })

const body = () => (props.payload.body ?? {}) as Partial<Record<Lang, string>>

function set(locale: Lang, value: string) {
  emit('update:payload', { ...props.payload, body: { ...body(), [locale]: value } })
}
</script>

<template>
  <div class="trans-group">
    <div v-for="l in locales" :key="l" class="trans-row trans-row--top" :data-locale="l">
      <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
      <textarea
        :value="body()[l] ?? ''"
        @input="set(l, ($event.target as HTMLTextAreaElement).value)"
        class="field-input flex-1" rows="5" :placeholder="placeholder(l)"
        :aria-label="`${$t('content.blocks.kind.text')} ${shortLabel(l)}`"
      />
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
