<script setup lang="ts">
/**
 * The admin chrome's language. A <select> rather than a two-way toggle: it
 * stays correct when a third locale is added to src/locales.ts, and it gives
 * the E2E spec a stable handle.
 */
import { useI18n } from 'vue-i18n'
import { LOCALES, isLocale, nativeName } from '@/locales'
import { useUiLang } from '@/composables/useUiLang'

const { t } = useI18n()
const { uiLang, setUiLang } = useUiLang()

function onChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isLocale(value)) setUiLang(value)
}
</script>

<template>
  <label class="ui-lang">
    <span class="sr-only">{{ t('shell.uiLang.label') }}</span>
    <select
      class="ui-lang-select"
      data-testid="ui-lang-switcher"
      :value="uiLang"
      @change="onChange"
    >
      <option v-for="locale in LOCALES" :key="locale" :value="locale">
        {{ nativeName(locale) }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.ui-lang { display: block; margin-bottom: 0.5rem; }

.ui-lang-select {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  background: #141414;
  border: 1px solid #2a2a2a;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
}
.ui-lang-select:hover { background: #1a1a1a; color: #e2e8f0; }
.ui-lang-select:focus-visible { outline: 2px solid #1f8f7a; outline-offset: 1px; }
</style>
