<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useContentLocales } from '@/composables/useContentLocales'
import { shortLabel, type Lang } from '@/locales'

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const { t } = useI18n()
const { order: contentLocales } = useContentLocales()

const placeholder = (l: Lang): string => t('content.blocks.text.placeholder', {}, { locale: l })

const body = () => (props.payload.body ?? {}) as Partial<Record<Lang, string>>

function set(locale: Lang, value: string) {
  emit('update:payload', { ...props.payload, body: { ...body(), [locale]: value } })
}
</script>

<template>
  <div class="trans-group">
    <div v-for="l in contentLocales" :key="l" class="trans-row trans-row--top" :data-locale="l">
      <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
      <textarea
        :value="body()[l] ?? ''"
        @input="set(l, ($event.target as HTMLTextAreaElement).value)"
        class="field-input flex-1" rows="5" :placeholder="placeholder(l)"
      />
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
