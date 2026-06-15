<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchEpk } from '@/api/bandProfile'
import { useLang } from '@/composables/useLang'

const { lang } = useLang()
const epkQk = computed(() => ['epk', lang.value])
const query = useQuery({ queryKey: epkQk, queryFn: () => fetchEpk(lang.value) })

function formatStat(n: number | null): string {
  if (n == null) return ''
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString()
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatConcertDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function genreList(genres: string | null): string[] {
  if (!genres) return []
  return genres.split(',').map((g) => g.trim()).filter(Boolean)
}

const platformIcons: Record<string, string> = {
  spotify:     'Spotify',
  apple_music: 'Apple Music',
  bandcamp:    'Bandcamp',
  youtube:     'YouTube',
  instagram:   'Instagram',
}

const socialIconMap: Record<string, string> = {
  instagram: 'IG',
  tiktok:    'TK',
  facebook:  'FB',
  twitter:   'TW',
  youtube:   'YT',
  spotify:   'SP',
  bandcamp:  'BC',
  website:   '🌐',
}

function embedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
  return url
}
</script>

<template>
  <div class="epk-page">
    <div v-if="query.isPending.value" class="epk-loading">Loading…</div>
    <div v-else-if="query.isError.value" class="epk-error">Failed to load EPK.</div>

    <template v-else-if="query.data.value">
      <div class="epk-wrap" :data-epk="true">

        <!-- ── HEADER ───────────────────────────────────────── -->
        <header class="epk-header">
          <div class="epk-header-text">
            <img
              v-if="query.data.value.logo_url"
              :src="query.data.value.logo_url"
              alt="Band logo"
              class="epk-logo"
            />
            <h1 class="epk-name">{{ query.data.value.name }}</h1>
            <div class="epk-meta-row">
              <div v-if="query.data.value.genres" class="epk-genres">
                <span v-for="g in genreList(query.data.value.genres)" :key="g" class="genre-badge">{{ g }}</span>
              </div>
              <span v-if="query.data.value.hometown" class="epk-meta-item">
                📍 {{ query.data.value.hometown }}
              </span>
              <span v-if="query.data.value.formation_year" class="epk-meta-item">
                Est. {{ query.data.value.formation_year }}
              </span>
            </div>
            <p v-if="query.data.value.comparable_artists" class="epk-comparable">
              For fans of {{ query.data.value.comparable_artists }}
            </p>
          </div>
          <div class="epk-social-row">
            <a v-for="l in query.data.value.social_links" :key="l.platform"
              :href="l.url" target="_blank" rel="noopener noreferrer" class="social-pill">
              {{ l.label || socialIconMap[l.platform] || l.platform }}
            </a>
          </div>
        </header>

        <!-- ── HERO PHOTO ────────────────────────────────────── -->
        <div v-if="query.data.value.press_photos?.length" class="epk-hero">
          <img :src="query.data.value.press_photos[0].image_url ?? ''" alt="" class="epk-hero-img" />
        </div>

        <!-- ── BIO + STATS ───────────────────────────────────── -->
        <div class="epk-two-col">
          <div class="epk-bio-block">
            <div class="epk-section-label">About</div>
            <div class="epk-bio" v-html="query.data.value.bio_long ?? query.data.value.bio_medium ?? query.data.value.bio_short ?? ''" />
          </div>

          <div class="epk-stats-block">
            <div class="epk-section-label">Numbers</div>
            <div class="epk-stats">
              <div v-if="query.data.value.stat_spotify_monthly" class="stat-row">
                <span class="stat-value">{{ formatStat(query.data.value.stat_spotify_monthly) }}</span>
                <span class="stat-label">Spotify monthly</span>
              </div>
              <div v-if="query.data.value.stat_instagram_followers" class="stat-row">
                <span class="stat-value">{{ formatStat(query.data.value.stat_instagram_followers) }}</span>
                <span class="stat-label">Instagram</span>
              </div>
              <div v-if="query.data.value.stat_tiktok_followers" class="stat-row">
                <span class="stat-value">{{ formatStat(query.data.value.stat_tiktok_followers) }}</span>
                <span class="stat-label">TikTok</span>
              </div>
              <div v-if="query.data.value.stat_youtube_subscribers" class="stat-row">
                <span class="stat-value">{{ formatStat(query.data.value.stat_youtube_subscribers) }}</span>
                <span class="stat-label">YouTube</span>
              </div>
              <div v-if="query.data.value.stat_facebook_followers" class="stat-row">
                <span class="stat-value">{{ formatStat(query.data.value.stat_facebook_followers) }}</span>
                <span class="stat-label">Facebook</span>
              </div>
              <div v-if="!query.data.value.stat_spotify_monthly && !query.data.value.stat_instagram_followers" class="stat-empty">
                Stats not yet added.
              </div>
            </div>
          </div>
        </div>

        <!-- ── FEATURED RELEASE ──────────────────────────────── -->
        <section v-if="query.data.value.featured_release" class="epk-section">
          <div class="epk-section-label">Latest Release</div>
          <div class="release-card">
            <img v-if="query.data.value.featured_release.cover_image"
              :src="query.data.value.featured_release.cover_image"
              class="release-cover" alt="" />
            <div class="release-info">
              <div class="release-title">{{ query.data.value.featured_release.title }}</div>
              <div class="release-meta">
                {{ query.data.value.featured_release.type.toUpperCase() }}
                <template v-if="query.data.value.featured_release.release_date">
                  · {{ query.data.value.featured_release.release_date.slice(0, 4) }}
                </template>
              </div>
              <div v-if="query.data.value.featured_release.description" class="release-desc" v-html="query.data.value.featured_release.description" />
              <div class="release-links">
                <a v-for="l in query.data.value.featured_release.links" :key="l.platform"
                  :href="l.url" target="_blank" rel="noopener noreferrer" class="stream-btn">
                  {{ platformIcons[l.platform] ?? l.platform }}
                </a>
              </div>
            </div>
          </div>
        </section>

        <!-- ── PRESS COVERAGE ────────────────────────────────── -->
        <section v-if="query.data.value.press_articles.length" class="epk-section">
          <div class="epk-section-label">In the Press</div>
          <div class="press-grid">
            <a v-for="pr in query.data.value.press_articles" :key="pr.id"
              :href="pr.url" target="_blank" rel="noopener noreferrer" class="press-card">
              <img v-if="pr.og_image" :src="pr.og_image" class="press-thumb" alt=""
                @error="($event.target as HTMLImageElement).style.display='none'" />
              <div class="press-body">
                <div class="press-source">{{ pr.og_site_name ?? '' }}</div>
                <div class="press-title">{{ pr.og_title ?? pr.url }}</div>
                <div v-if="pr.published_at" class="press-date">{{ formatDate(pr.published_at) }}</div>
              </div>
            </a>
          </div>
        </section>

        <!-- ── PRESS PHOTOS ──────────────────────────────────── -->
        <section v-if="query.data.value.press_photos?.length" class="epk-section">
          <div class="epk-section-label">Press Photos</div>
          <p class="press-photos-hint">Click any photo to download the full resolution image.</p>
          <div class="photos-grid">
            <a v-for="p in query.data.value.press_photos" :key="p.id"
              :href="p.image_url ?? ''" target="_blank" rel="noopener noreferrer"
              class="photo-item" :title="p.caption ?? ''">
              <img :src="p.image_url ?? ''" :alt="p.caption ?? ''" class="photo-thumb"
                @error="($event.target as HTMLImageElement).parentElement!.style.display='none'" />
              <div class="photo-overlay">↓</div>
            </a>
          </div>
        </section>

        <!-- ── MUSIC VIDEOS ─────────────────────────────────── -->
        <section v-if="query.data.value.music_videos.length" class="epk-section">
          <div class="epk-section-label">Music Videos</div>
          <div class="videos-grid">
            <div v-for="v in query.data.value.music_videos" :key="v.id" class="video-item">
              <div class="video-embed">
                <iframe :src="embedUrl(v.video_url)" allowfullscreen frameborder="0" loading="lazy" :title="v.title" />
              </div>
              <div class="video-title">{{ v.title }}</div>
            </div>
          </div>
        </section>

        <!-- ── UPCOMING SHOWS ────────────────────────────────── -->
        <section v-if="query.data.value.upcoming_concerts.length" class="epk-section">
          <div class="epk-section-label">Live</div>
          <div class="concerts-list">
            <div v-for="c in query.data.value.upcoming_concerts" :key="c.id" class="concert-row">
              <div class="concert-date">{{ formatConcertDate(c.date) }}</div>
              <div class="concert-venue">
                <span v-if="c.venue">{{ c.venue.name }}<template v-if="c.venue.city">, {{ c.venue.city }}</template></span>
                <span v-else style="color:#888;">TBC</span>
              </div>
              <div class="concert-links">
                <a v-for="l in c.links" :key="l.url" :href="l.url" target="_blank"
                  rel="noopener noreferrer" class="concert-link-btn">{{ l.label }}</a>
              </div>
            </div>
          </div>
        </section>

        <!-- ── CONTACT ───────────────────────────────────────── -->
        <section class="epk-section epk-contact">
          <div class="epk-section-label">Contact</div>
          <div class="contact-grid">
            <div v-if="query.data.value.booking_email" class="contact-item">
              <div class="contact-role">Booking</div>
              <a :href="`mailto:${query.data.value.booking_email}`" class="contact-email">
                {{ query.data.value.booking_email }}
              </a>
            </div>
            <div v-if="query.data.value.press_email" class="contact-item">
              <div class="contact-role">Press / PR</div>
              <a :href="`mailto:${query.data.value.press_email}`" class="contact-email">
                {{ query.data.value.press_email }}
              </a>
            </div>
          </div>
          <div v-if="query.data.value.tech_rider_url || query.data.value.stage_plot_url" class="downloads-row">
            <a v-if="query.data.value.tech_rider_url" :href="query.data.value.tech_rider_url"
              target="_blank" rel="noopener noreferrer" class="download-btn">
              ↓ Tech Rider (PDF)
            </a>
            <a v-if="query.data.value.stage_plot_url" :href="query.data.value.stage_plot_url"
              target="_blank" rel="noopener noreferrer" class="download-btn">
              ↓ Stage Plot
            </a>
          </div>
        </section>

      </div>
    </template>
  </div>
