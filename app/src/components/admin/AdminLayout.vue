<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { adminUrl } from '@/config/admin'
import { useAuth } from '@/composables/useAuth'
import RebuildBar from './RebuildBar.vue'
import UiLangSwitcher from './UiLangSwitcher.vue'
import AdminThemeSwitch from './AdminThemeSwitch.vue'

const { logout, user, isAdmin, isMember, isPublisher } = useAuth()

// `fill` is for full-screen editors (setlists, tech rider) that scroll their
// own panes. The main column becomes exactly one viewport tall and the slot
// takes whatever the top bar and rebuild bar leave, so the view sizes itself
// to 100% of that rather than to 100vh, which cannot know either bar is there.
defineProps<{ fill?: boolean }>()

// Below the `lg` breakpoint the sidebar is an off-canvas drawer. It closes on
// every navigation and on Escape, and the scrim is a real button so it is
// reachable without a pointer.
const menuOpen = ref(false)
function closeMenu() { menuOpen.value = false }
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeMenu() } // i18n-ignore: KeyboardEvent.key value
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
const { t } = useI18n()
const router = useRouter()
const route = useRoute()

// Explicit branches rather than a computed `shell.roles.${role}` key: $t is
// typed against the English catalogue, and a template-literal key widens to
// `string`, which throws that check away. An unknown role falls through to the
// raw value rather than rendering a missing key.
const roleLabel = computed(() => {
  switch (user.value?.role) {
    case 'admin':     return t('shell.roles.admin')
    case 'member':    return t('shell.roles.member')
    case 'publisher': return t('shell.roles.publisher')
    default:          return user.value?.role ?? ''
  }
})

async function handleLogout() {
  await logout()
  router.push(adminUrl())
}

type GroupId = 'band' | 'content' | 'shows' | 'more' | 'pageconfig'

const groupRoutes: Record<GroupId, string[]> = {
  band:       [adminUrl('my-profile'), adminUrl('my-setups'), adminUrl('band-profile'), adminUrl('band-members'),
               adminUrl('releases'), adminUrl('music-videos'), adminUrl('clips'), adminUrl('photos'), adminUrl('band-calendar'),
               adminUrl('tech-rider'), adminUrl('setlists')],
  content:    [adminUrl('posts'), adminUrl('press-releases'), adminUrl('pitch'), adminUrl('newsletter'), adminUrl('authors')],
  shows:      [adminUrl('concerts'), adminUrl('tours'), adminUrl('venues'), adminUrl('door')],
  more:       [adminUrl('shop'), adminUrl('bands'), adminUrl('tags'), adminUrl('instruments'), adminUrl('users')],
  pageconfig: [adminUrl('website-modules'), adminUrl('faqs'), adminUrl('hero-images')],
}

function groupForRoute(path: string): GroupId | null {
  for (const [group, routes] of Object.entries(groupRoutes) as [GroupId, string[]][]) {
    if (routes.some(r => path.startsWith(r))) return group
  }
  return null
}

function isGroupActive(group: GroupId): boolean {
  return groupRoutes[group].some(r => route.path.startsWith(r))
}

const openGroups = ref<Set<GroupId>>(new Set([groupForRoute(route.path) ?? 'band']))

function toggleGroup(group: GroupId) {
  if (openGroups.value.has(group)) {
    openGroups.value.delete(group)
  } else {
    openGroups.value.add(group)
  }
  // trigger reactivity
  openGroups.value = new Set(openGroups.value)
}

// When navigating to a new route, ensure its group is open
watch(() => route.path, (path) => {
  closeMenu()
  const g = groupForRoute(path)
  if (g && !openGroups.value.has(g)) {
    openGroups.value = new Set([...openGroups.value, g])
  }
})
</script>

