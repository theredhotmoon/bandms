<script setup lang="ts">
import { computed, ref } from 'vue'
import { useShowMore } from '@/lib/showMore'
import ShowMoreButton from './ShowMoreButton.vue'

export interface GalleryAlbum {
  id: number
  title: string
  /** The album's own page — where its photos open (AlbumDetail). */
  href: string
  /** Tag slugs this album carries, used by the filter. */
  categories: readonly string[]
  /** "Live · May 2026" — assembled in Astro so the locale stays server-side. */
  metaLine: string
  /** "Shot at Hydrozagadka", or empty. */
  shotAt: string
  coverUrl: string | null
  photoCount: number
  /** Any photo marked press-ready — the card's badge. */
  hasPressReady: boolean
}

export interface GalleryCopy {
  all: string
  photos: string
  pressReady: string
  shotAt: string
  empty: string
}

const props = defineProps<{
  albums: readonly GalleryAlbum[]
  /** Filter chips, in display order. `slug` matches GalleryAlbum.categories. */
  categories: readonly { slug: string; label: string }[]
  copy: GalleryCopy
  /** Website Modules → Photos → Items per page; null shows everything. */
  perPage?: number | null
  /** Site-wide "Show more" label (the `site` module's copy). */
  showMoreLabel: string
}>()

// ── Filter ────────────────────────────────────────────────────────────────────

const active = ref('all')

const visible = computed(() =>
  active.value === 'all'
    ? props.albums
    : props.albums.filter((a) => a.categories.includes(active.value)),
)

// Counts albums. Picking another category starts again from the first batch.
const { heldBack, hasMore, showMore } = useShowMore(() => visible.value, () => props.perPage, [active])
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
    <div v-else id="gallery-grid" class="gb-grid">
      <a
        v-for="(album, i) in visible"
        :data-more-hidden="heldBack(i)"
        :key="album.id"
        :href="album.href"
        class="gb-card"
        data-testid="gallery-album-card"
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

          <span class="gb-count">{{ album.photoCount }} {{ copy.photos }}</span>

          <span v-if="album.hasPressReady" class="gb-epk">
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
      </a>
    </div>
    <ShowMoreButton v-if="hasMore" list="gallery-grid" :label="showMoreLabel" @click="showMore" />

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
.gb-card:hover .gb-title { text-decoration: underline; text-underline-offset: 4px; }
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

@media (max-width: 1100px) {
  .gb-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .gb-grid { grid-template-columns: 1fr; }
  .gb-title { font-size: 22px; }
}
</style>
