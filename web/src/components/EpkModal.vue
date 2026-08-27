<script setup lang="ts">
import ModalShell from '@/components/ModalShell.vue'
import { useModalTrigger } from '@/composables/useModalTrigger'

/**
 * One row in the press kit.
 *
 * Assembled in Astro from what the API actually holds, so a band with no stage
 * plot simply has no stage-plot row. The design's version listed six fixed items
 * whether or not they existed, which is fine for a mockup and a broken promise
 * on a real site.
 */
export interface EpkAsset {
  /** Icon name from Icon.astro. */
  icon: string
  title: string
  /** Format, count or size — derived from real data, never invented. */
  meta: string
  href: string
  /** True for a file served from storage, false for a page on this site. */
  isFile: boolean
}

export interface EpkModalCopy {
  title: string
  subtitle: string
  contents: string
  allLabel: string
  close: string
  empty: string
}

defineProps<{ copy: EpkModalCopy; assets: readonly EpkAsset[]; allHref: string | null }>()

const { isOpen, close } = useModalTrigger('data-open-epk')

// Inlined rather than reusing Icon.astro: this is a Vue island, and Astro
// components cannot render inside one.
const PATHS: Record<string, string> = {
  quote:
    'M9 7H5v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2C9 14.3 10 12.7 10 10V8a1 1 0 0 0-1-1zm9 0h-4v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2c2.4-1 3.4-2.6 3.4-5.4V8a1 1 0 0 0-1-1z',
  camera: 'M4 8a2 2 0 0 1 2-2h2l1.5-2h5L18 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  star: 'M12 3.5l1.2 5.3 5.3 1.2-5.3 1.2L12 16.5l-1.2-5.3L5.5 10l5.3-1.2z',
  spotify: 'M8 10.4c2.6-.7 5.6-.4 7.8.9M8.4 13.2c2-.5 4.3-.3 6 .8M9 15.7c1.4-.4 2.9-.2 4.1.6',
  filter: 'M4 6h16M7 12h10M10 18h4',
  pin: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z',
  disc: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z',
}
</script>

<template>
  <ModalShell
    :open="isOpen"
    :title="copy.title"
    :close-label="copy.close"
    :width="640"
    @close="close"
  >
    <p class="ek-sub">{{ copy.subtitle }}</p>

    <p v-if="assets.length === 0" class="ek-empty">{{ copy.empty }}</p>

    <template v-else>
      <p class="ek-label">{{ copy.contents }}</p>

      <ul class="ek-list">
        <li v-for="asset in assets" :key="asset.title">
          <a
            class="ek-row"
            :href="asset.href"
            :target="asset.isFile ? '_blank' : undefined"
            :rel="asset.isFile ? 'noopener' : undefined"
          >
            <span class="ek-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent)"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path :d="PATHS[asset.icon] ?? PATHS.disc" />
              </svg>
            </span>

            <span class="ek-text">
              <span class="ek-title">{{ asset.title }}</span>
              <span class="ek-meta">{{ asset.meta }}</span>
            </span>

            <!-- A file downloads, a page navigates: the arrow says which. -->
            <svg
              class="ek-go"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path v-if="asset.isFile" d="M12 4v10M8 11l4 4 4-4M5 19h14" />
              <path v-else d="M9 6l6 6-6 6" />
            </svg>
          </a>
        </li>
      </ul>
    </template>

    <a v-if="allHref" class="ek-all" :href="allHref">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
      {{ copy.allLabel }}
    </a>
  </ModalShell>
</template>

<style scoped>
.ek-sub {
  margin: 0 0 8px;
  font: 500 15px/1.5 var(--font-body);
  color: var(--color-muted);
}

.ek-empty {
  margin: 18px 0 0;
  font: 500 15px/1.5 var(--font-body);
  color: var(--color-muted);
}

.ek-label {
  margin: 18px 0 12px;
  font: 800 11px/1 var(--font-body);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--color-subtle);
}

.ek-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ek-row {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 15px 4px;
  border-bottom: 2px solid color-mix(in oklab, var(--color-ink) 12%, transparent);
  color: var(--color-body);
  text-decoration: none;
}
.ek-row:hover .ek-title { color: var(--color-accent); }
.ek-row:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.ek-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 2.5px solid var(--color-border);
}

.ek-title {
  display: block;
  font: var(--display-weight) 20px/1.02 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  transition: color .12s;
}

.ek-meta {
  display: block;
  margin-top: 5px;
  font: 600 12px/1.3 var(--font-body);
  color: var(--color-subtle);
}

.ek-go { color: var(--color-body); }

.ek-all {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
  padding: 16px 24px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 20px;
  line-height: 1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  text-decoration: none;
  box-shadow: var(--shadow-card);
}

@media (max-width: 600px) {
  .ek-title { font-size: 17px; }
  .ek-row { grid-template-columns: 36px 1fr auto; gap: 12px; }
  .ek-icon { width: 36px; height: 36px; }
  .ek-all { font-size: 16px; }
}
</style>