<template>
  <div class="admin-shell" :class="{ 'admin-shell--menu-open': menuOpen, 'admin-shell--fill': fill }">
    <header class="topbar">
      <button type="button" class="topbar-menu" :aria-expanded="menuOpen" :aria-label="menuOpen ? $t('shell.menu.close') : $t('shell.menu.open')" @click="menuOpen = !menuOpen">
        <svg v-if="!menuOpen" class="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
        <svg v-else class="topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
      <RouterLink :to="adminUrl()" class="logo-mark topbar-logo">
        <span class="logo-band">Band</span><span class="logo-ms">MS</span> <!-- i18n-ignore: product wordmark -->
      </RouterLink>
    </header>

    <button v-if="menuOpen" type="button" class="scrim" :aria-label="$t('shell.menu.close')" @click="closeMenu" />

    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-mark">
          <span class="logo-band">Band</span><span class="logo-ms">MS</span> <!-- i18n-ignore: product wordmark -->
        </div>
        <div class="logo-sub">{{ $t('shell.brand.subtitle') }}</div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink :to="adminUrl()" class="nav-item" exact-active-class="nav-item--active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          {{ $t('shell.nav.dashboard') }}
        </RouterLink>

        <!-- ── Your Band ──────────────────────────────── -->
        <template v-if="isMember || isAdmin">
          <button
            class="accordion-header"
            :class="{ 'accordion-header--active': isGroupActive('band') }"
            @click="toggleGroup('band')"
          >
            <span class="accordion-title">
              <span v-if="isGroupActive('band') && !openGroups.has('band')" class="active-dot" />
              {{ $t('shell.groups.band') }}
            </span>
            <svg class="chevron" :class="{ 'chevron--open': openGroups.has('band') }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="openGroups.has('band')" class="accordion-body">
            <template v-if="isMember">
              <RouterLink :to="adminUrl('my-profile')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {{ $t('shell.nav.myProfile') }}
              </RouterLink>
              <RouterLink :to="adminUrl('my-setups')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/><path d="M12 3v14"/><rect x="8" y="3" width="8" height="4" rx="1"/></svg>
                {{ $t('shell.nav.mySetups') }}
              </RouterLink>
            </template>
            <template v-if="isAdmin">
              <RouterLink :to="adminUrl('band-profile')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
                {{ $t('shell.nav.bandProfile') }}
              </RouterLink>
              <RouterLink :to="adminUrl('band-members')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                {{ $t('shell.nav.bandMembers') }}
              </RouterLink>
              <RouterLink :to="adminUrl('releases')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                {{ $t('shell.nav.releases') }}
              </RouterLink>
              <RouterLink :to="adminUrl('music-videos')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                {{ $t('shell.nav.musicVideos') }}
              </RouterLink>
              <RouterLink :to="adminUrl('clips')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>
                {{ $t('shell.nav.clips') }}
              </RouterLink>
              <RouterLink :to="adminUrl('photos')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                {{ $t('shell.nav.photos') }}
              </RouterLink>
              <RouterLink :to="adminUrl('band-calendar')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
                {{ $t('shell.nav.bandCalendar') }}
              </RouterLink>
              <RouterLink :to="adminUrl('tech-rider')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4"/><path d="M12 3v14"/><rect x="8" y="3" width="8" height="4" rx="1"/></svg>
                {{ $t('shell.nav.techRider') }}
              </RouterLink>
              <RouterLink :to="adminUrl('setlists')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                {{ $t('shell.nav.setlists') }}
              </RouterLink>
            </template>
          </div>
        </template>

        <!-- ── Content ───────────────────────────────── -->
        <template v-if="isAdmin || isPublisher">
          <button
            class="accordion-header"
            :class="{ 'accordion-header--active': isGroupActive('content') }"
            @click="toggleGroup('content')"
          >
            <span class="accordion-title">
              <span v-if="isGroupActive('content') && !openGroups.has('content')" class="active-dot" />
              {{ $t('shell.groups.content') }}
            </span>
            <svg class="chevron" :class="{ 'chevron--open': openGroups.has('content') }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="openGroups.has('content')" class="accordion-body">
            <RouterLink :to="adminUrl('posts')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              {{ $t('shell.nav.posts') }}
            </RouterLink>
            <template v-if="isAdmin">
              <RouterLink :to="adminUrl('press-releases')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                {{ $t('shell.nav.press') }}
              </RouterLink>
              <RouterLink :to="adminUrl('pitch')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                {{ $t('shell.nav.pitch') }}
              </RouterLink>
              <RouterLink :to="adminUrl('newsletter')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {{ $t('shell.nav.newsletter') }}
              </RouterLink>
              <RouterLink :to="adminUrl('authors')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                {{ $t('shell.nav.authors') }}
              </RouterLink>
            </template>
          </div>
        </template>

        <!-- ── Shows ─────────────────────────────────── -->
        <template v-if="isAdmin">
          <button
            class="accordion-header"
            :class="{ 'accordion-header--active': isGroupActive('shows') }"
            @click="toggleGroup('shows')"
          >
            <span class="accordion-title">
              <span v-if="isGroupActive('shows') && !openGroups.has('shows')" class="active-dot" />
              {{ $t('shell.groups.shows') }}
            </span>
            <svg class="chevron" :class="{ 'chevron--open': openGroups.has('shows') }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="openGroups.has('shows')" class="accordion-body">
            <RouterLink :to="adminUrl('concerts')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {{ $t('shell.nav.concerts') }}
            </RouterLink>
            <RouterLink :to="adminUrl('tours')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {{ $t('shell.nav.tours') }}
            </RouterLink>
            <RouterLink :to="adminUrl('venues')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              {{ $t('shell.nav.venues') }}
            </RouterLink>
            <RouterLink :to="adminUrl('door')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2z"/></svg>
              {{ $t('shell.nav.door') }}
            </RouterLink>
          </div>
        </template>

        <!-- ── More ──────────────────────────────────── -->
        <template v-if="isAdmin">
          <button
            class="accordion-header"
            :class="{ 'accordion-header--active': isGroupActive('more') }"
            @click="toggleGroup('more')"
          >
            <span class="accordion-title">
              <span v-if="isGroupActive('more') && !openGroups.has('more')" class="active-dot" />
              {{ $t('shell.groups.more') }}
            </span>
            <svg class="chevron" :class="{ 'chevron--open': openGroups.has('more') }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="openGroups.has('more')" class="accordion-body">
            <RouterLink :to="adminUrl('shop')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              {{ $t('shell.nav.shop') }}
            </RouterLink>
            <RouterLink :to="adminUrl('bands')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="3"/><path d="M15 8a3 3 0 010 8M18 5a7 7 0 010 14"/></svg>
              {{ $t('shell.nav.bands') }}
            </RouterLink>
            <RouterLink :to="adminUrl('tags')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              {{ $t('shell.nav.tags') }}
            </RouterLink>
            <RouterLink :to="adminUrl('instruments')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              {{ $t('shell.nav.instruments') }}
            </RouterLink>
            <RouterLink :to="adminUrl('users')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              {{ $t('shell.nav.users') }}
            </RouterLink>
          </div>
        </template>

        <!-- ── Page Configuration ─────────────────── -->
        <template v-if="isAdmin">
          <button
            class="accordion-header"
            :class="{ 'accordion-header--active': isGroupActive('pageconfig') }"
            @click="toggleGroup('pageconfig')"
          >
            <span class="accordion-title">
              <span v-if="isGroupActive('pageconfig') && !openGroups.has('pageconfig')" class="active-dot" />
              {{ $t('shell.groups.pageconfig') }}
            </span>
            <svg class="chevron" :class="{ 'chevron--open': openGroups.has('pageconfig') }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="openGroups.has('pageconfig')" class="accordion-body">
            <RouterLink :to="adminUrl('website-modules')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="4" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="3" y="10" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="4" rx="1"/><rect x="3" y="17" width="7" height="4" rx="1"/><rect x="14" y="17" width="7" height="4" rx="1"/></svg>
              {{ $t('shell.nav.websiteModules') }}
            </RouterLink>
            <RouterLink :to="adminUrl('faqs')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {{ $t('shell.nav.faqs') }}
            </RouterLink>
            <RouterLink :to="adminUrl('hero-images')" class="nav-item" active-class="nav-item--active">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              {{ $t('shell.nav.heroImages') }}
            </RouterLink>
          </div>
        </template>
      </nav>

      <div class="sidebar-footer">
        <UiLangSwitcher />
        <AdminThemeSwitch />
        <div v-if="user" class="sidebar-user">
          <div class="user-avatar">{{ (user.first_name?.[0] ?? '') }}{{ (user.last_name?.[0] ?? '') }}</div>
          <div class="user-info">
            <div class="user-name">{{ user.first_name }} {{ user.last_name }}</div>
            <div class="user-role">{{ roleLabel }}</div>
          </div>
        </div>
        <button @click="handleLogout" class="btn-signout">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          {{ $t('shell.signOut') }}
        </button>
      </div>
    </aside>

    <main class="main-content">
      <RebuildBar />
      <div class="main-content-body">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  /* Height of the fixed top bar, 0 where it is hidden; the main column is
     padded by the same value. */
  --admin-topbar-h: 0px;
  display: flex;
  min-height: 100vh;
  background: var(--c-0a0a0a);
  color: var(--c-e2e8f0);
}

