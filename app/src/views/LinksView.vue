<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { fetchBandProfile } from '@/api/bandProfile'
import { fetchReleases } from '@/api/releases'

const profileQuery = useQuery({ queryKey: ['band-profile'], queryFn: fetchBandProfile })
const releasesQuery = useQuery({ queryKey: ['releases'], queryFn: fetchReleases })

const platformColors: Record<string, string> = {
  spotify:     '#1db954',
  apple_music: '#fc3c44',
  bandcamp:    '#1da0c3',
  youtube:     '#ff0000',
  instagram:   '#e1306c',
  tiktok:      '#69c9d0',
  facebook:    '#1877f2',
  twitter:     '#1da1f2',
  website:     '#94a3b8',
}

const platformLabels: Record<string, string> = {
  spotify:     'Spotify',
  apple_music: 'Apple Music',
  bandcamp:    'Bandcamp',
  youtube:     'YouTube',
  instagram:   'Instagram',
  tiktok:      'TikTok',
  facebook:    'Facebook',
  twitter:     'Twitter / X',
  website:     'Website',
}
</script>

<template>
  <div class="links-page">
    <div v-if="profileQuery.isPending.value" class="loading">Loading…</div>

    <template v-else-if="profileQuery.data.value">
      <div class="links-wrap">

        <!-- Artist header -->
        <header class="links-header">
          <h1 class="links-name">{{ profileQuery.data.value.name }}</h1>
          <p v-if="profileQuery.data.value.bio_short" class="links-bio">
            {{ profileQuery.data.value.bio_short }}
          </p>
        </header>

        <!-- Latest releases -->
        <section v-if="releasesQuery.data.value?.length" class="links-section">
          <div class="section-label">Latest releases</div>
          <div class="releases-list">
            <div
              v-for="r in releasesQuery.data.value.slice(0, 3)"
              :key="r.id"
              class="release-row"
            >
              <img v-if="r.cover_image" :src="r.cover_image" class="release-thumb" alt="" />
              <div v-else class="release-thumb release-thumb--empty" />
              <div class="release-info">
                <div class="release-title">{{ r.title }}</div>
                <div class="release-meta">{{ r.type.toUpperCase() }}
                  <template v-if="r.release_date"> · {{ r.release_date.slice(0, 4) }}</template>
                  <template v-if="r.is_upcoming"> · <span class="upcoming-tag">Pre-save</span></template>
                </div>
              </div>
              <a
                v-if="r.is_upcoming && r.presave_url"
                :href="r.presave_url"
                target="_blank"
                rel="noopener noreferrer"
                class="link-btn link-btn--presave"
              >Pre-save</a>
            </div>
          </div>
        </section>

        <!-- Social / streaming links -->
        <section v-if="profileQuery.data.value.social_links?.length" class="links-section">
          <div class="section-label">Follow &amp; listen</div>
          <div class="social-list">
            <a
              v-for="l in profileQuery.data.value.social_links"
              :key="l.id"
              :href="l.url"
              target="_blank"
              rel="noopener noreferrer"
              class="social-btn"
              :style="`--platform-color: ${platformColors[l.platform] ?? '#6366f1'}`"
            >
              <span class="social-dot" />
              {{ platformLabels[l.platform] || l.platform }}
            </a>
          </div>
        </section>

        <!-- EPK link -->
        <a href="/epk" class="epk-link">View full Electronic Press Kit →</a>

      </div>
    </template>
  </div>
</template>

<style scoped>
.links-page {
  background: #08081a; min-height: 100vh;
  display: flex; align-items: flex-start; justify-content: center;
  padding: 3rem 1rem 5rem;
}
.loading { color: #475569; font-size: 0.875rem; padding: 4rem; }
.links-wrap { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 2rem; }

.links-header { text-align: center; }
.links-name { font-size: 2rem; font-weight: 800; color: #e2e8f0; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
.links-bio { font-size: 0.875rem; color: #64748b; line-height: 1.6; margin: 0; }

.links-section { display: flex; flex-direction: column; gap: 0.625rem; }
.section-label {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #334155; margin-bottom: 0.25rem;
}

/* Releases */
.releases-list { display: flex; flex-direction: column; gap: 0.5rem; }
.release-row {
  display: flex; align-items: center; gap: 0.75rem;
  background: #0d0d22; border: 1px solid #1a1a38; border-radius: 0.5rem; padding: 0.625rem 0.875rem;
}
.release-thumb {
  width: 2.75rem; height: 2.75rem; border-radius: 0.25rem; object-fit: cover; flex-shrink: 0; background: #1a1a38;
}
.release-thumb--empty { background: #111128; }
.release-info { flex: 1; min-width: 0; }
.release-title { font-size: 0.875rem; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.release-meta { font-size: 0.7rem; color: #475569; margin-top: 0.125rem; }
.upcoming-tag { color: #34d399; font-weight: 600; }
.link-btn {
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
  text-decoration: none; flex-shrink: 0; transition: background 120ms;
}
.link-btn--presave {
  background: #4f46e5; color: #fff; border: none;
}
.link-btn--presave:hover { background: #4338ca; }

/* Social buttons */
.social-list { display: flex; flex-direction: column; gap: 0.5rem; }
.social-btn {
  display: flex; align-items: center; gap: 0.75rem;
  background: #0d0d22; border: 1px solid #1a1a38; border-radius: 0.5rem;
  padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 600; color: #e2e8f0;
  text-decoration: none; transition: border-color 150ms, background 150ms;
}
.social-btn:hover { background: #111128; border-color: var(--platform-color, #6366f1); }
.social-dot {
  width: 0.5rem; height: 0.5rem; border-radius: 9999px;
  background: var(--platform-color, #6366f1); flex-shrink: 0;
}

.epk-link {
  text-align: center; font-size: 0.8125rem; color: #475569; text-decoration: none;
  transition: color 150ms; padding: 0.5rem 0;
}
.epk-link:hover { color: #818cf8; }
</style>
