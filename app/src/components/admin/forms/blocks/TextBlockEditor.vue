<script setup lang="ts">
const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const body = () => (props.payload.body ?? {}) as { en?: string; pl?: string }

function set(locale: 'en' | 'pl', value: string) {
  emit('update:payload', { ...props.payload, body: { ...body(), [locale]: value } })
}
</script>

<template>
  <div class="trans-group">
    <div class="trans-row trans-row--top">
      <span class="lang-badge">EN</span> <!-- i18n-ignore: ISO 639-1 code --> <!-- i18n-ignore: language code for the per-locale content field -->
      <textarea
        :value="body().en ?? ''"
        @input="set('en', ($event.target as HTMLTextAreaElement).value)"
        class="field-input flex-1" rows="5" :placeholder="$t('content.blocks.text.placeholderEn')"
      />
    </div>
    <div class="trans-row trans-row--top">
      <span class="lang-badge lang-badge--pl">PL</span> <!-- i18n-ignore: ISO 639-1 code --> <!-- i18n-ignore: language code -->
      <textarea
        :value="body().pl ?? ''"
        @input="set('pl', ($event.target as HTMLTextAreaElement).value)"
        class="field-input flex-1" rows="5" :placeholder="$t('content.blocks.text.placeholderPl')"
      />
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
