<script setup lang="ts">
/**
 * The admin panel's front door — sign-in form when signed out, dashboard when
 * signed in, at one URL.
 *
 * There is deliberately no /login route any more. A dedicated login URL is the
 * thing a scanner looks for, and it announces that an admin panel exists even
 * when the panel itself has been moved off /admin. Folding both states into the
 * panel root means the only way to learn the URL is to already know it.
 *
 * No handler is needed on the form's success event: SignInForm calls
 * useAuth().login(), which writes the module-level token ref, so isLoggedIn
 * flips and this component swaps itself over. The same reactivity covers
 * signing out while sitting on this route, where a router.push() to the URL we
 * are already on would not re-run anything.
 */
import { defineAsyncComponent } from 'vue'
import { useAuth } from '@/composables/useAuth'
import SignInForm from '@/components/auth/SignInForm.vue'

const { isLoggedIn } = useAuth()

// Async, so an anonymous visitor who guesses the URL is never served the
// dashboard's chunk — they get the form and nothing else.
const AdminDashboard = defineAsyncComponent(
  () => import('@/views/admin/AdminDashboard.vue'),
)
</script>

<template>
  <AdminDashboard v-if="isLoggedIn" />

  <div v-else class="flex min-h-screen items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <p class="mb-6 text-center text-sm font-semibold tracking-widest uppercase" style="color:#555555;">BandMS</p>
      <div class="table-card px-8 py-8">
        <h1 class="mb-6 text-base font-semibold" style="color:#e2e8f0;">Sign In</h1>
        <SignInForm />
      </div>
    </div>
  </div>
</template>

<style scoped src="./admin-table.css" />
