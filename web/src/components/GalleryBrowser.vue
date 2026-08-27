<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'

export interface GalleryPhoto {
  id: number
  src: string
  caption: string | null
  isPressReady: boolean
}

export interface GalleryAlbum {
  id: number
  title: string
  /** Tag slugs this album carries, used by the filter. */
  categories: readonly string[]
  /** "Live · May 2026" — assembled in Astro so the locale stays server-side. */
  metaLine: string
  /** "Shot at Hydrozagadka", or empty. */
  shotAt: string
  coverUrl: string | null
  photos: readonly GalleryPhoto[]
}

export interface GalleryCopy {
  all: string
  photos: string
  pressReady: string
  shotAt: string
  close: string
  prev: string
  next: string
  empty: string
}

const props = defineProps<{
  albums: readonly GalleryAlbum[]
  /** Filter chips, in display order. `slug` matches GalleryAlbum.categories. */
  categories: readonly { slug: string; label: string }[]
  copy: GalleryCopy
}>()

// ── Filter ────────────────────────────────────────────────────────────────────

const active = ref('all')

const visible = computed(() =>
  active.value === 'all'
    ? props.albums
    : props.albums.filter((a) => a.categories.includes(active.value)),
)

// ── Lightbox ──────────────────────────────────────────────────────────────────

/** The album being browsed, and the index within it. */
const openAlbum = ref<GalleryAlbum | null>(null)
const index = ref(0)
const panel = ref<HTMLElement | null>(null)

const photo = computed(() => openAlbum.value?.photos[index.value] ?? null)

function open(album: GalleryAlbum) {
  if (album.photos.length === 0) return
  openAlbum.value = album
  index.value = 0
  document.body.style.overflow = 'hidden'
  void nextTick(() => panel.value?.focus())
}

function close() {
  openAlbum.value = null
  document.body.style.overflow = ''
}

/** Wraps at both ends, as the design's modulo step does. */
function step(delta: number) {
  const album = openAlbum.value
  if (!album) return
  const count = album.photos.length
  index.value = (index.value + delta + count) % count
}

function onKeydown(event: KeyboardEvent) {
  if (!openAlbum.value) return
  if (event.key === 'Escape') close()
  if (event.key === 'ArrowRight') step(1)
  if (event.key === 'ArrowLeft') step(-1)
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

/**
 * Astro server-renders this island, and @astrojs/vue's renderToString discards
 * teleported content — leaving a hydration anchor with no target, which Vue then
 * fails to patch ("Cannot read properties of null"). Survivable while this is the
 * only teleporting island on its page; fatal the moment a second one lands. Same
 * gate as ModalShell.
 */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <div>
    <!-- FILTER -->
    <div v-if="categories.length > 0" class="gb-filter">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)"
           stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
        <path d="M4 6h16M7 12h10M10 18h4" />
      </svg>
      <button
        v-for="cat in [{ slug: 'all', label: copy.all }, ...categories]"
        :key="cat.slug"
        type="button"
        class="gb-chip"
        :class="{ 'is-on': active === cat.slug }"
        :aria-pressed="active === cat.slug"
        @click="active = cat.slug"
      >{{ cat.label }}</button>
    </div>

    <p v-if="visible.length === 0" class="gb-empty">{{ copy.empty }}</p>

    <!-- ALBUMS -->
    <div v-else class="gb-grid">
      <button
        v-for="album in visible"
        :key="album.id"
        type="button"
        class="gb-card"
        @click="open(album)"
      >
        <span class="gb-cover">
          <img v-if="album.coverUrl" :src="album.coverUrl" :alt="album.title" loading="lazy" />
          <span v-else class="gb-cover-fallback" aria-hidden="true" />

          <span class="gb-lens" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-accent)"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L18 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <circle cx="12" cy="12.5" r="3.4" />
            </svg>
          </span>

          <span class="gb-count">{{ album.photos.length }} {{ copy.photos }}</span>

          <span v-if="album.photos.some(p => p.isPressReady)" class="gb-epk">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-on-accent)" aria-hidden="true">
              <path d="M12 3.5l1.2 5.3 5.3 1.2-5.3 1.2L12 16.5l-1.2-5.3L5.5 10l5.3-1.2z" />
            </svg>
            {{ copy.pressReady }}
          </span>
        </span>

        <span class="gb-body">
          <span v-if="album.metaLine" class="gb-meta">{{ album.metaLine }}</span>
          <span class="gb-title">{{ album.title }}</span>
          <span v-if="album.shotAt" class="gb-shot">{{ copy.shotAt }} {{ album.shotAt }}</span>
        </span>
      </button>
    </div>

    <!-- LIGHTBOX -->
    <Teleport v-if="mounted" to="body">
      <div
        v-if="openAlbum && photo"
        class="gb-scrim"
        role="dialog"
        aria-modal="true"
        :aria-label="openAlbum.title"
        @click.self="close"
      >
        <button type="button" class="gb-close" :aria-label="copy.close" @click="close">✕</button>

        <div ref="panel" class="gb-panel" tabindex="-1">
          <div class="gb-stage">
            <img :src="photo.src" :alt="photo.caption ?? openAlbum.title" />

            <span v-if="photo.isPressReady" class="gb-epk gb-epk--stage">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-on-accent)" aria-hidden="true">
                <path d="M12 3.5l1.2 5.3 5.3 1.2-5.3 1.2L12 16.5l-1.2-5.3L5.5 10l5.3-1.2z" />
              </svg>
              {{ copy.pressReady }}
            </span>

            <template v-if="openAlbum.photos.length > 1">
              <button type="button" class="gb-nav gb-nav--prev" :aria-label="copy.prev" @click="step(-1)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button type="button" class="gb-nav gb-nav--next" :aria-label="copy.next" @click="step(1)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </template>
          </div>

          <div class="gb-caption">
            <div>
              <span class="gb-caption-title">{{ photo.caption || openAlbum.title }}</span>
              <span v-if="photo.caption" class="gb-caption-album">{{ openAlbum.title }}</span>
            </div>
            <span class="gb-counter">{{ index + 1 }} / {{ openAlbum.photos.length }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Filter ───────────────────────────────────────────────────────────────── */
.gb-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 26px;
}

