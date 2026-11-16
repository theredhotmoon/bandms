<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'

export interface AlbumGridPhoto {
  id: number
  src: string
  caption: string | null
  isPressReady: boolean
}

export interface AlbumGridCopy {
  pressReady: string
  close: string
  prev: string
  next: string
  /** Screen-reader label per thumbnail; `{n}` is the photo number. */
  openPhoto: string
}

const props = defineProps<{
  /** The album title — the lightbox's label, and the alt text of an uncaptioned photo. */
  title: string
  photos: readonly AlbumGridPhoto[]
  copy: AlbumGridCopy
}>()

// ── Lightbox ──────────────────────────────────────────────────────────────────

/** The open photo's index, or null when the lightbox is closed. */
const index = ref<number | null>(null)
const panel = ref<HTMLElement | null>(null)
/** The thumbnail that opened the lightbox, so focus can go back to it. */
let opener: HTMLElement | null = null

const photo = computed(() => (index.value === null ? null : props.photos[index.value] ?? null))

function open(i: number, event: Event) {
  opener = event.currentTarget as HTMLElement
  index.value = i
  document.body.style.overflow = 'hidden'
  void nextTick(() => panel.value?.focus())
}

function close() {
  index.value = null
  document.body.style.overflow = ''
  opener?.focus()
}

/** Wraps at both ends, as the design's modulo step does. */
function step(delta: number) {
  if (index.value === null) return
  const count = props.photos.length
  index.value = (index.value + delta + count) % count
}

function onKeydown(event: KeyboardEvent) {
  if (index.value === null) return
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
 * fails to patch ("Cannot read properties of null"). Same gate as ModalShell.
 */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const label = (n: number) => props.copy.openPhoto.replace('{n}', String(n))
</script>

<template>
  <div>
    <ul class="ap-grid" data-testid="album-photos">
      <li v-for="(p, i) in photos" :key="p.id">
        <button type="button" class="ap-thumb" :aria-label="label(i + 1)" @click="open(i, $event)">
          <img :src="p.src" :alt="p.caption ?? ''" loading="lazy" />
          <span v-if="p.isPressReady" class="ap-epk">{{ copy.pressReady }}</span>
        </button>
      </li>
    </ul>

    <Teleport v-if="mounted" to="body">
      <div
        v-if="photo && index !== null"
        class="ap-scrim"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        data-testid="album-lightbox"
        @click.self="close"
      >
        <button type="button" class="ap-close" :aria-label="copy.close" @click="close">✕</button>

        <div ref="panel" class="ap-panel" tabindex="-1">
          <div class="ap-stage">
            <img :src="photo.src" :alt="photo.caption ?? title" />

            <span v-if="photo.isPressReady" class="ap-epk ap-epk--stage">{{ copy.pressReady }}</span>

            <template v-if="photos.length > 1">
              <button type="button" class="ap-nav ap-nav--prev" :aria-label="copy.prev" @click="step(-1)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button type="button" class="ap-nav ap-nav--next" :aria-label="copy.next" @click="step(1)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </template>
          </div>

          <div class="ap-caption">
            <div>
              <span class="ap-caption-title">{{ photo.caption || title }}</span>
              <span v-if="photo.caption" class="ap-caption-album">{{ title }}</span>
            </div>
            <span class="ap-counter" data-testid="album-lightbox-counter">{{ index + 1 }} / {{ photos.length }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Grid ─────────────────────────────────────────────────────────────────── */
.ap-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.ap-thumb {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  cursor: zoom-in;
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-inverse);
}
.ap-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .2s; }
.ap-thumb:hover img { transform: scale(1.04); }
.ap-thumb:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.ap-epk {
  position: absolute;
  top: 10px;
  left: 10px;
  white-space: nowrap;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font: 800 10px/1 var(--font-body);
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: 5px 8px;
}

/* ── Lightbox ─────────────────────────────────────────────────────────────── */
.ap-scrim {
  position: fixed;
  inset: 0;
  z-index: 240;
  background: color-mix(in oklab, var(--color-ink) 92%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.ap-close {
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

.ap-panel {
  width: 960px;
  max-width: 100%;
  background: var(--color-page);
  border: 5px solid var(--color-border);
  box-shadow: 14px 14px 0 var(--color-accent);
  outline: none;
}

.ap-stage {
  position: relative;
  aspect-ratio: 16 / 10;
  border-bottom: var(--border-width-emphasis) solid var(--color-border);
  overflow: hidden;
  background: var(--color-inverse);
}
.ap-stage img { width: 100%; height: 100%; object-fit: contain; display: block; }

.ap-epk--stage { top: 14px; left: 14px; }

.ap-nav {
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
.ap-nav--prev { left: 14px; }
.ap-nav--next { right: 14px; }

.ap-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 22px;
}

.ap-caption-title {
  display: block;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 22px;
  line-height: 1.05;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}
.ap-caption-album {
  display: block;
  margin-top: 6px;
  font: 600 13px/1.3 var(--font-body);
  color: var(--color-subtle);
}

.ap-counter { font: 700 13px/1 ui-monospace, Menlo, monospace; color: var(--color-accent); }

@media (max-width: 1100px) {
  .ap-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 700px) {
  .ap-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .ap-scrim { padding: 12px; }
  .ap-close { top: 10px; right: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .ap-thumb img { transition: none; }
  .ap-thumb:hover img { transform: none; }
}
</style>
