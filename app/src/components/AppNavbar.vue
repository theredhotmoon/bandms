<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useBandProfile } from '@/composables/useBandProfile'

const { isLoggedIn, logout } = useAuth()
const router = useRouter()

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

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>

<template>
  <!--
    Chrome for the three non-admin SPA pages that survive: the fan portal
    (/account), ticket claim (/tickets/claim/:token) and the tech-rider
    preview (/tech-rider*). Public browsing lives in the Astro site, so this
    bar carries no navigation of its own — only identity and the way in or out.
  -->
  <nav class="app-nav">
    <!--
      A plain <a>, not a RouterLink: "/" is served by Astro, not the SPA.
      Caddy's @spa matcher never routes it here, so a client-side push would
      resolve to nothing.
    -->
    <a href="/" class="nav-logo">
      <!-- Band logo image when available -->
      <img
        v-if="bandLogoUrl"
        :src="bandLogoUrl"
        alt="Band logo"
        class="nav-band-logo"
      />
      <!-- Fallback: original BandMS logo -->
      <template v-else>
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3"/>
        </svg>
        <span class="logo-text">Band<span class="logo-accent">MS</span></span>
      </template>
    </a>

    <div class="nav-spacer" />

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
  </nav>
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

.nav-spacer { flex: 1; }

/* ── Right actions ──────────────────────────────────────── */
/*
  Visible at every width. There is no hamburger any more — the mobile drawer
  existed only to hold the public nav links, and hiding .right-actions below
  768px (as the old responsive block did) would now leave the bar empty.
*/
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
</style>
