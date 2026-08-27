<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { requestedLyricTrack, clearLyricRequest } from '@/stores/lyrics'

export interface LyricSong {
  /** Track id, so a tracklist row can select this song by the same key. */
  id: number
  title: string
  releaseTitle: string
  /** Raw lyrics; blank lines separate verses. */
  lyrics: string
}

const props = defineProps<{ songs: readonly LyricSong[]; emptyLabel: string }>()

const activeId = ref<number | null>(props.songs[0]?.id ?? null)

const active = computed(() => props.songs.find((s) => s.id === activeId.value) ?? null)

/**
 * Split on blank lines so a verse break renders as space rather than a gap in a
 * single paragraph. Trailing whitespace is trimmed per line: lyrics are pasted
 * from all sorts of places and ragged indentation shows.
 */
const verses = computed(() => {
  if (!active.value) return []
  return active.value.lyrics
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((verse) => verse.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((verse) => verse.length > 0)
})

let unsubscribe: (() => void) | null = null

onMounted(() => {
  // Selected from a tracklist row elsewhere on the page.
  unsubscribe = requestedLyricTrack.subscribe((trackId) => {
    if (trackId === null) return
    if (props.songs.some((s) => s.id === trackId)) activeId.value = trackId
    clearLyricRequest()
  })
})

onUnmounted(() => unsubscribe?.())
</script>

<template>
  <p v-if="songs.length === 0" class="ly-empty">{{ emptyLabel }}</p>

  <div v-else class="ly">
    <nav class="ly-nav" aria-label="Songs">
      <button
        v-for="song in songs"
        :key="song.id"
        type="button"
        class="ly-pick"
        :class="{ 'is-on': activeId === song.id }"
        :aria-pressed="activeId === song.id"
        @click="activeId = song.id"
      >
        <span class="ly-mark" aria-hidden="true" />
        <span>
          <span class="ly-pick-title">{{ song.title }}</span>
          <span class="ly-pick-release">{{ song.releaseTitle }}</span>
        </span>
      </button>
    </nav>

    <article v-if="active" class="ly-sheet">
      <div class="ly-sheet-head">
        <span class="ly-sheet-title">{{ active.title }}</span>
      </div>
      <div class="ly-sheet-body">
        <p v-for="(verse, i) in verses" :key="i" class="ly-verse">
          <template v-for="(line, j) in verse" :key="j">{{ line }}<br v-if="j < verse.length - 1" /></template>
        </p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.ly-empty { font: 500 17px/1.5 var(--font-body); color: var(--color-muted); margin: 0; }

.ly {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 36px;
  align-items: start;
}

.ly-nav { display: flex; flex-direction: column; gap: 10px; }

.ly-pick {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: transparent;
  color: var(--color-body);
  border: var(--border-width-card) solid var(--color-border);
  padding: 13px 15px;
  cursor: pointer;
}
.ly-pick.is-on { background: var(--color-inverse); color: var(--color-on-inverse); }

.ly-mark {
  width: 16px;
  height: 16px;
  flex: none;
  border: 2px solid currentColor;
  background-image: repeating-conic-gradient(var(--color-accent) 0% 25%, transparent 0% 50%);
  background-size: 6px 6px;
}

.ly-pick-title {
  display: block;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 20px;
  line-height: 1.05;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}
.ly-pick-release {
  display: block;
  margin-top: 4px;
  font: 600 11px/1 var(--font-body);
  letter-spacing: .1em;
  text-transform: uppercase;
  opacity: .6;
}

.ly-sheet {
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-surface);
  box-shadow: 8px 8px 0 var(--color-accent);
}

.ly-sheet-head {
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  padding: 14px 22px;
}
.ly-sheet-title {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 26px;
  line-height: 1.05;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}

.ly-sheet-body { padding: 26px 30px 30px; }

.ly-verse {
  margin: 0 0 16px;
  font: 500 19px/1.7 var(--font-body);
  color: var(--color-body);
  text-wrap: pretty;
}
.ly-verse:last-child { margin-bottom: 0; }

@media (max-width: 900px) {
  .ly { grid-template-columns: 1fr; gap: 20px; }
  .ly-nav { flex-direction: row; flex-wrap: wrap; }
  .ly-pick { flex: 1 1 auto; }
  .ly-verse { font-size: 16px; }
  .ly-sheet-body { padding: 18px 20px 22px; }
}
</style>
