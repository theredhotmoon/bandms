<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import NewsletterSignup from '@/components/NewsletterSignup.vue'

const { isLoggedIn, user } = useAuth()

const sections = [
  {
    to: '/about',
    label: 'About',
    description: 'Band bio, background and story',
    svg: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm11 0v2m0 4v2m2-4h-4',
  },
  {
    to: '/concerts',
    label: 'Concerts',
    description: 'Browse upcoming and past live shows',
    svg: 'M8 2v4M16 2v4M3 10h18M5 4H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2h-2',
  },
  {
    to: '/releases',
    label: 'Releases',
    description: 'Albums, EPs, singles and more',
    svg: 'M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3',
  },
  {
    to: '/videos',
    label: 'Videos',
    description: 'Official music videos and live clips',
    svg: 'M23 7l-7 5 7 5V7zM1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1a2 2 0 01-2-2V7a2 2 0 012-2z',
  },
  {
    to: '/booking',
    label: 'Booking',
    description: 'Check availability and book the band',
    svg: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
  {
    to: '/posts',
    label: 'Posts',
    description: 'News, interviews and scene reports',
    svg: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    to: '/photos',
    label: 'Photos',
    description: 'Concert photography and galleries',
    svg: 'M3 3h18a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2zm4.5 5.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm10.5 7l-4-5-4 4-2-2-3 3',
  },
  {
    to: '/tags',
    label: 'Tags',
    description: 'Filter and discover by topic tags',
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
          <div class="card-icon-wrap">
            <svg
              class="card-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
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

    <!-- Newsletter signup (public only) -->
    <section v-if="!isLoggedIn" class="nl-section">
      <NewsletterSignup source="home" />
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
        <RouterLink to="/admin/tags"     class="qa-btn">+ Tag</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Page shell ───────────────────────────────────────────── */
.home {
  min-height: calc(100vh - 56px);
  background: #fff;
  color: #111;
}

/* ── Hero ─────────────────────────────────────────────────── */
.hero {
  padding: 4rem 1.5rem 3rem;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}
.hero-inner { max-width: 640px; margin: 0 auto; }

.hero-eyebrow {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}
.hero-title {
  font-size: clamp(1.75rem, 5vw, 2.75rem);
  font-weight: 700; line-height: 1.2;
  color: #111; margin-bottom: 1rem;
}
.hero-sub   { font-size: 1rem; color: #555; line-height: 1.6; margin-bottom: 1.75rem; }

.hero-cta   { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.cta-primary {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.625rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 600;
  background: #111; color: #fff; text-decoration: none;
  transition: background 150ms;
}
.cta-primary:hover  { background: #333; }
.cta-secondary {
  display: inline-flex; align-items: center;
  padding: 0.625rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.9375rem; font-weight: 500;
  background: transparent; color: #555;
  text-decoration: none; border: 1px solid #ddd;
  transition: background 150ms, color 150ms;
}
.cta-secondary:hover { background: #f5f5f5; color: #111; }

/* ── Section cards ────────────────────────────────────────── */
.sections-wrap { padding: 2.5rem 1.5rem; max-width: 960px; margin: 0 auto; }
.section-heading {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: #888; margin-bottom: 1.25rem;
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
  background: #fff; border: 1px solid #e0e0e0;
  transition: background 150ms, border-color 150ms, transform 150ms;
  cursor: pointer;
}
.section-card:hover {
  background: #f5f5f5; border-color: #bbb;
  transform: translateY(-1px);
}

.card-icon-wrap {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 0.5rem;
  background: #f0f0f0; border: 1px solid #e0e0e0; flex-shrink: 0;
}
.card-icon { width: 18px; height: 18px; color: #555; }

.card-body  { flex: 1; min-width: 0; }
.card-label { font-size: 0.9375rem; font-weight: 600; color: #111; margin-bottom: 0.125rem; }
.card-desc  { font-size: 0.75rem; color: #888; line-height: 1.4; }

.card-arrow { width: 16px; height: 16px; color: #bbb; flex-shrink: 0; }
.section-card:hover .card-arrow { color: #555; }

/* ── Newsletter ───────────────────────────────────────────── */
.nl-section { padding: 0 1.5rem 3rem; max-width: 960px; margin: 0 auto; }

/* ── Quick actions ────────────────────────────────────────── */
.qa-wrap { padding: 0 1.5rem 3rem; max-width: 960px; margin: 0 auto; }
.qa-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.qa-btn {
  padding: 0.4rem 1rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #f0f0f0; color: #333;
  text-decoration: none; border: 1px solid #ddd;
  transition: background 120ms;
}
.qa-btn:hover { background: #e0e0e0; }
</style>
