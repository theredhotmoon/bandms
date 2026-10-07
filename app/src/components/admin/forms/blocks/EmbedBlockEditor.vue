<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentLocales } from '@/composables/useContentLocales'
import { shortLabel, type Lang } from '@/locales'
import { providerLabel, detectProvider, isAudioProvider } from '@/utils/postBlocks'
import { VISIBLE_LOCALES } from '@/utils/editorLocales'

const props = defineProps<{ payload: Record<string, unknown>; hideLabel?: boolean }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const url = computed(() => (props.payload.url as string) ?? '')

// Preview only — the server re-detects and stores the provider on save.
const detected = computed(() => detectProvider(url.value))

const label = computed(() => (props.payload.label ?? {}) as Partial<Record<Lang, string>>)

const { t } = useI18n()
const { order } = useContentLocales()
const visible = inject(VISIBLE_LOCALES, null)
const locales = computed<Lang[]>(() => visible?.value ?? order.value)
const labelPlaceholder = (l: Lang): string => t('content.blocks.embed.linkText', {}, { locale: l })

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <input
        :value="url" @input="set('url', ($event.target as HTMLInputElement).value)"
        type="url" inputmode="url" autocomplete="off" spellcheck="false"
        class="field-input flex-1" :placeholder="$t('content.blocks.embed.urlPlaceholder')" required
        :aria-label="$t('content.blocks.kind.embed')"
      />
      <span v-if="url" class="provider-badge">{{ isAudioProvider(detected) ? $t('content.blocks.embed.audioLabel', { provider: providerLabel(detected, $t('common.link')) }) : providerLabel(detected, $t('common.link')) }}</span>
    </div>
    <div v-if="detected === 'link' && !hideLabel" class="trans-group">
      <div v-for="l in locales" :key="l" class="trans-row" :data-locale="l">
        <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
        <input :value="label[l] ?? ''" @input="set('label', { ...label, [l]: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" :placeholder="labelPlaceholder(l)" />
      </div>
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
<style scoped>
.provider-badge {
  font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.06em;
  padding: 0.25rem 0.5rem; border-radius: 0.25rem; flex-shrink: 0;
  background: var(--c-1e3a5f); color: var(--c-60a5fa); text-transform: uppercase;
}
</style>