.gb-chip {
  background: transparent;
  color: var(--color-body);
  border: var(--border-width-card) solid var(--color-border);
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 16px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  padding: 9px 15px;
  cursor: pointer;
}
.gb-chip.is-on { background: var(--color-inverse); color: var(--color-on-inverse); }

.gb-empty { margin: 0; font: 500 17px/1.5 var(--font-body); color: var(--color-muted); }

/* ── Album cards ──────────────────────────────────────────────────────────── */
.gb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

.gb-card {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-body);
}
.gb-card:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.gb-cover {
  position: relative;
  display: block;
  height: 240px;
  overflow: hidden;
  border-bottom: var(--border-width-card) solid var(--color-border);
  background: var(--color-inverse);
}
.gb-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gb-cover-fallback {
  display: block;
  width: 100%;
  height: 100%;
  background-image: repeating-linear-gradient(
    45deg,
    color-mix(in oklab, var(--color-ink) 92%, white) 0 9px,
    color-mix(in oklab, var(--color-ink) 84%, white) 9px 18px
  );
}

.gb-lens {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 58px;
  height: 58px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  display: grid;
  place-items: center;
  box-shadow: 4px 4px 0 var(--color-ink);
}

.gb-count {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  font: 700 12px/1 ui-monospace, Menlo, monospace;
  letter-spacing: .04em;
  padding: 5px 8px;
}

.gb-epk {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font: 800 10px/1 var(--font-body);
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: 5px 8px;
}

.gb-body { display: block; padding: 16px 18px 18px; }

.gb-meta {
  display: block;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.gb-title {
  display: block;
  margin: 9px 0 8px;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 26px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}

.gb-shot { display: block; font: 600 13px/1 var(--font-body); color: var(--color-subtle); }

/* ── Lightbox ─────────────────────────────────────────────────────────────── */
.gb-scrim {
  position: fixed;
  inset: 0;
  z-index: 240;
  background: color-mix(in oklab, var(--color-ink) 92%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.gb-close {
  position: absolute;
  top: 24px;
  right: 28px;
  width: 44px;
  height: 44px;
  border: 2px solid var(--color-page);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-page);
  font-size: 18px;
  cursor: pointer;
}

.gb-panel {
  width: 960px;
  max-width: 100%;
  background: var(--color-page);
  border: 5px solid var(--color-border);
  box-shadow: 14px 14px 0 var(--color-accent);
  outline: none;
}

.gb-stage {
  position: relative;
  aspect-ratio: 16 / 10;
  border-bottom: var(--border-width-emphasis) solid var(--color-border);
  overflow: hidden;
  background: var(--color-inverse);
}
.gb-stage img { width: 100%; height: 100%; object-fit: contain; display: block; }

.gb-epk--stage { top: 14px; left: 14px; }

.gb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border: none;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 3px 3px 0 var(--color-accent);
}
.gb-nav--prev { left: 14px; }
.gb-nav--next { right: 14px; }

.gb-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 22px;
}

.gb-caption-title {
  display: block;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 22px;
  line-height: 1.05;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}
.gb-caption-album {
  display: block;
  margin-top: 6px;
  font: 600 13px/1.3 var(--font-body);
  color: var(--color-subtle);
}

.gb-counter { font: 700 13px/1 ui-monospace, Menlo, monospace; color: var(--color-accent); }

@media (max-width: 1100px) {
  .gb-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .gb-grid { grid-template-columns: 1fr; }
  .gb-title { font-size: 22px; }
  .gb-scrim { padding: 12px; }
  .gb-close { top: 10px; right: 12px; }
}
</style>
