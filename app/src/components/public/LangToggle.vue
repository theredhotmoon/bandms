<script setup lang="ts">
import { useLang } from '@/composables/useLang'

interface Props {
  dark?: boolean
}
withDefaults(defineProps<Props>(), { dark: false })

const { lang, setLang } = useLang()
</script>

<template>
  <div class="lang-toggle" :class="{ 'lang-toggle--dark': dark }">
    <button
      v-for="l in (['en', 'pl'] as const)"
      :key="l"
      class="lang-btn"
      :class="{ 'lang-btn--active': lang === l }"
      @click="setLang(l)"
    >{{ l.toUpperCase() }}</button>
  </div>
</template>

<style scoped>
.lang-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  border: 1.5px solid rgba(0,0,0,.18);
}
.lang-toggle--dark {
  border-color: rgba(255,255,255,.25);
}
.lang-btn {
  border: none;
  cursor: pointer;
  font: 800 12px/1 'Archivo', sans-serif;
  letter-spacing: .06em;
  padding: 7px 11px;
  background: transparent;
  color: rgba(0,0,0,.5);
  border-radius: 999px;
  transition: background 120ms, color 120ms;
}
.lang-toggle--dark .lang-btn {
  color: rgba(255,255,255,.55);
}
.lang-btn--active {
  background: #E2702A;
  color: #fff !important;
}
</style>
