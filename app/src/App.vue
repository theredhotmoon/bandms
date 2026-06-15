<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'
import AppNavbar from '@/components/AppNavbar.vue'

const route = useRoute()

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
</script>

<template>
  <AppNavbar v-if="showNavbar" />
  <div :class="showNavbar ? 'page-offset' : ''">
    <RouterView />
  </div>
  <Toaster position="bottom-right" :duration="4000" richColors />
</template>

<style>
.page-offset { padding-top: 56px; }
</style>
