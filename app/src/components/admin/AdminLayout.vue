<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const { logout, user, isAdmin, isMember, isPublisher } = useAuth()
const router = useRouter()
const route = useRoute()

async function handleLogout() {
  await logout()
  router.push('/login')
}

type TabId = 'band' | 'content' | 'shows' | 'more'

const tabRoutes: Record<TabId, string[]> = {
  band: ['/admin/my-profile', '/admin/my-setups', '/admin/band-profile', '/admin/band-members',
         '/admin/releases', '/admin/music-videos', '/admin/photos', '/admin/band-calendar',
         '/admin/tech-rider', '/admin/setlists'],
  content: ['/admin/posts', '/admin/press-releases', '/admin/pitch', '/admin/newsletter', '/admin/authors'],
  shows: ['/admin/concerts', '/admin/tours', '/admin/venues'],
  more: ['/admin/shop', '/admin/bands', '/admin/tags', '/admin/instruments', '/admin/users'],
}

function tabForRoute(path: string): TabId | null {
  for (const [tab, routes] of Object.entries(tabRoutes) as [TabId, string[]][]) {
    if (routes.some(r => path.startsWith(r))) return tab
  }
  return null
}

const activeTab = ref<TabId>(tabForRoute(route.path) ?? 'band')

watch(() => route.path, (path) => {
  const t = tabForRoute(path)
  if (t) activeTab.value = t
})

const tabs: { id: TabId; label: string }[] = [
  { id: 'band',    label: 'Band'    },
  { id: 'content', label: 'Content' },
  { id: 'shows',   label: 'Shows'   },
  { id: 'more',    label: 'More'    },
]
</script>

<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-mark">
          <span class="logo-band">Band</span><span class="logo-ms">MS</span>
        </div>
        <div class="logo-sub">Admin</div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/admin" class="nav-item" exact-active-class="nav-item--active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          Dashboard
        </RouterLink>

        <div class="tab-strip">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ 'tab-btn--active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>

        <!-- Band tab -->
        <template v-if="activeTab === 'band'">
          <template v-if="isMember">
            <RouterLink to="/admin/my-profile" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              My Profile
            </RouterLink>
            <RouterLink to="/admin/my-setups" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/><path d="M12 3v14"/><rect x="8" y="3" width="8" height="4" rx="1"/></svg>
              My Stage Setups
            </RouterLink>
          </template>
          <template v-if="isAdmin">
            <RouterLink to="/admin/band-profile" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
              Band Profile
            </RouterLink>
            <RouterLink to="/admin/band-members" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Band Members
            </RouterLink>
            <RouterLink to="/admin/releases" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              Releases
            </RouterLink>
            <RouterLink to="/admin/music-videos" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              Music Videos
            </RouterLink>
            <RouterLink to="/admin/photos" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Photos
            </RouterLink>
            <RouterLink to="/admin/band-calendar" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
              Band Calendar
            </RouterLink>
            <RouterLink to="/admin/tech-rider" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/><path d="M12 3v14"/><rect x="8" y="3" width="8" height="4" rx="1"/></svg>
              Tech Rider
            </RouterLink>
            <RouterLink to="/admin/setlists" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              Setlists
            </RouterLink>
          </template>
        </template>

        <!-- Content tab -->
        <template v-if="activeTab === 'content'">
          <template v-if="isAdmin || isPublisher">
            <RouterLink to="/admin/posts" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Posts
            </RouterLink>
          </template>
          <template v-if="isAdmin">
            <RouterLink to="/admin/press-releases" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Press
            </RouterLink>
            <RouterLink to="/admin/pitch" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Pitch Generator
            </RouterLink>
            <RouterLink to="/admin/newsletter" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Newsletter
            </RouterLink>
            <RouterLink to="/admin/authors" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Authors & Contacts
            </RouterLink>
          </template>
        </template>

        <!-- Shows tab -->
        <template v-if="activeTab === 'shows' && isAdmin">
          <RouterLink to="/admin/concerts" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Concerts
          </RouterLink>
          <RouterLink to="/admin/tours" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Tours
          </RouterLink>
          <RouterLink to="/admin/venues" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Venues
          </RouterLink>
        </template>

        <!-- More tab -->
        <template v-if="activeTab === 'more' && isAdmin">
          <RouterLink to="/admin/shop" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            Shop
          </RouterLink>
          <RouterLink to="/admin/bands" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="3"/><path d="M15 8a3 3 0 010 8M18 5a7 7 0 010 14"/></svg>
            Other Bands
          </RouterLink>
          <RouterLink to="/admin/tags" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            Tags
          </RouterLink>
          <RouterLink to="/admin/instruments" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            Instruments
          </RouterLink>
          <RouterLink to="/admin/users" class="nav-item" active-class="nav-item--active">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            Users
          </RouterLink>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div v-if="user" class="sidebar-user">
          <div class="user-avatar">{{ (user.first_name?.[0] ?? '') }}{{ (user.last_name?.[0] ?? '') }}</div>
          <div class="user-info">
            <div class="user-name">{{ user.first_name }} {{ user.last_name }}</div>
            <div class="user-role">{{ user.role }}</div>
          </div>
        </div>
        <button @click="handleLogout" class="btn-signout">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Sign out
        </button>
      </div>
    </aside>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: #0a0a0a;
  color: #e2e8f0;
}

