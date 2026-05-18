<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { fetchEpk } from '@/api/bandProfile'

const query = useQuery({ queryKey: ['epk'], queryFn: fetchEpk })

function formatStat(n: number | null): string {
  if (n == null) return ''
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString()
}

function genreList(genres: string | null): string[] {
  if (!genres) return []
  return genres.split(',').map((g) => g.trim()).filter(Boolean)
}

function printPage() { window.print() }
</script>

<template>
  <div class="onesheet-page">
    <div v-if="query.isPending.value" class="loading">Loading…</div>
    <div v-else-if="query.isError.value" class="error">Failed to load.</div>

    <template v-else-if="query.data.value">
      <div class="print-toolbar no-print">
        <button @click="printPage" class="print-btn">Print / Save as PDF</button>
        <a href="/epk" class="back-link">← Full EPK</a>
      </div>

      <div class="onesheet">
        <!-- Header block -->
        <div class="os-header">
          <div class="os-header-text">
            <h1 class="os-name">{{ query.data.value.name }}</h1>
            <div class="os-genres">
              <span v-for="g in genreList(query.data.value.genres)" :key="g" class="genre-tag">{{ g }}</span>
            </div>
            <p v-if="query.data.value.hometown || query.data.value.formation_year" class="os-origin">
              {{ query.data.value.hometown }}<template v-if="query.data.value.hometown && query.data.value.formation_year"> · </template>
              Est. {{ query.data.value.formation_year }}
            </p>
            <p v-if="query.data.value.comparable_artists" class="os-comparable">
              For fans of {{ query.data.value.comparable_artists }}
            </p>
          </div>
          <img
            v-if="query.data.value.featured_release?.cover_image"
            :src="query.data.value.featured_release.cover_image"
            class="os-cover"
            alt=""
          />
        </div>

        <!-- Bio -->
        <div class="os-bio" v-html="query.data.value.bio_medium ?? query.data.value.bio_short ?? ''" />

        <!-- Stats row -->
        <div class="os-stats-row" v-if="query.data.value.stat_spotify_monthly || query.data.value.stat_instagram_followers">
          <div v-if="query.data.value.stat_spotify_monthly" class="os-stat">
            <span class="os-stat-val">{{ formatStat(query.data.value.stat_spotify_monthly) }}</span>
            <span class="os-stat-label">Spotify monthly</span>
          </div>
          <div v-if="query.data.value.stat_instagram_followers" class="os-stat">
            <span class="os-stat-val">{{ formatStat(query.data.value.stat_instagram_followers) }}</span>
            <span class="os-stat-label">Instagram</span>
          </div>
          <div v-if="query.data.value.stat_tiktok_followers" class="os-stat">
            <span class="os-stat-val">{{ formatStat(query.data.value.stat_tiktok_followers) }}</span>
            <span class="os-stat-label">TikTok</span>
          </div>
          <div v-if="query.data.value.stat_youtube_subscribers" class="os-stat">
            <span class="os-stat-val">{{ formatStat(query.data.value.stat_youtube_subscribers) }}</span>
            <span class="os-stat-label">YouTube</span>
          </div>
        </div>

        <!-- Featured release -->
        <div v-if="query.data.value.featured_release" class="os-release">
          <div class="os-section-label">Latest Release</div>
          <div class="os-release-info">
            <strong>{{ query.data.value.featured_release.title }}</strong>
            <span class="os-release-type">{{ query.data.value.featured_release.type.toUpperCase() }}</span>
            <template v-if="query.data.value.featured_release.release_date">
              · {{ query.data.value.featured_release.release_date.slice(0, 4) }}
            </template>
          </div>
          <ul v-if="query.data.value.featured_release.tracks.length" class="os-tracklist">
            <li v-for="t in query.data.value.featured_release.tracks" :key="t.id">
              {{ t.sort_order + 1 }}. {{ t.title }}<template v-if="t.duration"> · {{ t.duration }}</template>
            </li>
          </ul>
        </div>

        <!-- Upcoming shows -->
        <div v-if="query.data.value.upcoming_concerts.length" class="os-concerts">
          <div class="os-section-label">Upcoming Shows</div>
          <div v-for="c in query.data.value.upcoming_concerts.slice(0, 4)" :key="c.id" class="os-concert-row">
            <span class="os-concert-date">{{ c.date }}</span>
            <span class="os-concert-venue">
              <template v-if="c.venue">{{ c.venue.name }}, {{ c.venue.city }}</template>
              <template v-else>TBC</template>
            </span>
          </div>
        </div>

        <!-- Contact footer -->
        <div class="os-footer">
          <div v-if="query.data.value.booking_email" class="os-contact">
            <span class="os-contact-role">Booking</span>
            {{ query.data.value.booking_email }}
          </div>
          <div v-if="query.data.value.press_email" class="os-contact">
            <span class="os-contact-role">Press</span>
            {{ query.data.value.press_email }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.onesheet-page { background: #f8fafc; min-height: 100vh; padding: 2rem 1rem; }
.loading, .error { text-align: center; padding: 4rem; color: #64748b; }

.print-toolbar {
  max-width: 680px; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: space-between;
}
.print-btn {
  padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 600;
  background: #111; color: #fff; border: none; cursor: pointer;
}
.print-btn:hover { background: #333; }
.back-link { font-size: 0.8125rem; color: #64748b; text-decoration: none; }
.back-link:hover { color: #334155; }

/* One-sheet document */
.onesheet {
  max-width: 680px; margin: 0 auto; background: #fff;
  border-radius: 0.75rem; padding: 2.5rem 2.75rem; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  font-family: Georgia, 'Times New Roman', serif;
  color: #1e293b;
}

.os-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid #1e293b; padding-bottom: 1.25rem; }
.os-header-text { flex: 1; }
.os-name { font-size: 2rem; font-weight: 700; margin: 0 0 0.375rem; letter-spacing: -0.02em; }
.os-genres { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.375rem; }
.genre-tag { font-family: system-ui, sans-serif; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; background: #f0f0f0; color: #555; padding: 0.15rem 0.5rem; border-radius: 0.25rem; }
.os-origin     { font-size: 0.875rem; color: #64748b; margin: 0 0 0.25rem; font-family: system-ui, sans-serif; }
.os-comparable { font-size: 0.8125rem; color: #94a3b8; margin: 0; font-style: italic; font-family: system-ui, sans-serif; }
.os-cover { width: 90px; height: 90px; border-radius: 0.25rem; object-fit: cover; flex-shrink: 0; }

.os-bio { font-size: 0.9375rem; line-height: 1.75; color: #334155; margin-bottom: 1.25rem; }
.os-bio :deep(p) { margin: 0 0 0.5rem; }

.os-stats-row { display: flex; gap: 2rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.875rem 1.25rem; margin-bottom: 1.25rem; }
.os-stat { display: flex; flex-direction: column; }
.os-stat-val   { font-family: system-ui, sans-serif; font-size: 1.25rem; font-weight: 700; color: #1e293b; }
.os-stat-label { font-family: system-ui, sans-serif; font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }

.os-section-label { font-family: system-ui, sans-serif; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 0.375rem; }
.os-release { margin-bottom: 1.25rem; }
.os-release-info { font-size: 0.9375rem; margin-bottom: 0.375rem; }
.os-release-type { font-family: system-ui, sans-serif; font-size: 0.75rem; font-weight: 600; color: #64748b; margin-left: 0.375rem; }
.os-tracklist { font-size: 0.875rem; color: #64748b; padding-left: 1.25rem; margin: 0; line-height: 1.8; }

.os-concerts { margin-bottom: 1.25rem; }
.os-concert-row { display: flex; gap: 1.5rem; font-size: 0.875rem; padding: 0.25rem 0; border-bottom: 1px solid #f1f5f9; }
.os-concert-date { font-family: system-ui, sans-serif; font-weight: 600; color: #1e293b; min-width: 6rem; }
.os-concert-venue { color: #64748b; }

.os-footer { display: flex; gap: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-top: 0.5rem; }
.os-contact { font-size: 0.875rem; font-family: system-ui, sans-serif; color: #334155; }
.os-contact-role { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: block; margin-bottom: 0.125rem; }

@media print {
  .no-print { display: none !important; }
  .onesheet-page { padding: 0; background: #fff; }
  .onesheet { box-shadow: none; border-radius: 0; max-width: 100%; padding: 1.5cm 2cm; }
}
</style>
