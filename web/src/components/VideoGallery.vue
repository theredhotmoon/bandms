<script setup lang="ts">
import { ref, nextTick } from 'vue'

export interface GalleryVideo {
  id: number
  title: string
  /** Channel or category line above the title. Empty renders nothing. */
  kind: string
  /** YouTube embed URL, or null when the URL could not be parsed. */
  embedUrl: string | null
  /** Fallback link, always present. */
  watchUrl: string
  thumb: string | null
  duration: string | null
  meta: string
}

defineProps<{ videos: readonly GalleryVideo[]; closeLabel: string; watchLabel: string }>()

/**
 * Grid and lightbox live in one island rather than two.
 *
 * The grid needs to tell the lightbox *which* video, and cross-island messaging
 * would mean a store for something that never leaves this section. The
 * availability calendar uses a store because its trigger is static Astro markup;
 * here the triggers are Vue already.
 */
const playing = ref<GalleryVideo | null>(null)
const panel = ref<HTMLElement | null>(null)

function open(video: GalleryVideo) {
  // No embed URL means we could not parse the link — send them to the source
  // rather than opening an empty frame.
  if (!video.embedUrl) {
    window.open(video.watchUrl, '_blank', 'noopener')
    return
  }
  playing.value = video
  document.body.style.overflow = 'hidden'
  void nextTick(() => panel.value?.focus())
}

function close() {
  playing.value = null
  document.body.style.overflow = ''
}
</script>

<template>
  <div class="vg">
    <button v-for="video in videos" :key="video.id" type="button" class="vg-card" @click="open(video)">
      <span class="vg-thumb">
        <img v-if="video.thumb" :src="video.thumb" :alt="video.title" loading="lazy" />
        <span v-else class="vg-thumb-fallback" aria-hidden="true" />
        <span class="vg-play" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--color-on-accent)">
            <path d="M8 5.5l11 6.5-11 6.5z" />
          </svg>
        </span>
        <span v-if="video.duration" class="vg-dur">{{ video.duration }}</span>
      </span>
      <span class="vg-body">
        <span v-if="video.kind" class="vg-kind">{{ video.kind }}</span>
        <span class="vg-title">{{ video.title }}</span>
        <span v-if="video.meta" class="vg-meta">{{ video.meta }}</span>
      </span>
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="playing"
      class="vg-scrim"
      role="dialog"
      aria-modal="true"
      :aria-label="playing.title"
      @click.self="close"
    >
      <div ref="panel" class="vg-panel" tabindex="-1" @keydown.esc="close">
        <div class="vg-panel-head">
          <span class="vg-panel-title">{{ playing.title }}</span>
          <button type="button" class="vg-close" :aria-label="closeLabel" @click="close">✕</button>
        </div>
        <div class="vg-frame">
          <iframe
            :src="playing.embedUrl!"
            :title="playing.title"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.vg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.vg-card {
  all: unset;
  box-sizing: border-box;
  display: block;
  cursor: pointer;
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-body);
}
.vg-card:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.vg-thumb {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  border-bottom: var(--border-width-card) solid var(--color-border);
  background: var(--color-inverse);
  overflow: hidden;
}
.vg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vg-thumb-fallback {
  display: block;
  width: 100%;
  height: 100%;
  background-image: repeating-linear-gradient(
    45deg,
    color-mix(in oklab, var(--color-ink) 92%, white) 0 9px,
    color-mix(in oklab, var(--color-ink) 84%, white) 9px 18px
  );
}

.vg-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  display: grid;
  place-items: center;
  box-shadow: 4px 4px 0 var(--color-ink);
}

.vg-dur {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  font: 700 12px/1 ui-monospace, Menlo, monospace;
  letter-spacing: .04em;
  padding: 5px 8px;
}

.vg-body { display: block; padding: 14px 16px 16px; }

.vg-kind {
  display: block;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.vg-title {
  display: block;
  margin: 9px 0 10px;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 24px;
  line-height: 1.02;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}

.vg-meta { display: block; font: 600 13px/1 var(--font-body); color: var(--color-subtle); }

/* ── Lightbox ─────────────────────────────────────────────────────────────── */

.vg-scrim {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: color-mix(in oklab, var(--color-ink) 88%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.vg-panel {
  width: 1000px;
  max-width: 100%;
  background: var(--color-page);
  border: 5px solid var(--color-border);
  box-shadow: 14px 14px 0 var(--color-accent);
  outline: none;
}

.vg-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  padding: 14px 22px;
}
.vg-panel-title {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 22px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}
.vg-close {
  width: 36px;
  height: 36px;
  flex: none;
  border: 2px solid var(--color-on-inverse);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-on-inverse);
  cursor: pointer;
}

.vg-frame { aspect-ratio: 16 / 9; background: var(--color-inverse); }
.vg-frame iframe { width: 100%; height: 100%; border: 0; display: block; }

@media (max-width: 1100px) {
  .vg { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .vg { grid-template-columns: 1fr; }
  .vg-title { font-size: 20px; }
  .vg-scrim { padding: 12px; }
}
</style>