</template>

<style scoped>
.epk-page { background: #fff; min-height: 100vh; }
.epk-loading, .epk-error {
  text-align: center; padding: 4rem; font-size: 0.9375rem; color: #888;
}
.epk-error { color: #555; }

.epk-wrap { max-width: 860px; margin: 0 auto; padding: 3rem 1.5rem 5rem; }

/* Header */
.epk-header { margin-bottom: 2rem; }
.epk-logo { max-height: 5rem; max-width: 20rem; object-fit: contain; margin: 0 auto 1rem; display: block; }
.epk-name { font-size: 2.5rem; font-weight: 800; color: #111; margin: 0 0 0.75rem; letter-spacing: -0.02em; }
.epk-meta-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.625rem; margin-bottom: 0.5rem; }
.genre-badge {
  padding: 0.15rem 0.6rem; border-radius: 0.25rem; font-size: 0.72rem; font-weight: 600;
  background: #f0f0f0; color: #333; letter-spacing: 0.04em; text-transform: uppercase;
}
.epk-meta-item { font-size: 0.8125rem; color: #888; }
.epk-comparable { font-size: 0.8125rem; color: #888; margin: 0.25rem 0 0; font-style: italic; }
.epk-social-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
.social-pill {
  padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500;
  background: #fff; border: 1px solid #ddd; color: #555; text-decoration: none;
  transition: border-color 120ms, color 120ms;
}
.social-pill:hover { border-color: #888; color: #111; }

/* Hero */
.epk-hero { margin-bottom: 2.5rem; border-radius: 0.75rem; overflow: hidden; }
.epk-hero-img { width: 100%; max-height: 420px; object-fit: cover; display: block; }

/* Two-col */
.epk-two-col {
  display: grid; grid-template-columns: 1fr 220px; gap: 2rem; margin-bottom: 2.5rem;
  align-items: start;
}
@media (max-width: 640px) { .epk-two-col { grid-template-columns: 1fr; } }

.epk-section-label {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #888; margin-bottom: 0.75rem;
}
.epk-bio { font-size: 0.9375rem; color: #333; line-height: 1.7; }
.epk-bio :deep(p) { margin: 0 0 0.75rem; }
.epk-bio :deep(p:last-child) { margin: 0; }

.epk-stats { display: flex; flex-direction: column; gap: 0.75rem; }
.stat-row { display: flex; flex-direction: column; }
.stat-value { font-size: 1.375rem; font-weight: 700; color: #111; line-height: 1.2; }
.stat-label { font-size: 0.72rem; color: #888; font-weight: 500; }
.stat-empty { font-size: 0.8rem; color: #bbb; }

/* Sections */
.epk-section { margin-bottom: 2.5rem; }

/* Release card */
.release-card {
  display: flex; gap: 1.25rem; background: #fafafa; border: 1px solid #e0e0e0;
  border-radius: 0.75rem; padding: 1.25rem; align-items: flex-start;
}
.release-cover { width: 100px; height: 100px; border-radius: 0.375rem; object-fit: cover; flex-shrink: 0; }
.release-info { flex: 1; min-width: 0; }
.release-title { font-size: 1.125rem; font-weight: 700; color: #111; margin-bottom: 0.25rem; }
.release-meta { font-size: 0.75rem; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
.release-desc { font-size: 0.8125rem; color: #555; line-height: 1.55; margin: 0 0 0.75rem; }
.release-desc :deep(p) { margin: 0 0 0.5em; }
.release-desc :deep(p:last-child) { margin-bottom: 0; }
.release-links { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.stream-btn {
  padding: 0.3rem 0.875rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
  background: #f0f0f0; border: 1px solid #ddd; color: #333; text-decoration: none;
  transition: background 120ms;
}
.stream-btn:hover { background: #e0e0e0; }

/* Press grid */
.press-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.press-card {
  display: flex; flex-direction: column; background: #fff; border: 1px solid #e0e0e0;
  border-radius: 0.625rem; overflow: hidden; text-decoration: none;
  transition: border-color 150ms;
}
.press-card:hover { border-color: #bbb; }
.press-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #f0f0f0; }
.press-body { padding: 0.75rem; }
.press-source { font-size: 0.68rem; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.2rem; }
.press-title { font-size: 0.8125rem; font-weight: 600; color: #111; line-height: 1.4; margin-bottom: 0.25rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.press-date { font-size: 0.7rem; color: #888; }

/* Photos */
.press-photos-hint { font-size: 0.75rem; color: #888; margin-bottom: 0.75rem; }
.photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.625rem; }
.photo-item {
  position: relative; display: block; aspect-ratio: 4/3; border-radius: 0.375rem;
  overflow: hidden; border: 1px solid #e0e0e0; cursor: pointer;
}
.photo-item:hover .photo-overlay { opacity: 1; }
.photo-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; color: #fff; opacity: 0; transition: opacity 150ms;
}

/* Concerts */
.concerts-list { display: flex; flex-direction: column; gap: 0; border: 1px solid #e0e0e0; border-radius: 0.625rem; overflow: hidden; }
.concert-row {
  display: flex; align-items: center; gap: 1.5rem; padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0; background: #fff;
}
.concert-row:last-child { border-bottom: none; }
.concert-row:hover { background: #f5f5f5; }
.concert-date { font-size: 0.8125rem; font-weight: 600; color: #111; white-space: nowrap; min-width: 160px; }
.concert-venue { font-size: 0.8125rem; color: #888; flex: 1; }
.concert-links { display: flex; gap: 0.5rem; }
.concert-link-btn {
  padding: 0.2rem 0.625rem; border-radius: 0.3rem; font-size: 0.72rem; font-weight: 600;
  background: #f0f0f0; border: 1px solid #ddd; color: #333; text-decoration: none;
  transition: background 120ms;
}
.concert-link-btn:hover { background: #e0e0e0; }

/* Music videos */
.videos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.video-item { }
.video-embed { position: relative; aspect-ratio: 16/9; border-radius: 0.5rem; overflow: hidden; background: #111; }
.video-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
.video-title { font-size: 0.8125rem; font-weight: 600; color: #555; margin-top: 0.5rem; }

/* Contact */
.epk-contact { border-top: 1px solid #e0e0e0; padding-top: 2rem; }
.contact-grid { display: flex; flex-wrap: wrap; gap: 2rem; margin-bottom: 1.25rem; }
.contact-role { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 0.25rem; }
.contact-email { font-size: 0.9375rem; color: #333; text-decoration: none; font-weight: 500; }
.contact-email:hover { color: #111; }
.downloads-row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.download-btn {
  padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  background: #fff; border: 1px solid #ddd; color: #555; text-decoration: none;
  transition: border-color 120ms, color 120ms;
}
.download-btn:hover { border-color: #888; color: #111; }
</style>
