<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'
import AppNavbar from '@/components/AppNavbar.vue'
import { useLang } from '@/composables/useLang'

const route = useRoute()
const { lang } = useLang()

// Keep <html lang> in sync with the active locale (WCAG 3.1.1)
watch(lang, (l) => { document.documentElement.lang = l }, { immediate: true })

// Public redesigned routes embed their own SiteNav — hide the old AppNavbar for them
const PUBLIC_ROUTES = new Set([
  'home', 'concerts', 'photos', 'posts', 'merch', 'about', 'contact', 'releases',
])

const showNavbar = computed(() => {
  if (route.path.startsWith('/admin')) return false
  if (route.name === 'login' || route.name === 'register') return false
  if (PUBLIC_ROUTES.has(route.name as string)) return false
  return true
})

// Route-change focus management: move focus to main content on navigation (WCAG 2.4.3)
const mainContent = ref<HTMLElement>()
watch(() => route.path, () => {
  mainContent.value?.focus()
})
</script>

<template>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <AppNavbar v-if="showNavbar" />
  <div ref="mainContent" id="main-content" tabindex="-1" :class="showNavbar ? 'page-offset' : ''">
    <RouterView />
  </div>
  <Toaster position="bottom-right" :duration="4000" richColors />
</template>

<style>
.page-offset { padding-top: 56px; }

/* Skip link — visible only on focus (WCAG 2.4.1) */
.skip-link {
  position: fixed;
  top: 0; left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  padding: 0.5rem 1.25rem;
  background: #fff;
  color: #121212;
  border: 2px solid #121212;
  font-weight: 600;
  font-size: 0.875rem;
  z-index: 10000;
  text-decoration: none;
  border-radius: 0 0 4px 4px;
  white-space: nowrap;
}
.skip-link:focus { opacity: 1; outline: 3px solid #1f8f7a; outline-offset: 2px; }

/* Suppress focus ring on programmatically-focused main wrapper */
#main-content:focus { outline: none; }

/* Visually hidden utility — for SR-only labels (WCAG 1.3.1) */
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
}

/* Respect reduced-motion preference (WCAG 2.3.3) */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
