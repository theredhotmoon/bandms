<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchReleases, fetchRelease } from '@/api/releases'
import { fetchMusicVideos } from '@/api/musicVideos'
import type { ReleaseSummary, Release, ReleaseType } from '@/types/release'
import type { MusicVideo } from '@/types/musicVideo'
import { useLang } from '@/composables/useLang'
import SiteNav from '@/components/public/SiteNav.vue'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'

const { lang } = useLang()

const releasesQk = computed(() => ['releases-public', lang.value])
const { data: releasesRaw } = useQuery<ReleaseSummary[]>({
  queryKey: releasesQk,
  queryFn: () => fetchReleases(lang.value),
})

const { data: videosRaw } = useQuery<MusicVideo[]>({
  queryKey: ['music-videos-public'],
  queryFn: fetchMusicVideos,
})

const releases = computed(() =>
  (releasesRaw.value ?? []).slice().sort((a, b) => {
    if (!a.release_date && !b.release_date) return 0
    if (!a.release_date) return 1
    if (!b.release_date) return -1
    return b.release_date.localeCompare(a.release_date)
  }),
)

const featured = computed<ReleaseSummary | null>(() => releases.value[0] ?? null)
const discography = computed<ReleaseSummary[]>(() => releases.value.slice(1))
const videos = computed<MusicVideo[]>(() => (videosRaw.value ?? []).slice().sort((a, b) => a.sort_order - b.sort_order))

// Expanded tracklist card
const openId = ref<number | null>(null)
function toggleOpen(id: number) { openId.value = openId.value === id ? null : id }

// Featured release detail (tracklist) — loaded lazily on first hover/focus
const featuredDetail = ref<Release | null>(null)
const loadingFeatured = ref(false)

async function ensureFeaturedDetail(id: number) {
  if (featuredDetail.value?.id === id) return
  loadingFeatured.value = true
  try { featuredDetail.value = await fetchRelease(id, lang.value) } catch { /* no-op */ }
  finally { loadingFeatured.value = false }
}

// Detail modal for discography items
const detailItem = ref<Release | null>(null)
const loadingDetail = ref(false)

async function openDetail(r: ReleaseSummary) {
  if (detailItem.value?.id === r.id) { toggleOpen(r.id); return }
  loadingDetail.value = true
  try { detailItem.value = await fetchRelease(r.id, lang.value) } catch { detailItem.value = null }
  finally { loadingDetail.value = false; toggleOpen(r.id) }
}

watch(lang, () => {
  featuredDetail.value = null
  detailItem.value = null
})

// Video lightbox
const lightboxVideo = ref<MusicVideo | null>(null)

const TYPE_LABEL: Record<ReleaseType, { en: string; pl: string }> = {
  LP:          { en: 'Album',       pl: 'Album' },
  EP:          { en: 'EP',          pl: 'EP' },
  single:      { en: 'Single',      pl: 'Singiel' },
  compilation: { en: 'Compilation', pl: 'Składanka' },
}

const PLATFORMS = [
  { id: 'spotify',     label: 'Spotify' },
  { id: 'apple_music', label: 'Apple Music' },
  { id: 'bandcamp',    label: 'Bandcamp' },
  { id: 'youtube',     label: 'YouTube' },
] as const

