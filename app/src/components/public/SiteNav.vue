<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useLang } from '@/composables/useLang'
import LangToggle from './LangToggle.vue'

interface Props {
  active?: string
}
defineProps<Props>()

const { lang } = useLang()
const { isLoggedIn } = useAuth()

const NAV = [
  { key: 'music',   to: '/releases',  en: 'Music',   pl: 'Muzyka' },
  { key: 'shows',   to: '/concerts',  en: 'Shows',   pl: 'Koncerty' },
  { key: 'gallery', to: '/photos',    en: 'Gallery', pl: 'Galeria' },
  { key: 'news',    to: '/posts',     en: 'News',    pl: 'Aktualności' },
  { key: 'shop',    to: '/merch',     en: 'Shop',    pl: 'Sklep' },
  { key: 'about',   to: '/about',     en: 'About',   pl: 'O nas' },
  { key: 'contact', to: '/contact',   en: 'Contact', pl: 'Kontakt' },
]
</script>

<template>
  <header class="site-nav">
    <RouterLink to="/" class="site-nav__brand">SKANKING STORKS</RouterLink>
    <nav class="site-nav__links">
      <template v-for="item in NAV" :key="item.key">
        <span v-if="item.key === active" class="site-nav__item site-nav__item--active">
          {{ item[lang] }}
        </span>
        <RouterLink
          v-else
          :to="item.to"
          class="site-nav__item"
        >{{ item[lang] }}</RouterLink>
      </template>
      <LangToggle dark />
      <RouterLink v-if="isLoggedIn" to="/admin" class="site-nav__admin">Admin</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.site-nav {
  position: relative;
  z-index: 20;
  background: #121212;
  color: #EFE7D6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 90px;
  flex-wrap: wrap;
}
.site-nav__brand {
  font: 400 22px/1 'Anton', sans-serif;
  color: #EFE7D6;
  text-decoration: none;
  letter-spacing: 0;
  flex-shrink: 0;
}
.site-nav__links {
  display: flex;
  align-items: center;
  gap: 24px;
  font: 700 14px/1 'Archivo', sans-serif;
  letter-spacing: .08em;
  text-transform: uppercase;
  flex-wrap: wrap;
}
.site-nav__item {
  color: #EFE7D6;
  text-decoration: none;
  transition: opacity 120ms;
}
.site-nav__item:hover { opacity: .7; }
.site-nav__item--active {
  color: var(--color-accent);
  cursor: default;
}
.site-nav__admin {
  color: var(--color-accent);
  text-decoration: none;
  font: 700 13px/1 'Archivo', sans-serif;
  letter-spacing: .08em;
  border: 2px solid var(--color-accent);
  padding: 6px 12px;
  transition: background 120ms, color 120ms;
}
.site-nav__admin:hover {
  background: var(--color-accent);
  color: #fff;
}
@media (max-width: 900px) {
  .site-nav { padding: 16px 24px; }
  .site-nav__links { gap: 16px; font-size: 12px; }
}
</style>