/* ── Sidebar ─────────────────────────────────────── */
.sidebar {
  width: 15rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #111111;
  border-right: 1px solid #222222;
}

.sidebar-logo {
  padding: 1.125rem 1.25rem 1rem;
  border-bottom: 1px solid #222222;
}
.logo-mark {
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}
.logo-band { color: #e2e8f0; }
.logo-ms   { color: #ffffff; }
.logo-sub {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #555555;
  margin-top: 0.25rem;
}

/* ── Nav ─────────────────────────────────────────── */
.sidebar-nav {
  flex: 1;
  padding: 0.625rem 0.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
}

/* ── Tab strip ───────────────────────────────────── */
.tab-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.125rem;
  margin: 0.375rem 0 0.5rem;
  background: #0d0d0d;
  border-radius: 0.375rem;
  padding: 0.1875rem;
}

.tab-btn {
  padding: 0.3125rem 0;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #555555;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 120ms, color 120ms;
  text-align: center;
  white-space: nowrap;
}
.tab-btn:hover {
  color: #aaaaaa;
}
.tab-btn--active {
  background: #1f1f1f;
  color: #e2e8f0;
}

.nav-icon { width: 0.9375rem; height: 0.9375rem; flex-shrink: 0; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.4375rem 0.875rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #555555;
  text-decoration: none;
  cursor: pointer;
  border: none;
  width: 100%;
  background: transparent;
  transition: background 120ms, color 120ms, box-shadow 120ms;
  box-shadow: inset 2px 0 0 transparent;
  text-align: left;
}
.nav-item:hover {
  background: #1a1a1a;
  color: #aaaaaa;
}
.nav-item--active {
  background: #1f1f1f !important;
  color: #ffffff !important;
  box-shadow: inset 2px 0 0 #ffffff !important;
}

/* ── Footer ──────────────────────────────────────── */
.sidebar-footer {
  padding: 0.625rem 0.5rem;
  border-top: 1px solid #222222;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.375rem 0.875rem;
}
.user-avatar {
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 9999px;
  background: #2a2a2a;
  color: #c0c0c0;
  font-size: 0.625rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}
.user-info { min-width: 0; flex: 1; }
.user-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: #d0d0d0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #555555;
}

.btn-signout {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.4375rem 0.875rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #666666;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 120ms, color 120ms;
  text-align: left;
}
.btn-signout:hover { background: #1a0a0a; color: #f87171; }

/* ── Main ────────────────────────────────────────── */
.main-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
</style>
