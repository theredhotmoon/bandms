<script setup lang="ts">
import { useRouter } from 'vue-router'
import SignInForm from '@/components/auth/SignInForm.vue'

const router = useRouter()

function onAuthSuccess() {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <p class="mb-6 text-center text-sm font-semibold tracking-widest uppercase" style="color:#555555;">BandMS</p>
      <div class="table-card px-8 py-8">
        <h1 class="mb-6 text-base font-semibold" style="color:#e2e8f0;">Sign In</h1>
        <SignInForm @success="onAuthSuccess" />
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin/admin-table.css" />
