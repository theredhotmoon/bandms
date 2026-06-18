<script setup lang="ts">
import { ref } from 'vue'
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
const mobileOpen = ref(false)

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
    <RouterLink to="/" class="site-nav__brand" @click="mobileOpen = false">SKANKING STORKS</RouterLink>
    <nav class="site-nav__links" :aria-label="lang === 'en' ? 'Main navigation' : 'Nawigacja główna'">
      <template v-for="item in NAV" :key="item.key">
        <RouterLink
          :to="item.to"
          class="site-nav__item"
          :class="{ 'site-nav__item--active': item.key === active }"
          :aria-current="item.key === active ? 'page' : undefined"
        >{{ item[lang] }}</RouterLink>
      </template>
      <LangToggle dark />
      <RouterLink v-if="isLoggedIn" to="/admin" class="site-nav__admin">Admin</RouterLink>
    </nav>

    <!-- Hamburger (mobile only) -->
    <button
      class="site-nav__hamburger"
      :aria-expanded="mobileOpen"
      aria-controls="site-nav-mobile-menu"
      :aria-label="lang === 'en' ? 'Toggle navigation' : 'Otwórz menu'"
      @click="mobileOpen = !mobileOpen"
    >
      <span class="site-nav__bar" :class="{ open: mobileOpen }" />
      <span class="site-nav__bar site-nav__bar--mid" :class="{ open: mobileOpen }" />
      <span class="site-nav__bar" :class="{ open: mobileOpen }" />
    </button>
  </header>

  <!-- Mobile menu -->
  <Transition name="site-nav-slide">
    <nav
      v-if="mobileOpen"
      id="site-nav-mobile-menu"
      class="site-nav__mobile"
      :aria-label="lang === 'en' ? 'Mobile navigation' : 'Nawigacja mobilna'"
    >
      <RouterLink
        v-for="item in NAV"
        :key="item.key"
        :to="item.to"
        class="site-nav__mob-item"
        :class="{ 'site-nav__mob-item--active': item.key === active }"
        :aria-current="item.key === active ? 'page' : undefined"
        @click="mobileOpen = false"
      >{{ item[lang] }}</RouterLink>
      <div class="site-nav__mob-divider" />
      <LangToggle dark />
      <RouterLink v-if="isLoggedIn" to="/admin" class="site-nav__mob-item" @click="mobileOpen = false">Admin</RouterLink>
    </nav>
  </Transition>

  <!-- Backdrop -->
  <Transition name="site-nav-fade">
    <div v-if="mobileOpen" class="site-nav__backdrop" @click="mobileOpen = false" />
  </Transition>
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

/* ── Hamburger ── */
.site-nav__hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 6px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: auto;
}
.site-nav__bar {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 2px;
  background: #EFE7D6;
  transition: transform 200ms, opacity 150ms;
}
.site-nav__bar.open:first-child  { transform: translateY(7px) rotate(45deg); }
.site-nav__bar--mid.open         { opacity: 0; }
.site-nav__bar.open:last-child   { transform: translateY(-7px) rotate(-45deg); }

/* ── Mobile menu ── */
.site-nav__mobile {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 19;
  background: #121212;
  color: #EFE7D6;
  padding: 72px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: 4px solid var(--color-accent);
}
.site-nav__mob-item {
  display: block;
  padding: 12px 16px;
  border-radius: 6px;
  font: 700 16px/1 'Archivo', sans-serif;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: #EFE7D6;
  text-decoration: none;
  transition: background 120ms;
}
.site-nav__mob-item:hover { background: rgba(255,255,255,.08); }
.site-nav__mob-item--active { color: var(--color-accent); }
.site-nav__mob-divider { height: 1px; background: rgba(255,255,255,.12); margin: 8px 0; }

.site-nav__backdrop {
  position: fixed;
  inset: 0;
  z-index: 18;
  background: rgba(0,0,0,.55);
}

/* ── Transitions ── */
.site-nav-slide-enter-active, .site-nav-slide-leave-active { transition: transform 220ms ease, opacity 220ms ease; }
.site-nav-slide-enter-from, .site-nav-slide-leave-to { transform: translateY(-8px); opacity: 0; }
.site-nav-fade-enter-active, .site-nav-fade-leave-active { transition: opacity 200ms ease; }
.site-nav-fade-enter-from, .site-nav-fade-leave-to { opacity: 0; }

/* ── Responsive ── */
@media (max-width: 900px) {
  .site-nav { padding: 16px 24px; }
  .site-nav__links { display: none; }
  .site-nav__hamburger { display: flex; }
}
@media (min-width: 901px) {
  .site-nav__mobile { display: none; }
  .site-nav__backdrop { display: none; }
}
</style>
