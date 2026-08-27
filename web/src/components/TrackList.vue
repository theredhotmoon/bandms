<script setup lang="ts">
import { showLyricsFor } from '@/stores/lyrics'

/**
 * One release's tracklist. Shared by the featured release and each expanded
 * discography row, which is why it is its own component rather than markup
 * repeated twice.
 */
export interface TrackRow {
  id: number
  /** 1-based position, rendered zero-padded. */
  n: number
  title: string
  duration: string | null
  /** Only tracks with lyrics get a jump button. */
  hasLyrics: boolean
}

defineProps<{ tracks: readonly TrackRow[]; lyricsLabel: string; lyricsEnabled: boolean }>()

function jump(trackId: number) {
  showLyricsFor(trackId)
  document.getElementById('lyrics')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <ol class="tl">
    <li v-for="track in tracks" :key="track.id" class="tl-row">
      <span class="tl-n">{{ String(track.n).padStart(2, '0') }}</span>
      <span class="tl-title">
        {{ track.title }}
        <button
          v-if="track.hasLyrics && lyricsEnabled"
          type="button"
          class="tl-lyric"
          @click="jump(track.id)"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--color-accent)" aria-hidden="true">
            <path d="M9 7H5v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2C9 14.3 10 12.7 10 10V8a1 1 0 0 0-1-1zm9 0h-4v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2c2.4-1 3.4-2.6 3.4-5.4V8a1 1 0 0 0-1-1z" />
          </svg>
          {{ lyricsLabel }}
        </button>
      </span>
      <span class="tl-dur">{{ track.duration ?? '' }}</span>
    </li>
  </ol>
</template>

<style scoped>
.tl {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 2px solid color-mix(in oklab, var(--color-ink) 14%, transparent);
}

.tl-row {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1.5px solid color-mix(in oklab, var(--color-ink) 10%, transparent);
}

.tl-n {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 18px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  color: var(--color-accent);
}

.tl-title { font: 600 15px/1.3 var(--font-body); color: var(--color-body); }

.tl-lyric {
  margin-left: 10px;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1.5px solid var(--color-accent);
  color: var(--color-accent);
  font: 800 10px/1 var(--font-body);
  letter-spacing: .08em;
  text-transform: uppercase;
  padding: 4px 7px;
  cursor: pointer;
}

/* Monospace so durations align down the column regardless of digits. */
.tl-dur {
  font: 600 13px/1 ui-monospace, Menlo, monospace;
  color: var(--color-subtle);
}
</style>
