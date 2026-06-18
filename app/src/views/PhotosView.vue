<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAlbums } from '@/composables/useAlbums'
import { useLang } from '@/composables/useLang'
import SiteNav from '@/components/public/SiteNav.vue'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'
import type { AlbumPhoto } from '@/types/album'

const { lang } = useLang()
const { query } = useAlbums()
const albums = computed(() => (query.data.value ?? []).filter(a => a.photos.length > 0))

// Tag filter
const allTags = computed(() => {
  const tags = new Map<number, string>()
  albums.value.forEach(a => a.tags.forEach(t => tags.set(t.id, t.name)))
  return [...tags.entries()].map(([id, name]) => ({ id, name }))
})
const activeTag = ref<number | null>(null)

const filteredAlbums = computed(() => {
  if (activeTag.value === null) return albums.value
  return albums.value.filter(a => a.tags.some(t => t.id === activeTag.value))
})

// Lightbox
const lightboxOpen = ref(false)
const lightboxAlbum = ref<typeof albums.value[0] | null>(null)
const lightboxIdx = ref(0)

function openLightbox(album: typeof albums.value[0], idx: number) {
  lightboxAlbum.value = album
  lightboxIdx.value = idx
  lightboxOpen.value = true
}
function closeLightbox() { lightboxOpen.value = false }
function prevPhoto() {
  if (!lightboxAlbum.value) return
  const n = lightboxAlbum.value.photos.length
  lightboxIdx.value = (lightboxIdx.value - 1 + n) % n
}
function nextPhoto() {
  if (!lightboxAlbum.value) return
  lightboxIdx.value = (lightboxIdx.value + 1) % lightboxAlbum.value.photos.length
}

function handleKey(e: KeyboardEvent) {
  if (!lightboxOpen.value) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft') prevPhoto()
  if (e.key === 'ArrowRight') nextPhoto()
}

const currentPhoto = computed<AlbumPhoto | null>(() => {
  if (!lightboxAlbum.value) return null
  return lightboxAlbum.value.photos[lightboxIdx.value] ?? null
})

const T = {
  en: {
    heroTitle: 'Gallery',
    heroSub: 'Moments from the stage and behind the scenes — our photo archive.',
    all: 'All albums',
    noAlbums: 'No published albums yet.',
    photos: 'photos',
    close: 'Close',
    prev: 'Previous',
    next: 'Next',
  },
  pl: {
    heroTitle: 'Galeria',
    heroSub: 'Chwile ze sceny i za kulisami — archiwum fotograficzne.',
    all: 'Wszystkie albumy',
    noAlbums: 'Brak opublikowanych albumów.',
    photos: 'zdjęć',
    close: 'Zamknij',
    prev: 'Poprzednie',
    next: 'Następne',
  },
}
const t = computed(() => T[lang.value])
</script>

