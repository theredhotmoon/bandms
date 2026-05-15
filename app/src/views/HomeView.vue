<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { isLoggedIn, user } = useAuth()

const sections = [
  {
    to: '/concerts',
    label: 'Concerts',
    description: 'Browse upcoming and past live shows',
    color: '#fb923c',
    svg: 'M8 2v4M16 2v4M3 10h18M5 4H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2h-2',
  },
  {
    to: '/bands',
    label: 'Bands',
    description: 'Discover artists and their discographies',
    color: '#818cf8',
    svg: 'M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3',
  },
  {
    to: '/venues',
    label: 'Venues',
    description: 'Explore concert halls and club locations',
    color: '#34d399',
    svg: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    to: '/posts',
    label: 'Posts',
    description: 'News, interviews and scene reports',
    color: '#60a5fa',
    svg: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    to: '/photos',
    label: 'Photos',
    description: 'Concert photography and galleries',
    color: '#f472b6',
    svg: 'M3 3h18a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2zm4.5 5.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm10.5 7l-4-5-4 4-2-2-3 3',
  },
  {
    to: '/categories',
    label: 'Categories',
    description: 'Browse content by genre and type',
    color: '#a78bfa',
    svg: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  },
  {
    to: '/tags',
    label: 'Tags',
    description: 'Filter and discover by topic tags',
    color: '#22d3ee',
    svg: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
  },
]

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})
</script>

<template>
  <div class="home">
    <!-- Hero -->
    <header class="hero">
      <div class="hero-inner">
        <p class="hero-eyebrow">BandMS</p>
        <h1 class="hero-title">
          <template v-if="isLoggedIn">
            {{ greeting }}<span v-if="user">, {{ user.first_name }}</span>
          </template>
          <template v-else>Your music scene,<br>all in one place.</template>
        </h1>
        <p class="hero-sub">
          <template v-if="isLoggedIn">Manage bands, concerts, venues and content from one place.</template>
          <template v-else>Browse concerts, artists and venues — or sign in to manage content.</template>
        </p>
        <div v-if="!isLoggedIn" class="hero-cta">
          <RouterLink to="/login" class="cta-primary">Sign in</RouterLink>
          <RouterLink to="/concerts" class="cta-secondary">Explore concerts</RouterLink>
        </div>
        <div v-else class="hero-cta">
          <RouterLink to="/admin" class="cta-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Admin Panel
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- Section cards -->
    <section class="sections-wrap">
      <h2 class="section-heading">Explore</h2>
      <div class="sections-grid">
        <RouterLink
          v-for="s in sections"
          :key="s.to"
          :to="s.to"
          class="section-card"
        >
          <div class="card-icon-wrap" :style="`background: ${s.color}18; border-color: ${s.color}30;`">
            <svg
              class="card-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              :style="`color: ${s.color};`"
            >
              <path :d="s.svg" />
            </svg>
          </div>
          <div class="card-body">
            <div class="card-label">{{ s.label }}</div>
            <div class="card-desc">{{ s.description }}</div>
          </div>
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </RouterLink>
      </div>
    </section>

    <!-- Admin quick-actions (logged-in only) -->
    <section v-if="isLoggedIn" class="qa-wrap">
      <h2 class="section-heading">Quick actions</h2>
      <div class="qa-grid">
        <RouterLink to="/admin/bands"    class="qa-btn">+ Band</RouterLink>
        <RouterLink to="/admin/venues"   class="qa-btn">+ Venue</RouterLink>
        <RouterLink to="/admin/concerts" class="qa-btn">+ Concert</RouterLink>
        <RouterLink to="/admin/posts"    class="qa-btn">+ Post</RouterLink>
        <RouterLink to="/admin/photos"   class="qa-btn">+ Photo</RouterLink>
        <RouterLink to="/admin/releases" class="qa-btn">+ Release</RouterLink>
        <RouterLink to="/admin/tours"    class="qa-btn">+ Tour</RouterLink>
        <RouterLink to="/admin/categories" class="qa-btn">+ Category</RouterLink>
        <RouterLink to="/admin/tags"     class="qa-btn">+ Tag</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Page shell ───────────────────────────────────────────── */
.home {
  min-height: calc(100vh - 56px);
  background: #08081a;
  color: #e2e8f0;
}

/* ── Hero ─────────────────────────────────────────────────── */
.hero {
  padding: 4rem 1.5rem 3rem;
  background: linear-gradient(180deg, #0d0d22 0%, #08081a 100%);
  border-bottom: 1px solid #1e1b4b;
}
.hero-inner { max-width: 640px; margin: 0 auto; }

.hero-eyebrow {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #6366f1; margin-bottom: 0.75rem;
}
.hero-title {
  font-size: clamp(1.75rem, 5vw, 2.75rem);
  font-weight: 700; line-height: 1.2;
  color: #f1f5f9; margin-bottom: 1rem;
}
.hero-sub   { font-size: 1rem; color: #64748b; line-height: 1.6; margin-bottom: 1.75rem; }

.hero-cta   { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.cta-primary {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.625rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 600;
  background: #4338ca; color: #fff; text-decoration: none;
  transition: background 150ms;
}
.cta-primary:hover  { background: #5046e4; }
.cta-secondary {
  display: inline-flex; align-items: center;
  padding: 0.625rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 500;
  background: transparent; color: #94a3b8;
  text-decoration: none; border: 1px solid #2d2a6e;
  transition: background 150ms, color 150ms;
}
.cta-secondary:hover { background: #161630; color: #c7d2fe; }

/* ── Section cards ────────────────────────────────────────── */
.sections-wrap { padding: 2.5rem 1.5rem; max-width: 960px; margin: 0 auto; }
.section-heading {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: #475569; margin-bottom: 1.25rem;
}

.sections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.section-card {
  display: flex; align-items: center; gap: 0.875rem;
  padding: 1rem 1rem 1rem 0.875rem; border-radius: 0.75rem;
  text-decoration: none;
  background: #111128; border: 1px solid #2d2a6e;
  transition: background 150ms, border-color 150ms, transform 150ms;
  cursor: pointer;
}
.section-card:hover {
  background: #151535; border-color: #4338ca;
  transform: translateY(-1px);
}

.card-icon-wrap {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 0.5rem;
  border: 1px solid; flex-shrink: 0;
}
.card-icon { width: 18px; height: 18px; }

.card-body  { flex: 1; min-width: 0; }
.card-label { font-size: 0.9375rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.125rem; }
.card-desc  { font-size: 0.75rem; color: #64748b; line-height: 1.4; }

.card-arrow { width: 16px; height: 16px; color: #475569; flex-shrink: 0; }
.section-card:hover .card-arrow { color: #818cf8; }

/* ── Quick actions ────────────────────────────────────────── */
.qa-wrap { padding: 0 1.5rem 3rem; max-width: 960px; margin: 0 auto; }
.qa-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.qa-btn {
  padding: 0.4rem 1rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #1e1b4b; color: #a5b4fc;
  text-decoration: none; border: 1px solid #312e81;
  transition: background 120ms;
}
.qa-btn:hover { background: #2d2a6e; }
</style>