/* ── Top bar (phones and tablets only) ───────────── */
.topbar {
  display: none;
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 40;
  height: var(--admin-topbar-h);
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  background: var(--c-111111);
  border-bottom: 1px solid var(--c-222222);
}
.topbar-menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: var(--c-e2e8f0);
  cursor: pointer;
}
.topbar-menu:hover { background: var(--c-1a1a1a); }
.topbar-icon { width: 1.25rem; height: 1.25rem; }
.topbar-logo { text-decoration: none; }

.scrim {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 45;
  border: none;
  padding: 0;
  background: rgba(0, 0, 0, 0.55);
  cursor: pointer;
}

/* ── Sidebar ─────────────────────────────────────── */
.sidebar {
  width: 15.5rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  background: var(--c-111111);
  border-right: 1px solid var(--c-222222);
}

.sidebar-logo {
  padding: 1.125rem 1.25rem 1rem;
  border-bottom: 1px solid var(--c-222222);
}
.logo-mark {
  font-size: var(--fs-lg);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}
.logo-band { color: var(--c-e2e8f0); }
.logo-ms   { color: var(--c-ffffff); }
.logo-sub {
  font-size: var(--fs-2xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-caps);
  color: var(--c-888888);
  margin-top: 0.375rem;
}

/* ── Nav ─────────────────────────────────────────── */
.sidebar-nav {
  flex: 1;
  padding: 0.75rem 0.625rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

/* ── Accordion ───────────────────────────────────── */
.accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
  border-radius: 0.375rem;
  font-size: var(--fs-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--track-caps);
  color: var(--c-888888);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 120ms, color 120ms;
  text-align: left;
}
.accordion-header:hover {
  background: var(--c-161616);
  color: var(--c-c0c0c0);
}
.accordion-header--active {
  color: var(--c-c0c0c0);
}