const T = {
  en: {
    kicker: 'SKANKING STORKS · DISCOGRAPHY',
    title: 'MUSIC',
    lead: 'Ska, rocksteady and two-tone from Warsaw. Stream it, buy it, skank to it.',
    featured: 'FEATURED RELEASE',
    tracklist: 'TRACKLIST',
    listen: 'STREAM NOW',
    presave: 'PRE-SAVE',
    whereHead: 'WHERE TO LISTEN',
    whereSub: 'Find us on your favourite platform.',
    disco: 'DISCOGRAPHY',
    discoSub: 'Full catalogue — click any release to expand the tracklist.',
    tracks: 'tracks',
    videos: 'MUSIC VIDEOS',
    views: 'views',
    watchNow: 'WATCH',
    upcoming: 'UPCOMING',
    nlTitle: 'STAY ON THE OFFBEAT',
    nlSub: 'New releases, tour dates and behind-the-scenes — straight to your inbox.',
    emailPh: 'your@email.com',
    subscribe: 'SUBSCRIBE',
    subscribed: "YOU'RE ON THE LIST!",
    noReleases: 'New music coming soon.',
    noVideos: 'Videos dropping soon.',
    close: 'Close',
  },
  pl: {
    kicker: 'SKANKING STORKS · DYSKOGRAFIA',
    title: 'MUZYKA',
    lead: 'Ska, rocksteady i two-tone z Warszawy. Posłuchaj, kup, skankuj.',
    featured: 'WYRÓŻNIONA PREMIERA',
    tracklist: 'LISTA UTWORÓW',
    listen: 'SŁUCHAJ',
    presave: 'PRE-SAVE',
    whereHead: 'GDZIE SŁUCHAĆ',
    whereSub: 'Znajdź nas na swojej ulubionej platformie.',
    disco: 'DYSKOGRAFIA',
    discoSub: 'Pełny katalog — kliknij, żeby rozwinąć listę utworów.',
    tracks: 'utwory',
    videos: 'TELEDYSKI',
    views: 'wyświetleń',
    watchNow: 'OGLĄDAJ',
    upcoming: 'PREMIERA',
    nlTitle: 'BĄDŹ NA OFFBEACIE',
    nlSub: 'Nowe wydania, daty tras i kulisy — prosto na skrzynkę.',
    emailPh: 'twoj@email.com',
    subscribe: 'ZAPISZ SIĘ',
    subscribed: 'JESTEŚ NA LIŚCIE!',
    noReleases: 'Nowa muzyka wkrótce.',
    noVideos: 'Teledyski wkrótce.',
    close: 'Zamknij',
  },
}
const t = computed(() => T[lang.value])

function releaseYear(r: ReleaseSummary): string {
  return r.release_date ? r.release_date.slice(0, 4) : '—'
}

function typeLabel(r: ReleaseSummary): string {
  return TYPE_LABEL[r.type]?.[lang.value] ?? r.type
}

// Newsletter
const nlEmail = ref('')
const nlDone = ref(false)
async function nlSubmit(e: Event) {
  e.preventDefault()
  if (!nlEmail.value.trim()) return
  nlDone.value = true
}

function formatViews(v: number | null): string {
  if (!v) return ''
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return String(v)
}
</script>

