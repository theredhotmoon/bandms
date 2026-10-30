<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import { LOCALES, bagFrom, type Lang, type TranslationBag } from '@/locales'

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const { t } = useI18n()

// Every block on a post renders the same field, so the translate key carries
// this instance's id — otherwise one block's spinner would light every block.
const fieldKey = `post.block.text#${useId()}`

const placeholders = Object.fromEntries(LOCALES.map(l => [l, t('content.blocks.text.placeholder', {}, { locale: l })])) as Record<Lang, string>

// A loaded payload may hold a partial bag (only locales ever typed); the
// field wants a full one. The full bag goes back out WITH its blanks: the API
// requires `body` to be a non-empty array and nulls blank strings itself, so
// stripping them would make a paragraph cleared in every language unsaveable.
const body = () => bagFrom(props.payload.body as Partial<Record<Lang, string>> | undefined)

function set(bag: TranslationBag) {
  emit('update:payload', { ...props.payload, body: bag })
}
</script>

<template>
  <!-- Bold, italic and links (plus lists/headings) — stored as HTML, which the
       public TextBlock renders as-is. Blocks written as plain text before this
       load with their line breaks as paragraphs. The host form may narrow the
       rows to one language (VISIBLE_LOCALES); TranslatedField reads that itself. -->
  <TranslatedField
    :model-value="body()"
    kind="rich"
    :field-key="fieldKey"
    :label="$t('content.blocks.kind.text')"
    :placeholders="placeholders"
    @update:model-value="set"
  />
</template>
