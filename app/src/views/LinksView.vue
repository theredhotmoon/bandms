<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchBandProfile } from '@/api/bandProfile'
import { fetchReleases } from '@/api/releases'
import { useLang } from '@/composables/useLang'

const { lang } = useLang()

const profileQk = computed(() => ['band-profile', lang.value])
const releasesQk = computed(() => ['releases', lang.value])

const profileQuery = useQuery({ queryKey: profileQk, queryFn: () => fetchBandProfile(lang.value) })
const releasesQuery = useQuery({ queryKey: releasesQk, queryFn: () => fetchReleases(lang.value) })

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
  background: #fff; min-height: 100vh;
  display: flex; align-items: flex-start; justify-content: center;
  padding: 3rem 1rem 5rem;
}
.loading { color: #888; font-size: 0.875rem; padding: 4rem; }
.links-wrap { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 2rem; }

.links-header { text-align: center; }
.links-name { font-size: 2rem; font-weight: 800; color: #111; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
.links-bio { font-size: 0.875rem; color: #555; line-height: 1.6; margin: 0; }

.links-section { display: flex; flex-direction: column; gap: 0.625rem; }
.section-label {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #888; margin-bottom: 0.25rem;
}

/* Releases */
.releases-list { display: flex; flex-direction: column; gap: 0.5rem; }
.release-row {
  display: flex; align-items: center; gap: 0.75rem;
  background: #fafafa; border: 1px solid #e0e0e0; border-radius: 0.5rem; padding: 0.625rem 0.875rem;
}
.release-thumb {
  width: 2.75rem; height: 2.75rem; border-radius: 0.25rem; object-fit: cover; flex-shrink: 0; background: #e0e0e0;
}
.release-thumb--empty { background: #f0f0f0; }
.release-info { flex: 1; min-width: 0; }
.release-title { font-size: 0.875rem; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.release-meta { font-size: 0.7rem; color: #888; margin-top: 0.125rem; }
.upcoming-tag { color: #333; font-weight: 600; }
.link-btn {
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
  text-decoration: none; flex-shrink: 0; transition: background 120ms;
}
.link-btn--presave {
  background: #111; color: #fff; border: none;
}
.link-btn--presave:hover { background: #333; }

/* Social buttons */
.social-list { display: flex; flex-direction: column; gap: 0.5rem; }
.social-btn {
  display: flex; align-items: center; gap: 0.75rem;
  background: #fafafa; border: 1px solid #e0e0e0; border-radius: 0.5rem;
  padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 600; color: #111;
  text-decoration: none; transition: border-color 150ms, background 150ms;
}
.social-btn:hover { background: #f0f0f0; border-color: #bbb; }
.social-dot {
  width: 0.5rem; height: 0.5rem; border-radius: 9999px;
  background: #333; flex-shrink: 0;
}

.epk-link {
  text-align: center; font-size: 0.8125rem; color: #888; text-decoration: none;
  transition: color 150ms; padding: 0.5rem 0;
}
.epk-link:hover { color: #333; }
</style>
