<script setup lang="ts">
import { ref } from 'vue'
import TrackList, { type TrackRow } from '@/components/TrackList.vue'

export interface DiscographyRelease {
  id: number
  title: string
  typeLabel: string
  year: string
  /** Rendered as a rotated stamp over the cover. Empty hides it. */
  statusLabel: string
  isUpcoming: boolean
  coverUrl: string | null
  href: string | null
  tracks: readonly TrackRow[]
  links: readonly { platform: string; label: string; url: string }[]
}

defineProps<{
  releases: readonly DiscographyRelease[]
  tracksLabel: string
  lyricsLabel: string
  lyricsEnabled: boolean
  detailLabel: string
}>()

/** id of the expanded release, or null. One open at a time, as in the design. */
const open = ref<number | null>(null)

function toggle(id: number) {
  open.value = open.value === id ? null : id
}

const PLATFORM_PATHS: Record<string, string> = {
  spotify: 'M8 10.4c2.6-.7 5.6-.4 7.8.9M8.4 13.2c2-.5 4.3-.3 6 .8M9 15.7c1.4-.4 2.9-.2 4.1.6',
  bandcamp: 'M8 14.5l2.4-5h5.6l-2.4 5z',
  youtube: 'M11 9.5l4 2.5-4 2.5z',
  apple_music: 'M16 13.2c0-2 1.5-2.9 1.6-3-.9-1.3-2.2-1.5-2.7-1.5-1.2-.1-2.2.7-2.8.7-.6 0-1.4-.7-2.4-.7-1.2 0-2.4.7-3 1.8-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.9 2.3 1.8.9 0 1.3-.6 2.4-.6 1.1 0 1.4.6 2.4.6 1 0 1.6-.9 2.2-1.8.4-.6.6-1.2.8-1.6-1.8-.7-2.4-2.8-2.4-3.5z',
  instagram: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
}
</script>

<template>
  <div class="dg">
    <article
      v-for="release in releases"
      :key="release.id"
      class="dg-card"
      :class="{ 'is-open': open === release.id }"
    >
      <h3 class="dg-h">
        <button
          type="button"
          class="dg-toggle"
          :aria-expanded="open === release.id"
          :aria-controls="`dg-panel-${release.id}`"
          @click="toggle(release.id)"
        >
          <span class="dg-cover">
            <img v-if="release.coverUrl" :src="release.coverUrl" :alt="release.title" loading="lazy" />
            <span v-else class="dg-cover-fallback" aria-hidden="true" />
            <span v-if="release.statusLabel" class="dg-stamp">{{ release.statusLabel }}</span>
          </span>

          <span class="dg-body">
            <span class="dg-meta">{{ release.typeLabel }} · {{ release.year }}</span>
            <span class="dg-titlerow">
              <span class="dg-title">{{ release.title }}</span>
              <span class="dg-plus" aria-hidden="true">{{ open === release.id ? '–' : '+' }}</span>
            </span>
            <span class="dg-count">{{ release.tracks.length }} {{ tracksLabel }}</span>
          </span>
        </button>
      </h3>

      <div v-show="open === release.id" :id="`dg-panel-${release.id}`" class="dg-panel">
        <TrackList
          v-if="release.tracks.length > 0"
          :tracks="release.tracks"
          :lyrics-label="lyricsLabel"
          :lyrics-enabled="lyricsEnabled"
        />

        <div class="dg-actions">
          <a
            v-for="link in release.links"
            :key="link.platform"
            class="dg-link"
            :href="link.url"
            target="_blank"
            rel="noopener"
            :aria-label="link.label"
            :title="link.label"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle v-if="link.platform === 'spotify' || link.platform === 'bandcamp'" cx="12" cy="12" r="9.2" />
              <rect v-if="link.platform === 'youtube'" x="3" y="6" width="18" height="12" rx="3.5" />
              <rect v-if="link.platform === 'instagram'" x="3" y="3" width="18" height="18" rx="5" />
              <path :d="PLATFORM_PATHS[link.platform] ?? ''" />
            </svg>
          </a>

          <a v-if="release.href" class="dg-detail" :href="release.href">{{ detailLabel }} →</a>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.dg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: start;
}

.dg-card {
  border: var(--border-width-card) solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  transition: box-shadow .15s;
}
.dg-card.is-open { box-shadow: 8px 8px 0 var(--color-accent); }

.dg-h { margin: 0; font: inherit; }

.dg-toggle {
  all: unset;
  box-sizing: border-box;
  display: block;
  width: 100%;
  cursor: pointer;
}
.dg-toggle:focus-visible { outline: 3px solid var(--color-accent); outline-offset: -3px; }

.dg-cover {
  position: relative;
  display: block;
  border-bottom: var(--border-width-card) solid var(--color-border);
  aspect-ratio: 1 / 1;
  overflow: hidden;
}
.dg-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Diagonal hatch stands in for missing art without shipping a placeholder image. */
.dg-cover-fallback {
  display: block;
  width: 100%;
  height: 100%;
  background-image: repeating-linear-gradient(
    45deg,
    color-mix(in oklab, var(--color-page) 92%, black) 0 9px,
    color-mix(in oklab, var(--color-page) 97%, black) 9px 18px
  );
}

.dg-stamp {
  position: absolute;
  top: 12px;
  left: 12px;
  transform: rotate(-3deg);
  background: var(--color-page);
  border: 3px solid var(--color-accent);
  color: var(--color-accent);
  font: 800 10px/1 var(--font-body);
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 5px 9px;
  white-space: nowrap;
}

.dg-body { display: block; padding: 16px 18px 14px; }

.dg-meta {
  display: block;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--color-subtle);
}

.dg-titlerow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
}

.dg-title {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 28px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}

.dg-plus { font: 800 22px/1 var(--font-body); color: var(--color-accent); flex: none; }

.dg-count {
  display: block;
  margin-top: 10px;
  font: 600 13px/1 var(--font-body);
  color: var(--color-subtle);
}

.dg-panel { padding: 0 18px 18px; }

.dg-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.dg-link {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 2px solid var(--color-border);
  color: var(--color-body);
}

.dg-detail {
  margin-left: auto;
  font: 800 12px/1 var(--font-body);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

@media (max-width: 1100px) {
  .dg { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .dg { grid-template-columns: 1fr; }
  .dg-title { font-size: 22px; }
}
</style>