<template>
  <div class="music-page">
    <SiteNav active="music" />

    <!-- HERO -->
    <section class="hero">
      <div class="hero-checker" />
      <div class="hero-inner">
        <div>
          <span class="hero-kicker">{{ t.kicker }}</span>
          <h1 class="hero-title">{{ t.title }}</h1>
          <p class="hero-sub">{{ t.lead }}</p>
        </div>
      </div>
    </section>
    <CheckerStrip :h="16" :size="30" color-a="var(--color-accent)" color-b="#EFE7D6" />

    <!-- FEATURED RELEASE -->
    <section v-if="featured" class="section section--featured">
      <div class="section-inner">
        <div class="section-row-head">
          <h2 class="section-head">{{ t.featured }}</h2>
        </div>
        <div class="featured-grid">
          <!-- Cover -->
          <div class="featured-cover-wrap">
            <img v-if="featured.cover_image" :src="featured.cover_image" :alt="featured.title" class="featured-cover" />
            <div v-else class="featured-cover-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3"/></svg>
            </div>
            <span v-if="featured.is_upcoming" class="upcoming-stamp">{{ t.upcoming }}</span>
          </div>

          <!-- Meta + tracklist + links -->
          <div class="featured-meta">
            <div class="release-eyebrow">{{ typeLabel(featured) }} · {{ releaseYear(featured) }}</div>
            <h3 class="featured-title">{{ featured.title }}</h3>
            <div v-if="featured.label_name" class="release-label">{{ featured.label_name }}</div>

            <!-- Streaming links -->
            <div v-if="featured.links.length" class="featured-links">
              <a
                v-for="link in featured.links"
                :key="link.id"
                :href="link.url"
                target="_blank"
                rel="noopener"
                class="solid-btn"
              >{{ featured.is_upcoming ? t.presave : t.listen }} →</a>
            </div>

            <!-- Tracklist -->
            <div
              class="tracklist-wrap"
              @mouseenter="ensureFeaturedDetail(featured!.id)"
              @focusin="ensureFeaturedDetail(featured!.id)"
            >
              <div class="tracklist-head">{{ t.tracklist }}</div>
              <div v-if="loadingFeatured" class="tracklist-loading">…</div>
              <div v-else-if="featuredDetail?.id === featured.id && featuredDetail.tracks.length" class="tracklist">
                <div
                  v-for="(tr, i) in featuredDetail.tracks.slice().sort((a, b) => a.sort_order - b.sort_order)"
                  :key="tr.id"
                  class="track-row"
                >
                  <span class="track-num">{{ String(i + 1).padStart(2, '0') }}</span>
                  <span class="track-title">{{ tr.title }}</span>
                  <span v-if="tr.duration" class="track-dur">{{ tr.duration }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- WHERE TO LISTEN -->
    <section class="where-section">
      <div class="where-inner">
        <div class="where-text">
          <h2 class="where-head">{{ t.whereHead }}</h2>
          <p class="where-sub">{{ t.whereSub }}</p>
        </div>
        <div class="platforms">
          <template v-for="p in PLATFORMS" :key="p.id">
            <a
              v-if="featured?.links.find(l => l.platform === p.id)"
              :href="featured!.links.find(l => l.platform === p.id)!.url"
              target="_blank" rel="noopener"
              class="platform-btn"
            >{{ p.label }}</a>
            <span v-else class="platform-btn platform-btn--dim">{{ p.label }}</span>
          </template>
        </div>
      </div>
    </section>

    <!-- DISCOGRAPHY -->
    <section v-if="discography.length" class="section">
      <div class="section-inner">
        <h2 class="section-head">{{ t.disco }}</h2>
        <p class="disco-sub">{{ t.discoSub }}</p>
        <CheckerStrip :h="12" :size="20" color-a="var(--color-accent)" color-b="#EFE7D6" style="margin: 24px 0;" />
        <div class="disco-grid">
          <div v-for="r in discography" :key="r.id" class="disco-card" :class="{ 'disco-card--open': openId === r.id }">
            <!-- Card header (always visible) -->
            <button class="disco-card-header" @click="openDetail(r)">
              <div class="disco-cover-wrap">
                <img v-if="r.cover_image" :src="r.cover_image" :alt="r.title" class="disco-cover" />
                <div v-else class="disco-cover-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3"/></svg>
                </div>
                <span v-if="r.is_upcoming" class="upcoming-stamp upcoming-stamp--sm">{{ t.upcoming }}</span>
              </div>
              <div class="disco-meta">
                <div class="release-eyebrow">{{ typeLabel(r) }} · {{ releaseYear(r) }}</div>
                <div class="disco-title">{{ r.title }}</div>
              </div>
              <span class="disco-toggle">{{ openId === r.id ? '–' : '+' }}</span>
            </button>

            <!-- Expanded tracklist -->
            <div v-if="openId === r.id" class="disco-expanded">
              <div v-if="loadingDetail" class="tracklist-loading">…</div>
              <div v-else-if="detailItem?.id === r.id && detailItem.tracks.length" class="tracklist">
                <div
                  v-for="(tr, i) in detailItem.tracks.slice().sort((a, b) => a.sort_order - b.sort_order)"
                  :key="tr.id"
                  class="track-row"
                >
                  <span class="track-num">{{ String(i + 1).padStart(2, '0') }}</span>
                  <span class="track-title">{{ tr.title }}</span>
                  <span v-if="tr.duration" class="track-dur">{{ tr.duration }}</span>
                </div>
              </div>
              <div v-if="detailItem?.id === r.id && detailItem.links.length" class="disco-links">
                <a
                  v-for="link in detailItem.links"
                  :key="link.id"
                  :href="link.url"
                  target="_blank" rel="noopener"
                  class="ghost-btn"
                >{{ PLATFORMS.find(p => p.id === link.platform)?.label ?? link.platform }}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <div v-else-if="!releases.length" class="section section--state">
      <p class="state-text">{{ t.noReleases }}</p>
    </div>

    <CheckerStrip :h="14" :size="26" color-a="#121212" color-b="#EFE7D6" />

    <!-- MUSIC VIDEOS -->
    <section class="section">
      <div class="section-inner">
        <h2 class="section-head">{{ t.videos }}</h2>
        <CheckerStrip :h="12" :size="20" color-a="var(--color-accent)" color-b="#EFE7D6" style="margin: 24px 0;" />
        <div v-if="videos.length" class="videos-grid">
          <button
            v-for="v in videos"
            :key="v.id"
            class="video-card"
            @click="lightboxVideo = v"
          >
            <div class="video-thumb-wrap">
              <img v-if="v.og_image" :src="v.og_image" :alt="v.og_title ?? v.title" class="video-thumb" />
              <div v-else class="video-thumb-placeholder" />
              <div class="video-play-btn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
              <span v-if="v.duration" class="video-dur">{{ v.duration }}</span>
            </div>
            <div class="video-info">
              <div class="video-channel">{{ v.channel_name ?? 'YouTube' }}</div>
              <div class="video-title">{{ v.og_title ?? v.title }}</div>
              <div v-if="v.view_count" class="video-views">{{ formatViews(v.view_count) }} {{ t.views }}</div>
            </div>
          </button>
        </div>
        <p v-else class="state-text">{{ t.noVideos }}</p>
      </div>
    </section>

    <!-- NEWSLETTER -->
    <section class="nl-section">
      <div class="nl-inner">
        <div class="nl-text">
          <span class="nl-stamp">★ {{ lang === 'en' ? 'NEW MUSIC ALERTS' : 'ALERTY O NOWEJ MUZYCE' }}</span>
          <h2 class="nl-title">{{ t.nlTitle }}</h2>
          <p class="nl-sub">{{ t.nlSub }}</p>
        </div>
        <div v-if="nlDone" class="nl-done">✦ {{ t.subscribed }}</div>
        <form v-else class="nl-form" @submit="nlSubmit">
          <input v-model="nlEmail" type="email" :placeholder="t.emailPh" class="nl-input" required />
          <button type="submit" class="nl-submit">{{ t.subscribe }} →</button>
        </form>
      </div>
    </section>

    <SiteFooter />

    <!-- VIDEO LIGHTBOX -->
    <Teleport to="body">
      <Transition name="lb">
        <div v-if="lightboxVideo" class="lb-backdrop" @click.self="lightboxVideo = null">
          <div class="lb-modal">
            <div class="lb-header">
              <span class="lb-title">{{ lightboxVideo.og_title ?? lightboxVideo.title }}</span>
              <button class="lb-close" @click="lightboxVideo = null" :aria-label="t.close">✕</button>
            </div>
            <div class="lb-video">
              <div class="lb-placeholder">
                <div class="lb-play-big">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><polygon points="5,3 19,12 5,21"/></svg>
                </div>
              </div>
            </div>
            <div class="lb-footer">
              <span>{{ lightboxVideo.channel_name }}</span>
              <span v-if="lightboxVideo.duration">{{ lightboxVideo.duration }}</span>
              <span v-if="lightboxVideo.view_count">{{ formatViews(lightboxVideo.view_count) }} {{ t.views }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.music-page { background: #EFE7D6; color: #121212; font-family: 'Archivo', sans-serif; }

/* HERO */
.hero { background: #121212; color: #EFE7D6; position: relative; overflow: hidden; }
.hero-checker {
  position: absolute; inset: 0;
  background-image: repeating-conic-gradient(rgba(255,255,255,.04) 0% 25%, transparent 0% 50%);
  background-size: 40px 40px;
}
.hero-inner {
  position: relative;
  padding: 60px 90px 68px;
}
.hero-kicker {
  display: block;
  font: 800 13px/1 'Archivo', sans-serif;
  letter-spacing: .3em; color: var(--color-accent); text-transform: uppercase; margin-bottom: 20px;
}
.hero-title {
  font: 400 140px/.82 'Anton', sans-serif;
  text-transform: uppercase; margin: 0 0 22px;
}
.hero-sub {
  font: 500 20px/1.55 'Archivo', sans-serif;
  color: rgba(239,231,214,.8); max-width: 580px; margin: 0;
}

/* SECTIONS */
.section { padding: 60px 0; }
.section--state { padding: 40px 90px; }
.section--featured { padding-top: 60px; padding-bottom: 60px; }
.section-inner { padding: 0 90px; }
.section-row-head { margin-bottom: 28px; }
.section-head {
  font: 400 56px/.9 'Anton', sans-serif;
  text-transform: uppercase; margin: 0 0 8px;
}
.state-text { font: 500 16px/1.5 'Archivo', sans-serif; color: #777; }

/* FEATURED RELEASE */
.featured-grid {
  display: grid; grid-template-columns: 360px 1fr; gap: 48px; align-items: start;
}
.featured-cover-wrap {
  position: relative;
  border: 4px solid #121212;
  box-shadow: 10px 10px 0 var(--color-accent);
  aspect-ratio: 1; overflow: hidden;
}
.featured-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
.featured-cover-placeholder {
  width: 100%; aspect-ratio: 1;
  background: #2a2a2a; display: grid; place-items: center;
  color: rgba(239,231,214,.3);
}
.upcoming-stamp {
  position: absolute; top: 14px; left: 14px;
  border: 3px solid var(--color-accent); color: var(--color-accent);
  font: 800 11px/1 'Archivo', sans-serif; letter-spacing: .12em;
  text-transform: uppercase; padding: 6px 10px; background: #EFE7D6;
  transform: rotate(-3deg);
}
.upcoming-stamp--sm { font-size: 9px; padding: 4px 8px; top: 10px; left: 10px; }
.release-eyebrow { font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .18em; text-transform: uppercase; color: #888; }
.featured-title {
  font: 400 64px/.88 'Anton', sans-serif;
  text-transform: uppercase; margin: 10px 0 8px;
}
.release-label { font: 600 14px/1 'Archivo', sans-serif; color: #666; margin-bottom: 14px; }
.featured-links { display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0 22px; }
.solid-btn {
  display: inline-flex; align-items: center; gap: 10px;
  background: var(--color-accent); color: #fff; text-decoration: none;
  font: 400 16px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 14px 22px; box-shadow: 5px 5px 0 #121212;
  transition: opacity 150ms; white-space: nowrap;
}
.solid-btn:hover { opacity: .85; }

/* Tracklist */
.tracklist-wrap { border-top: 3px solid #121212; padding-top: 18px; margin-top: 10px; }
.tracklist-head {
  font: 400 22px/1 'Anton', sans-serif;
  text-transform: uppercase; margin-bottom: 12px;
}
.tracklist-loading { font: 600 15px/1 'Archivo', sans-serif; color: #aaa; }
.tracklist { display: flex; flex-direction: column; }
.track-row {
  display: grid; grid-template-columns: 30px 1fr auto;
  align-items: center; gap: 12px; padding: 10px 0;
  border-bottom: 1.5px solid rgba(18,18,18,.1);
}
.track-num { font: 400 18px/1 'Anton', sans-serif; color: var(--color-accent); }
.track-title { font: 600 15px/1.3 'Archivo', sans-serif; color: #222; }
.track-dur { font: 600 13px/1 ui-monospace, Menlo, monospace; color: #888; }

/* WHERE TO LISTEN */
.where-section { background: #121212; color: #EFE7D6; padding: 48px 90px; }
.where-inner { display: grid; grid-template-columns: 300px 1fr; gap: 40px; align-items: center; }
.where-head { font: 400 40px/1 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 10px; }
.where-sub { font: 500 15px/1.5 'Archivo', sans-serif; color: rgba(239,231,214,.7); margin: 0; }
.platforms { display: flex; flex-wrap: wrap; gap: 12px; }
.platform-btn {
  display: inline-flex; align-items: center; gap: 10px;
  border: 2px solid rgba(239,231,214,.4); color: #EFE7D6;
  font: 700 14px/1 'Archivo', sans-serif; letter-spacing: .04em; text-transform: uppercase;
  padding: 13px 18px; text-decoration: none; transition: border-color 150ms, color 150ms;
}
.platform-btn:not(.platform-btn--dim):hover {
  border-color: var(--color-accent); color: var(--color-accent);
}
.platform-btn--dim { opacity: .35; cursor: default; }

/* DISCOGRAPHY GRID */
.disco-sub { font: 500 16px/1.5 'Archivo', sans-serif; color: #555; margin: 0; }
.disco-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.disco-card {
  border: 3px solid #121212; background: #fff;
  transition: box-shadow .15s;
}
.disco-card--open { box-shadow: 6px 6px 0 var(--color-accent); }
.disco-card-header {
  all: unset; cursor: pointer; display: block; width: 100%; box-sizing: border-box;
}
.disco-cover-wrap {
  position: relative; border-bottom: 3px solid #121212; aspect-ratio: 1; overflow: hidden;
}
.disco-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
.disco-cover-placeholder {
  width: 100%; aspect-ratio: 1;
  background: #1c1c1c; display: grid; place-items: center;
  color: rgba(239,231,214,.25);
}
.disco-meta { padding: 14px 16px 4px; }
.disco-title {
  font: 400 28px/1.0 'Anton', sans-serif;
  text-transform: uppercase; margin: 6px 0 8px;
}
.disco-toggle {
  font: 800 22px/1 'Archivo', sans-serif;
  color: var(--color-accent); padding: 0 16px 14px;
  display: block; text-align: right;
}
.disco-expanded { padding: 0 16px 16px; }
.disco-links { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.ghost-btn {
  display: inline-flex; align-items: center;
  border: 2px solid #121212; color: #121212;
  font: 700 12px/1 'Archivo', sans-serif; letter-spacing: .06em; text-transform: uppercase;
  padding: 9px 14px; text-decoration: none; transition: background 120ms, color 120ms;
}
.ghost-btn:hover { background: #121212; color: #EFE7D6; }

/* VIDEOS */
.videos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.video-card {
  all: unset; cursor: pointer; display: block;
  border: 3px solid #121212; background: #fff;
  transition: box-shadow .15s;
}
.video-card:hover { box-shadow: 5px 5px 0 var(--color-accent); }
.video-thumb-wrap {
  position: relative; aspect-ratio: 16/9;
  border-bottom: 3px solid #121212; overflow: hidden; background: #111;
}
.video-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.video-thumb-placeholder { width: 100%; height: 100%; background: #1c1c1c; }
.video-play-btn {
  position: absolute; inset: 0;
  display: grid; place-items: center;
}
.video-play-btn > svg {
  width: 52px; height: 52px; padding: 14px;
  background: var(--color-accent); color: #fff;
  box-shadow: 4px 4px 0 #121212;
  border-radius: 50%;
}
.video-dur {
  position: absolute; bottom: 8px; right: 8px;
  background: #121212; color: #EFE7D6;
  font: 700 11px/1 ui-monospace, Menlo, monospace;
  padding: 4px 7px;
}
.video-info { padding: 12px 14px 14px; }
.video-channel {
  font: 800 10px/1 'Archivo', sans-serif;
  letter-spacing: .12em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 8px;
}
.video-title {
  font: 400 22px/1.05 'Anton', sans-serif;
  text-transform: uppercase; margin-bottom: 8px;
}
.video-views { font: 600 12px/1 'Archivo', sans-serif; color: #888; }

/* NEWSLETTER */
.nl-section { padding: 20px 90px 60px; }
.nl-inner {
  border: 4px dashed #121212; padding: 40px 48px;
  display: grid; grid-template-columns: 1fr 420px; gap: 40px; align-items: center;
  background: #fff;
}
.nl-stamp {
  display: inline-block; border: 3px solid var(--color-accent); color: var(--color-accent);
  font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .14em; text-transform: uppercase;
  padding: 7px 12px; border-radius: 3px; margin-bottom: 14px;
}
.nl-title {
  font: 400 48px/.92 'Anton', sans-serif;
  text-transform: uppercase; margin: 0 0 10px;
}
.nl-sub { font: 500 16px/1.5 'Archivo', sans-serif; color: #555; margin: 0; }
.nl-done {
  font: 400 28px/1.1 'Anton', sans-serif;
  color: var(--color-accent); text-transform: uppercase;
}
.nl-form { display: flex; flex-direction: column; gap: 12px; }
.nl-input {
  border: 3px solid #121212; padding: 15px 17px;
  font: 600 16px/1 'Archivo', sans-serif; outline: none; background: #EFE7D6;
}
.nl-input:focus { border-color: var(--color-accent); }
.nl-submit {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  background: #121212; color: #EFE7D6; border: none;
  font: 400 18px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 15px 24px; cursor: pointer;
  box-shadow: 6px 6px 0 var(--color-accent); transition: opacity 150ms;
}
.nl-submit:hover { opacity: .85; }

/* VIDEO LIGHTBOX */
.lb-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(12,12,12,.86);
  display: flex; justify-content: center; align-items: center; padding: 40px;
}
.lb-modal {
  width: 860px; max-width: 100%;
  background: #EFE7D6; border: 5px solid #121212;
  box-shadow: 14px 14px 0 var(--color-accent);
}
.lb-header {
  display: flex; align-items: center; justify-content: space-between;
  background: #121212; color: #EFE7D6; padding: 14px 22px; gap: 16px;
}
.lb-title { font: 400 22px/1.1 'Anton', sans-serif; text-transform: uppercase; flex: 1; min-width: 0; }
.lb-close {
  width: 36px; height: 36px; flex-shrink: 0;
  border: 2px solid #EFE7D6; background: transparent; color: #EFE7D6;
  font: 400 18px/1 'Anton', sans-serif; cursor: pointer; border-radius: 50%;
  display: grid; place-items: center; transition: background 120ms, color 120ms;
}
.lb-close:hover { background: #EFE7D6; color: #121212; }
.lb-video { position: relative; aspect-ratio: 16/9; background: #0c0c0c; }
.lb-placeholder { width: 100%; height: 100%; display: grid; place-items: center; }
.lb-play-big {
  width: 80px; height: 80px; border-radius: 50%;
  background: var(--color-accent); display: grid; place-items: center;
  color: #fff; box-shadow: 5px 5px 0 #121212;
}
.lb-footer {
  display: flex; align-items: center; gap: 16px;
  padding: 12px 20px; font: 600 13px/1.4 'Archivo', sans-serif; color: #666;
}

/* RESPONSIVE */
@media (max-width: 1100px) {
  .hero-inner { padding: 52px 40px 60px; }
  .hero-title { font-size: 96px; }
  .section-inner { padding: 0 40px; }
  .where-section { padding: 40px; }
  .nl-section { padding: 20px 40px 52px; }
  .featured-grid { grid-template-columns: 280px 1fr; gap: 32px; }
  .disco-grid { grid-template-columns: repeat(2, 1fr); }
  .videos-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .hero-inner { padding: 36px 20px 44px; }
  .hero-title { font-size: 72px; }
  .section-inner { padding: 0 20px; }
  .where-section { padding: 36px 20px; }
  .where-inner { grid-template-columns: 1fr; gap: 24px; }
  .nl-section { padding: 16px 20px 44px; }
  .nl-inner { grid-template-columns: 1fr; padding: 28px 22px; }
  .featured-grid { grid-template-columns: 1fr; }
  .disco-grid { grid-template-columns: 1fr; }
  .videos-grid { grid-template-columns: 1fr; }
}

.lb-enter-active, .lb-leave-active { transition: opacity 200ms; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
</style>
