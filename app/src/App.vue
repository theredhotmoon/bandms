<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'
import AppNavbar from '@/components/AppNavbar.vue'

const route = useRoute()

const showNavbar = computed(
  () => !route.path.startsWith('/admin') && route.name !== 'login' && route.name !== 'register',
)
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
