<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const { isLoggedIn, logout } = useAuth()
const router = useRouter()
const mobileOpen = ref(false)

const navLinks = [
  { to: '/concerts', label: 'Concerts' },
  { to: '/bands',    label: 'Bands' },
  { to: '/venues',   label: 'Venues' },
  { to: '/posts',    label: 'Posts' },
  { to: '/photos',   label: 'Photos' },
  { to: '/tags',     label: 'Tags' },
]

async function handleLogout() {
  mobileOpen.value = false
  await logout()
  router.push('/login')
}
</script>

<template>
  <!-- Top bar -->
  <nav class="app-nav">
    <!-- Logo -->
    <RouterLink to="/" class="nav-logo" @click="mobileOpen = false">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3"/>
      </svg>
      <span class="logo-text">Band<span class="logo-accent">MS</span></span>
    </RouterLink>

    <!-- Desktop links -->
    <div class="desktop-links">
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="desk-link"
        active-class="desk-link--active"
      >
        {{ link.label }}
      </RouterLink>
    </div>

    <div class="nav-spacer" />

    <!-- Right actions (desktop) -->
    <div class="right-actions">
      <RouterLink v-if="isLoggedIn" to="/admin" class="btn-admin">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Admin
      </RouterLink>
      <button v-if="isLoggedIn" class="btn-signout" @click="handleLogout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        Sign out
      </button>
      <RouterLink v-else to="/login" class="btn-signin">Sign in</RouterLink>
    </div>

    <!-- Hamburger (mobile) -->
    <button class="hamburger" :aria-expanded="mobileOpen" aria-label="Toggle navigation" @click="mobileOpen = !mobileOpen">
      <span class="bar" :class="{ open: mobileOpen }" />
      <span class="bar mid" :class="{ open: mobileOpen }" />
      <span class="bar" :class="{ open: mobileOpen }" />
    </button>
  </nav>

  <!-- Mobile drawer -->
  <Transition name="slide">
    <div v-if="mobileOpen" class="mobile-menu">
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="mob-link"
        active-class="mob-link--active"
        @click="mobileOpen = false"
      >
        {{ link.label }}
      </RouterLink>

      <div class="mob-divider" />

      <RouterLink v-if="isLoggedIn" to="/admin" class="mob-link" @click="mobileOpen = false">
        Admin Panel
      </RouterLink>
      <button v-if="isLoggedIn" class="mob-link mob-signout" @click="handleLogout">Sign out</button>
      <RouterLink v-else to="/login" class="mob-link" @click="mobileOpen = false">Sign in</RouterLink>
    </div>
  </Transition>

  <!-- Backdrop -->
  <Transition name="fade">
    <div v-if="mobileOpen" class="backdrop" @click="mobileOpen = false" />
  </Transition>
</template>

<style scoped>
/* ── Navbar shell ───────────────────────────────────────── */
.app-nav {
  position: fixed; top: 0; left: 0; right: 0; height: 56px; z-index: 50;
  display: flex; align-items: center; gap: 0.25rem;
  padding: 0 1.25rem;
  background: #0d0d22;
  border-bottom: 1px solid #2d2a6e;
}

/* ── Logo ───────────────────────────────────────────────── */
.nav-logo {
  display: flex; align-items: center; gap: 0.5rem;
  text-decoration: none; flex-shrink: 0; margin-right: 0.75rem;
}
.logo-icon { width: 1.125rem; height: 1.125rem; color: #6366f1; flex-shrink: 0; }
.logo-text  { font-weight: 700; font-size: 1rem; color: #e2e8f0; letter-spacing: -0.01em; }
.logo-accent { color: #6366f1; }

/* ── Desktop links ──────────────────────────────────────── */
.desktop-links {
  display: flex; align-items: center; gap: 0.125rem;
}
.desk-link {
  padding: 0.375rem 0.625rem; border-radius: 0.375rem;
  font-size: 0.8125rem; font-weight: 500; color: #94a3b8;
  text-decoration: none; white-space: nowrap;
  transition: background 120ms, color 120ms;
}
.desk-link:hover        { background: #161630; color: #c7d2fe; }
.desk-link--active      { background: #1e1b4b; color: #a5b4fc; }

.nav-spacer { flex: 1; }

/* ── Right actions ──────────────────────────────────────── */
.right-actions {
  display: flex; align-items: center; gap: 0.375rem; flex-shrink: 0;
}
.btn-admin {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.75rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #1e1b4b; color: #a5b4fc;
  text-decoration: none; border: 1px solid #312e81;
  transition: background 120ms, border-color 120ms;
}
.btn-admin:hover { background: #2d2a6e; border-color: #4338ca; }

.btn-signout {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.75rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: transparent; color: #64748b;
  border: 1px solid transparent; cursor: pointer;
  transition: background 120ms, color 120ms;
}
.btn-signout:hover { background: #161630; color: #f87171; }

.btn-signin {
  padding: 0.375rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 600;
  background: #4338ca; color: #fff;
  text-decoration: none;
  transition: background 120ms;
}
.btn-signin:hover { background: #5046e4; }

/* ── Hamburger ──────────────────────────────────────────── */
.hamburger {
  display: none; flex-direction: column; justify-content: center; gap: 5px;
  width: 36px; height: 36px; padding: 6px; border-radius: 6px;
  background: transparent; border: none; cursor: pointer; flex-shrink: 0;
}
.bar {
  display: block; width: 100%; height: 2px; border-radius: 2px;
  background: #94a3b8;
  transition: transform 200ms, opacity 150ms;
}
.bar.open:first-child  { transform: translateY(7px) rotate(45deg); }
.bar.mid.open          { opacity: 0; }
.bar.open:last-child   { transform: translateY(-7px) rotate(-45deg); }

/* ── Mobile menu ────────────────────────────────────────── */
.mobile-menu {
  position: fixed; top: 56px; left: 0; right: 0; z-index: 49;
  background: #0d0d22; border-bottom: 1px solid #2d2a6e;
  padding: 0.75rem 1rem 1rem;
  display: flex; flex-direction: column; gap: 0.25rem;
}
.mob-link {
  display: block; padding: 0.625rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 500; color: #94a3b8;
  text-decoration: none; border: none; background: transparent;
  cursor: pointer; text-align: left;
  transition: background 120ms, color 120ms;
}
.mob-link:hover       { background: #161630; color: #c7d2fe; }
.mob-link--active     { background: #1e1b4b; color: #a5b4fc; }
.mob-signout:hover    { color: #f87171; }
.mob-divider          { height: 1px; background: #2d2a6e; margin: 0.25rem 0; }

/* ── Backdrop ───────────────────────────────────────────── */
.backdrop {
  position: fixed; inset: 0; top: 56px; z-index: 48;
  background: rgba(0,0,0,0.4);
}

/* ── Transitions ────────────────────────────────────────── */
.slide-enter-active, .slide-leave-active { transition: transform 200ms ease, opacity 200ms ease; }
.slide-enter-from, .slide-leave-to       { transform: translateY(-8px); opacity: 0; }
.fade-enter-active, .fade-leave-active   { transition: opacity 200ms ease; }
.fade-enter-from, .fade-leave-to         { opacity: 0; }

/* ── Responsive ─────────────────────────────────────────── */
@media (max-width: 767px) {
  .desktop-links { display: none; }
  .right-actions { display: none; }
  .hamburger     { display: flex; }
}
@media (min-width: 768px) {
  .mobile-menu   { display: none; }
  .backdrop      { display: none; }
}
</style>
