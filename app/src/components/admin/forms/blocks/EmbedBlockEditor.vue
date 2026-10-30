<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import { LOCALES, bagFrom, type Lang, type TranslationBag } from '@/locales'
import { providerLabel, detectProvider, isAudioProvider } from '@/utils/postBlocks'

const props = defineProps<{ payload: Record<string, unknown>; hideLabel?: boolean }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const url = computed(() => (props.payload.url as string) ?? '')

// Preview only — the server re-detects and stores the provider on save.
const detected = computed(() => detectProvider(url.value))

const label = computed(() => (props.payload.label ?? {}) as Partial<Record<Lang, string>>)

const { t } = useI18n()
const labelPlaceholder = (l: Lang): string => t('content.blocks.embed.linkText', {}, { locale: l })

// Every block on a post renders the same field, so the translate key carries
// this instance's id — otherwise one block's spinner would light every block.
const uid = useId()

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}

// A loaded payload may hold a partial bag; the field takes and returns a full
// one, blanks included — the API nulls blank strings itself (see TextBlockEditor).
function setLabel(next: TranslationBag) {
  set('label', next)
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
    <TranslatedField
      v-if="detected === 'link' && !hideLabel"
      :model-value="bagFrom(label)"
      kind="input"
      :field-key="`post.block.embedLabel#${uid}`"
      :placeholders="Object.fromEntries(LOCALES.map(l => [l, labelPlaceholder(l)]))"
      @update:model-value="setLabel"
    />
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
