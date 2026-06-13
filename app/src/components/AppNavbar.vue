<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useBandProfile } from '@/composables/useBandProfile'
import CartBadge from '@/components/merch/CartBadge.vue'
import CartDrawer from '@/components/merch/CartDrawer.vue'

const { isLoggedIn, logout } = useAuth()
const router = useRouter()
const mobileOpen = ref(false)

const { query: profileQ } = useBandProfile()

const bandLogoUrl = computed(() => {
  const p = profileQ.data.value
  if (!p) return null
  // Use website_logo_id pin if set
  if (p.website_logo_id && p.logos?.length) {
    const pinned = p.logos.find((l: { id: number; url: string }) => l.id === p.website_logo_id)
    if (pinned) return pinned.url
  }
  return p.logo_url ?? null
})

const navLinks = [
  { to: '/about',    label: 'About' },
  { to: '/posts',    label: 'News' },
  { to: '/concerts', label: 'Concerts' },
  { to: '/releases', label: 'Releases' },
  { to: '/videos',   label: 'Videos' },
  { to: '/photos',   label: 'Galleries' },
  { to: '/merch',    label: 'Merch' },
  { to: '/contact',  label: 'Contact' },
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
      <!-- Band logo image when available -->
      <img
        v-if="bandLogoUrl"
        :src="bandLogoUrl"
        alt="Band logo"
        class="nav-band-logo"
      />
      <!-- Fallback: original BandMS logo -->
      <template v-else>
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3"/>
        </svg>
        <span class="logo-text">Band<span class="logo-accent">MS</span></span>
      </template>
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
      <CartBadge />
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

  <CartDrawer />
</template>

<style scoped>
/* ── Navbar shell ───────────────────────────────────────── */
.app-nav {
  position: fixed; top: 0; left: 0; right: 0; height: 56px; z-index: 50;
  display: flex; align-items: center; gap: 0.25rem;
  padding: 0 1.25rem;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

/* ── Logo ───────────────────────────────────────────────── */
.nav-logo {
  display: flex; align-items: center; gap: 0.5rem;
  text-decoration: none; flex-shrink: 0; margin-right: 0.75rem;
}
.logo-icon { width: 1.125rem; height: 1.125rem; color: #111; flex-shrink: 0; }
.nav-band-logo { height: 1.75rem; max-width: 8rem; object-fit: contain; display: block; }
.logo-text  { font-weight: 700; font-size: 1rem; color: #111; letter-spacing: -0.01em; }
.logo-accent { color: #111; }

/* ── Desktop links ──────────────────────────────────────── */
.desktop-links {
  display: flex; align-items: center; gap: 0.125rem;
}
.desk-link {
  padding: 0.375rem 0.625rem; border-radius: 0.375rem;
  font-size: 0.8125rem; font-weight: 500; color: #555;
  text-decoration: none; white-space: nowrap;
  transition: background 120ms, color 120ms;
}
.desk-link:hover        { background: #f5f5f5; color: #111; }
.desk-link--active      { background: #f0f0f0; color: #111; font-weight: 600; }

.nav-spacer { flex: 1; }

/* ── Right actions ──────────────────────────────────────── */
.right-actions {
  display: flex; align-items: center; gap: 0.375rem; flex-shrink: 0;
}
.btn-admin {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.75rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #f0f0f0; color: #111;
  text-decoration: none; border: 1px solid #ddd;
  transition: background 120ms, border-color 120ms;
}
.btn-admin:hover { background: #e0e0e0; border-color: #bbb; }

.btn-signout {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.75rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: transparent; color: #888;
  border: 1px solid transparent; cursor: pointer;
  transition: background 120ms, color 120ms;
}
.btn-signout:hover { background: #f5f5f5; color: #111; }

.btn-signin {
  padding: 0.375rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 600;
  background: #111; color: #fff;
  text-decoration: none;
  transition: background 120ms;
}
.btn-signin:hover { background: #333; }

/* ── Hamburger ──────────────────────────────────────────── */
.hamburger {
  display: none; flex-direction: column; justify-content: center; gap: 5px;
  width: 36px; height: 36px; padding: 6px; border-radius: 6px;
  background: transparent; border: none; cursor: pointer; flex-shrink: 0;
}
.bar {
  display: block; width: 100%; height: 2px; border-radius: 2px;
  background: #555;
  transition: transform 200ms, opacity 150ms;
}
.bar.open:first-child  { transform: translateY(7px) rotate(45deg); }
.bar.mid.open          { opacity: 0; }
.bar.open:last-child   { transform: translateY(-7px) rotate(-45deg); }

/* ── Mobile menu ────────────────────────────────────────── */
.mobile-menu {
  position: fixed; top: 56px; left: 0; right: 0; z-index: 49;
  background: #fff; border-bottom: 1px solid #e0e0e0;
  padding: 0.75rem 1rem 1rem;
  display: flex; flex-direction: column; gap: 0.25rem;
}
.mob-link {
  display: block; padding: 0.625rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 500; color: #555;
  text-decoration: none; border: none; background: transparent;
  cursor: pointer; text-align: left;
  transition: background 120ms, color 120ms;
}
.mob-link:hover       { background: #f5f5f5; color: #111; }
.mob-link--active     { background: #f0f0f0; color: #111; font-weight: 600; }
.mob-signout:hover    { color: #111; }
.mob-divider          { height: 1px; background: #e0e0e0; margin: 0.25rem 0; }

/* ── Backdrop ───────────────────────────────────────────── */
.backdrop {
  position: fixed; inset: 0; top: 56px; z-index: 48;
  background: rgba(0,0,0,0.3);
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