.accordion-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.active-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--c-ffffff);
  flex-shrink: 0;
}

.chevron {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  transition: transform 180ms ease;
}
.chevron--open {
  transform: rotate(180deg);
}

.accordion-body {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

/* ── Nav items ───────────────────────────────────── */
.nav-icon { width: 1rem; height: 1rem; flex-shrink: 0; opacity: 0.8; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: var(--fs-sm);
  font-weight: 500;
  line-height: var(--lh-ui);
  color: var(--c-aaaaaa);
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
  background: var(--c-1a1a1a);
  color: var(--c-e2e8f0);
}
.nav-item--active {
  background: var(--c-1f1f1f) !important;
  color: var(--c-ffffff) !important;
  font-weight: 600;
  box-shadow: inset 2px 0 0 var(--c-ffffff) !important;
}
.nav-item--active .nav-icon,
.nav-item:hover .nav-icon { opacity: 1; }

/* ── Footer ──────────────────────────────────────── */
.sidebar-footer {
  padding: 0.625rem 0.625rem;
  border-top: 1px solid var(--c-222222);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
}
.user-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  background: var(--c-2a2a2a);
  color: var(--c-e2e8f0);
  font-size: var(--fs-2xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}
.user-info { min-width: 0; flex: 1; }
.user-name {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-e2e8f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role {
  font-size: var(--fs-2xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--c-888888);
}

.btn-signout {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-aaaaaa);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 120ms, color 120ms;
  text-align: left;
}
.btn-signout:hover { background: var(--c-1a0a0a); color: var(--c-f87171); }

/* ── Main ────────────────────────────────────────── */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.main-content-body {
  flex: 1;
  width: 100%;
  /* Tables and forms stop stretching at ultrawide widths; the gutter the
     view adds (p-8) keeps the content off the sidebar's edge. */
  max-width: 96rem;
}

.admin-shell--fill .main-content { height: 100vh; overflow: hidden; }
.admin-shell--fill .main-content-body { min-height: 0; }
/* A printed rider runs past one page; the viewport clamp would cut it off. */
@media print {
  .admin-shell--fill .main-content { height: auto; overflow: visible; }
}

/* ── Drawer layout below lg ──────────────────────── */
@media (max-width: 1023px) {
  .admin-shell { --admin-topbar-h: 3.25rem; }
  .topbar { display: flex; }
  .scrim { display: block; }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 50;
    width: min(18rem, 86vw);
    transform: translateX(-100%);
    /* Off-screen is not hidden: without visibility the closed drawer's links
       stay in the tab order. The delay lets the slide-out finish first. */
    visibility: hidden;
    transition: transform 220ms cubic-bezier(0.2, 0, 0, 1), visibility 0s linear 220ms;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  }
  .admin-shell--menu-open .sidebar {
    transform: none;
    visibility: visible;
    transition: transform 220ms cubic-bezier(0.2, 0, 0, 1);
  }
  .main-content { padding-top: var(--admin-topbar-h); }
}
@media (prefers-reduced-motion: reduce) {
  .sidebar, .chevron { transition: none; }
}
</style>
