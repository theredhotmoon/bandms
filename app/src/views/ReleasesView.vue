<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchReleases, fetchRelease } from '@/api/releases'
import type { ReleaseSummary, Release, ReleaseType } from '@/types/release'

const { data, isPending } = useQuery<ReleaseSummary[]>({
  queryKey: ['releases-public'],
  queryFn: fetchReleases,
})

const releases = computed(() =>
  (data.value ?? []).slice().sort((a, b) => {
    if (!a.release_date && !b.release_date) return 0
    if (!a.release_date) return 1
    if (!b.release_date) return -1
    return b.release_date.localeCompare(a.release_date)
  }),
)

// Detail modal
const detail = ref<Release | null>(null)
const detailLoading = ref(false)

async function openRelease(r: ReleaseSummary) {
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await fetchRelease(r.id)
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detail.value = null
}

const TYPE_LABEL: Record<ReleaseType, string> = {
  LP: 'Album',
  EP: 'EP',
  single: 'Single',
  compilation: 'Compilation',
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  bandcamp: 'Bandcamp',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

function releaseYear(r: ReleaseSummary): string {
  if (!r.release_date) return '—'
  return r.release_date.slice(0, 4)
}
</script>

<template>
  <div class="rl-page">
    <header class="rl-header">
      <div class="rl-header-inner">
        <p class="rl-eyebrow">Discography</p>
        <h1 class="rl-title">Releases</h1>
        <p class="rl-sub">Albums, EPs, singles and more.</p>
      </div>
    </header>

    <div v-if="isPending" class="rl-state">Loading…</div>
    <div v-else-if="!releases.length" class="rl-state">No releases yet.</div>

    <section v-else class="rl-grid-wrap">
      <div class="rl-grid">
        <button
          v-for="r in releases"
          :key="r.id"
          class="rl-card"
          @click="openRelease(r)"
        >
          <!-- Cover -->
          <div class="rl-cover-wrap">
            <img
              v-if="r.cover_image"
              :src="r.cover_image"
              :alt="r.title"
              class="rl-cover"
              loading="lazy"
            />
            <div v-else class="rl-cover-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
                <path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3"/>
              </svg>
            </div>
            <div v-if="r.is_upcoming" class="rl-upcoming-badge">Upcoming</div>
          </div>

          <!-- Info -->
          <div class="rl-card-info">
            <div class="rl-type-badge">{{ TYPE_LABEL[r.type] }}</div>
            <div class="rl-card-title">{{ r.title }}</div>
            <div class="rl-card-year">{{ releaseYear(r) }}</div>
          </div>
        </button>
      </div>
    </section>

    <!-- Detail modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="detail || detailLoading" class="rl-backdrop" @click.self="closeDetail">
          <div class="rl-modal">
            <button class="rl-modal-close" @click="closeDetail" aria-label="Close">✕</button>

            <div v-if="detailLoading" class="rl-modal-loading">Loading…</div>

            <template v-if="detail">
              <div class="rl-modal-top">
                <div class="rl-modal-cover-wrap">
                  <img
                    v-if="detail.cover_image"
                    :src="detail.cover_image"
                    :alt="detail.title"
                    class="rl-modal-cover"
                  />
                  <div v-else class="rl-modal-cover-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                      <path d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3"/>
                    </svg>
                  </div>
                </div>

                <div class="rl-modal-meta">
                  <div class="rl-type-badge">{{ TYPE_LABEL[detail.type] }}</div>
                  <h2 class="rl-modal-title">{{ detail.title }}</h2>
                  <div class="rl-modal-year">{{ releaseYear(detail) }}</div>
                  <div v-if="detail.is_upcoming && detail.presave_url" class="rl-presave-wrap">
                    <a :href="detail.presave_url" target="_blank" rel="noopener noreferrer" class="rl-presave-btn">
                      Pre-save
                    </a>
                  </div>
                  <p v-if="detail.description" class="rl-modal-desc">{{ detail.description }}</p>
                  <!-- Streaming links -->
                  <div v-if="detail.links.length" class="rl-links">
                    <a
                      v-for="link in detail.links"
                      :key="link.id"
                      :href="link.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="rl-link-btn"
                    >
                      {{ PLATFORM_LABELS[link.platform] ?? link.platform }}
                    </a>
                  </div>
                </div>
              </div>

              <!-- Tracklist -->
              <div v-if="detail.tracks.length" class="rl-tracks">
                <h3 class="rl-tracks-heading">Tracklist</h3>
                <ol class="rl-tracklist">
                  <li
                    v-for="(track, i) in detail.tracks.slice().sort((a, b) => a.sort_order - b.sort_order)"
                    :key="track.id"
                    class="rl-track"
                  >
                    <span class="rl-track-num">{{ i + 1 }}</span>
                    <span class="rl-track-title">{{ track.title }}</span>
                    <span v-if="track.duration" class="rl-track-dur">{{ track.duration }}</span>
                  </li>
                </ol>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.rl-page {
  min-height: calc(100vh - 56px);
  background: #fff;
  color: #111;
}

/* ── Header ──────────────────────────────────────────────── */
.rl-header {
  padding: 4rem 1.5rem 3rem;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}
.rl-header-inner { max-width: 960px; margin: 0 auto; }
.rl-eyebrow {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}
.rl-title {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700; color: #111; line-height: 1.2; margin-bottom: 0.5rem;
}
.rl-sub { font-size: 1rem; color: #888; }

/* ── State ───────────────────────────────────────────────── */
.rl-state { text-align: center; color: #888; padding: 4rem 1.5rem; }

/* ── Grid ────────────────────────────────────────────────── */
.rl-grid-wrap { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
.rl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.25rem;
}

/* ── Card ────────────────────────────────────────────────── */
.rl-card {
  background: none; border: none; padding: 0;
  cursor: pointer; text-align: left;
  border-radius: 0.75rem;
  transition: transform 150ms;
}
.rl-card:hover { transform: translateY(-3px); }

.rl-cover-wrap {
  position: relative;
  aspect-ratio: 1;
  background: #f0f0f0;
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  margin-bottom: 0.75rem;
}
.rl-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
.rl-cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #bbb;
}

.rl-upcoming-badge {
  position: absolute; top: 0.5rem; left: 0.5rem;
  background: #111; color: #fff;
  font-size: 0.625rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem; border-radius: 0.25rem;
}

.rl-card-info { padding: 0 0.25rem; }
.rl-type-badge {
  display: inline-block;
  font-size: 0.625rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: #555;
  margin-bottom: 0.25rem;
}
.rl-card-title {
  font-size: 0.9375rem; font-weight: 600; color: #111;
  line-height: 1.3; margin-bottom: 0.2rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.rl-card-year { font-size: 0.75rem; color: #888; }

/* ── Modal backdrop ──────────────────────────────────────── */
.rl-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
  overflow-y: auto;
}

.rl-modal {
  position: relative;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 1rem;
  width: 100%; max-width: 720px;
  padding: 2rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

.rl-modal-close {
  position: absolute; top: 1rem; right: 1rem;
  background: #f0f0f0; border: 1px solid #ddd;
  color: #333; font-size: 0.875rem;
  width: 32px; height: 32px; border-radius: 50%;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 150ms;
}
.rl-modal-close:hover { background: #e0e0e0; }

.rl-modal-loading { color: #888; text-align: center; padding: 2rem 0; }

/* ── Modal top (cover + meta) ────────────────────────────── */
.rl-modal-top {
  display: flex; gap: 1.5rem;
  margin-bottom: 2rem;
}
.rl-modal-cover-wrap {
  width: 160px; height: 160px; flex-shrink: 0;
  background: #f0f0f0; border-radius: 0.75rem; overflow: hidden;
  border: 1px solid #e0e0e0;
}
.rl-modal-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
.rl-modal-cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center; color: #bbb;
}

.rl-modal-meta { flex: 1; min-width: 0; }
.rl-modal-title {
  font-size: 1.5rem; font-weight: 700; color: #111;
  line-height: 1.2; margin: 0.375rem 0 0.25rem;
}
.rl-modal-year { font-size: 0.875rem; color: #888; margin-bottom: 0.75rem; }
.rl-modal-desc { font-size: 0.875rem; color: #555; line-height: 1.6; margin-bottom: 0.75rem; }

.rl-presave-wrap { margin-bottom: 0.75rem; }
.rl-presave-btn {
  display: inline-flex; align-items: center;
  padding: 0.5rem 1.25rem; border-radius: 0.5rem;
  font-size: 0.875rem; font-weight: 600;
  background: #111; color: #fff;
  text-decoration: none;
  transition: background 150ms;
}
.rl-presave-btn:hover { background: #333; }

/* ── Streaming links ─────────────────────────────────────── */
.rl-links { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.rl-link-btn {
  padding: 0.375rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.8125rem; font-weight: 500;
  background: #f0f0f0; color: #333;
  text-decoration: none; border: 1px solid #ddd;
  transition: background 150ms;
}
.rl-link-btn:hover { background: #e0e0e0; }

/* ── Tracklist ───────────────────────────────────────────── */
.rl-tracks { border-top: 1px solid #e0e0e0; padding-top: 1.25rem; }
.rl-tracks-heading {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}
.rl-tracklist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.rl-track {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 0.625rem; border-radius: 0.5rem;
  transition: background 120ms;
}
.rl-track:hover { background: #f5f5f5; }
.rl-track-num { width: 1.25rem; text-align: right; font-size: 0.8125rem; color: #888; flex-shrink: 0; }
.rl-track-title { flex: 1; font-size: 0.9rem; color: #111; }
.rl-track-dur { font-size: 0.75rem; color: #888; flex-shrink: 0; }

/* ── Mobile ──────────────────────────────────────────────── */
@media (max-width: 500px) {
  .rl-modal-top { flex-direction: column; }
  .rl-modal-cover-wrap { width: 100%; height: auto; aspect-ratio: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 200ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