<template>
  <div class="photos-page" @keydown="handleKey" tabindex="-1">
    <SiteNav active="gallery" />
    <main>
    <!-- HERO -->
    <section class="hero">
      <div class="hero-checker" />
      <div class="hero-inner">
        <span class="hero-kicker">{{ lang === 'en' ? 'PHOTOS' : 'ZDJĘCIA' }} · GALLERY</span>
        <h1 class="hero-title">{{ t.heroTitle }}</h1>
        <p class="hero-sub">{{ t.heroSub }}</p>
      </div>
    </section>

    <!-- FILTERS -->
    <div class="filters">
      <button
        class="filter-btn"
        :class="{ 'filter-btn--active': activeTag === null }"
        @click="activeTag = null"
      >{{ t.all }}</button>
      <button
        v-for="tag in allTags"
        :key="tag.id"
        class="filter-btn"
        :class="{ 'filter-btn--active': activeTag === tag.id }"
        @click="activeTag = tag.id"
      >{{ tag.name }}</button>
    </div>

    <!-- ALBUMS GRID -->
    <section class="albums-section">
      <div v-if="filteredAlbums.length" class="albums-grid">
        <div v-for="album in filteredAlbums" :key="album.id" class="album-card">
          <!-- Cover photo -->
          <div class="album-cover" @click="openLightbox(album, 0)">
            <img
              v-if="album.cover_url || album.photos[0]?.image_url"
              :src="album.cover_url ?? album.photos[0].image_url ?? ''"
              :alt="album.title"
              class="album-cover-img"
              loading="lazy"
            />
            <div v-else class="album-cover-placeholder" />
            <div class="album-cover-overlay">
              <span class="album-count">{{ album.photo_count }} {{ t.photos }}</span>
            </div>
          </div>
          <div class="album-meta">
            <div class="album-title">{{ album.title }}</div>
            <div v-if="album.taken_at" class="album-date">{{ new Date(album.taken_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }}</div>
          </div>
          <!-- Photo strip -->
          <div v-if="album.photos.length > 1" class="photo-strip">
            <div
              v-for="(photo, pi) in album.photos.slice(1, 5)"
              :key="photo.id"
              class="strip-thumb"
              @click="openLightbox(album, pi + 1)"
            >
              <img v-if="photo.image_url" :src="photo.image_url" :alt="photo.caption ?? ''" class="strip-img" loading="lazy" />
              <div v-else class="strip-placeholder" />
            </div>
          </div>
        </div>
      </div>
      <p v-else class="empty-text">{{ t.noAlbums }}</p>
    </section>

    <!-- LIGHTBOX -->
    <Teleport to="body">
      <div v-if="lightboxOpen" class="lightbox" @click.self="closeLightbox">
        <button class="lb-close" :aria-label="t.close" @click="closeLightbox">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <button class="lb-arrow lb-arrow--prev" :aria-label="t.prev" @click="prevPhoto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div class="lb-img-wrap">
          <img
            v-if="currentPhoto?.image_url"
            :src="currentPhoto.image_url"
            :alt="currentPhoto.caption ?? ''"
            class="lb-img"
          />
          <div v-else class="lb-placeholder" />
          <div v-if="currentPhoto?.caption" class="lb-caption">{{ currentPhoto.caption }}</div>
        </div>
        <button class="lb-arrow lb-arrow--next" :aria-label="t.next" @click="nextPhoto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        <div class="lb-counter">{{ lightboxIdx + 1 }} / {{ lightboxAlbum?.photos.length }}</div>
      </div>
    </Teleport>

    <CheckerStrip :h="14" :size="28" color-a="var(--color-accent)" color-b="#EFE7D6" />
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.photos-page { background: #EFE7D6; color: #121212; font-family: 'Archivo', sans-serif; }

/* HERO */
.hero { background: #121212; color: #EFE7D6; position: relative; overflow: hidden; padding: 0; }
.hero-checker {
  position: absolute; inset: 0;
  background-image: repeating-conic-gradient(rgba(255,255,255,.04) 0% 25%, transparent 0% 50%);
  background-size: 36px 36px;
}
.hero-inner { position: relative; padding: 64px 90px; }
.hero-kicker {
  font: 800 13px/1 'Archivo', sans-serif; letter-spacing: .28em;
  color: var(--color-accent); text-transform: uppercase; display: block; margin-bottom: 16px;
}
.hero-title { font: 400 80px/.85 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 20px; }
.hero-sub { font: 500 18px/1.5 'Archivo', sans-serif; color: rgba(239,231,214,.75); max-width: 520px; margin: 0; }

/* FILTERS */
.filters {
  display: flex; gap: 10px; flex-wrap: wrap;
  padding: 28px 90px 0;
}
.filter-btn {
  border: 3px solid #121212; background: transparent; color: #121212;
  font: 700 13px/1 'Archivo', sans-serif; letter-spacing: .08em; text-transform: uppercase;
  padding: 10px 18px; cursor: pointer; transition: all 150ms;
}
.filter-btn:hover, .filter-btn--active {
  background: var(--color-accent); border-color: var(--color-accent); color: #fff;
  box-shadow: 4px 4px 0 #121212;
}

/* ALBUMS */
.albums-section { padding: 28px 90px 56px; }
.albums-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.album-card { display: flex; flex-direction: column; }
.album-cover {
  position: relative; aspect-ratio: 4/3; overflow: hidden; cursor: pointer;
  border: 3px solid #121212; box-shadow: 5px 5px 0 #121212;
  transition: box-shadow 150ms;
}
.album-cover:hover { box-shadow: 8px 8px 0 var(--color-accent); }
.album-cover-img { width: 100%; height: 100%; object-fit: cover; transition: transform 300ms; }
.album-cover:hover .album-cover-img { transform: scale(1.04); }
.album-cover-placeholder {
  width: 100%; height: 100%;
  background: repeating-linear-gradient(45deg, #c8c0b0, #c8c0b0 9px, #d6cebd 9px, #d6cebd 18px);
}
.album-cover-overlay {
  position: absolute; inset: 0; background: rgba(18,18,18,.3);
  display: flex; align-items: flex-end; padding: 12px 14px;
  opacity: 0; transition: opacity 200ms;
}
.album-cover:hover .album-cover-overlay { opacity: 1; }
.album-count {
  background: var(--color-accent); color: #fff; font: 800 12px/1 'Archivo', sans-serif;
  letter-spacing: .1em; text-transform: uppercase; padding: 7px 10px;
}
.album-meta { padding: 14px 3px 10px; }
.album-title { font: 400 22px/.95 'Anton', sans-serif; text-transform: uppercase; }
.album-date { font: 600 13px/1 'Archivo', sans-serif; color: #666; margin-top: 5px; }
.photo-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.strip-thumb { aspect-ratio: 1; overflow: hidden; cursor: pointer; border: 2px solid #121212; transition: opacity 150ms; }
.strip-thumb:hover { opacity: .8; }
.strip-img { width: 100%; height: 100%; object-fit: cover; }
.strip-placeholder { width: 100%; height: 100%; background: #c8c0b0; }
.empty-text { font: 500 16px/1.5 'Archivo', sans-serif; color: #777; padding: 40px 0; }

/* LIGHTBOX */
.lightbox {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(18,18,18,.96);
  display: flex; align-items: center; justify-content: center;
}
.lb-close {
  position: absolute; top: 20px; right: 24px;
  background: transparent; border: none; color: #EFE7D6; cursor: pointer;
  transition: color 150ms;
}
.lb-close:hover { color: var(--color-accent); }
.lb-arrow {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: transparent; border: none; color: #EFE7D6; cursor: pointer;
  padding: 12px; transition: color 150ms;
}
.lb-arrow:hover { color: var(--color-accent); }
.lb-arrow--prev { left: 20px; }
.lb-arrow--next { right: 20px; }
.lb-img-wrap {
  max-width: min(90vw, 1200px); max-height: 88vh;
  display: flex; flex-direction: column; align-items: center;
}
.lb-img { max-width: 100%; max-height: 80vh; object-fit: contain; box-shadow: 8px 8px 0 var(--color-accent); }
.lb-placeholder {
  width: 800px; max-width: 90vw; height: 500px; max-height: 70vh;
  background: #333; box-shadow: 8px 8px 0 var(--color-accent);
}
.lb-caption {
  font: 500 15px/1.4 'Archivo', sans-serif; color: rgba(239,231,214,.7);
  margin-top: 12px; text-align: center; max-width: 600px;
}
.lb-counter {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  font: 700 14px/1 'Archivo', sans-serif; letter-spacing: .1em;
  color: rgba(239,231,214,.5);
}

@media (max-width: 1100px) {
  .hero-inner, .filters, .albums-section { padding-left: 40px; padding-right: 40px; }
}
@media (max-width: 768px) {
  .hero-inner { padding: 40px 20px; }
  .filters { padding: 20px 20px 0; }
  .albums-section { padding: 20px 20px 40px; }
  .albums-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
  .hero-title { font-size: 52px; }
  .lb-arrow--prev { left: 6px; }
  .lb-arrow--next { right: 6px; }
}
@media (max-width: 480px) {
  .albums-grid { grid-template-columns: 1fr; }
}
</style>
