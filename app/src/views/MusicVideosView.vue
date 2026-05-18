<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { API_BASE, jsonHeaders } from '@/api/client'
import type { MusicVideo } from '@/types/musicVideo'

const { data, isPending } = useQuery<MusicVideo[]>({
  queryKey: ['music-videos-public'],
  queryFn: async () => {
    const res  = await fetch(`${API_BASE}/api/music-videos`, { headers: jsonHeaders })
    const json = await res.json() as { data: MusicVideo[] }
    return json.data.filter((v: MusicVideo) => !!v.published_at)
  },
})

const videos  = computed(() => data.value ?? [])

// Lightbox
const playing = ref<MusicVideo | null>(null)

function embedUrl(url: string): string {
  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}?autoplay=1`
  return url
}

function thumbnailUrl(v: MusicVideo): string | null {
  if (v.og_image) return v.og_image
  const ytMatch = v.video_url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/)
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
  return null
}
</script>

<template>
  <div class="mv-page">
    <header class="mv-header">
      <p class="mv-eyebrow">Music Videos</p>
      <h1 class="mv-title">Watch</h1>
    </header>

    <div v-if="isPending" class="mv-loading">Loading…</div>

    <div v-else-if="!videos.length" class="mv-empty">No videos published yet.</div>

    <div v-else class="mv-grid-wrap">
      <div class="mv-grid">
        <div
          v-for="v in videos"
          :key="v.id"
          class="mv-card"
          @click="playing = v"
          role="button"
          tabindex="0"
          @keyup.enter="playing = v"
        >
          <!-- Thumbnail -->
          <div class="mv-thumb-wrap">
            <img
              v-if="thumbnailUrl(v)"
              :src="thumbnailUrl(v)!"
              :alt="v.og_title || v.title"
              class="mv-thumb"
              loading="lazy"
            />
            <div v-else class="mv-thumb-placeholder">▶</div>
            <div class="mv-play-overlay">
              <div class="mv-play-btn">▶</div>
            </div>
          </div>

          <!-- Info -->
          <div class="mv-info">
            <div class="mv-video-title">{{ v.og_title || v.title }}</div>
            <div v-if="v.channel_name || v.og_site_name" class="mv-channel">
              {{ v.channel_name || v.og_site_name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="playing" class="lightbox-backdrop" @click.self="playing = null">
          <div class="lightbox-wrap">
            <button class="lightbox-close" @click="playing = null" aria-label="Close">✕</button>
            <div class="lightbox-title">{{ playing.og_title || playing.title }}</div>
            <div class="lightbox-embed">
              <iframe
                :src="embedUrl(playing.video_url)"
                frameborder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.mv-page {
  min-height: calc(100vh - 56px);
  background: #fff;
  color: #111;
}

/* ── Header ──────────────────────────────────────────────── */
.mv-header {
  padding: 4rem 1.5rem 3rem;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  max-width: 960px;
  margin: 0 auto;
}
.mv-eyebrow {
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #888; margin-bottom: 0.75rem;
}
.mv-title {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700; color: #111; line-height: 1.2;
}

.mv-loading, .mv-empty {
  text-align: center; color: #888;
  padding: 4rem 1.5rem; font-size: 0.9375rem;
}

/* ── Grid ────────────────────────────────────────────────── */
.mv-grid-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.mv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

.mv-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 0.875rem;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 150ms, transform 150ms;
}
.mv-card:hover { border-color: #bbb; transform: translateY(-2px); }

/* ── Thumbnail ───────────────────────────────────────────── */
.mv-thumb-wrap {
  position: relative;
  aspect-ratio: 16/9;
  background: #f0f0f0;
  overflow: hidden;
}
.mv-thumb {
  width: 100%; height: 100%; object-fit: cover;
  display: block;
  transition: transform 200ms;
}
.mv-card:hover .mv-thumb { transform: scale(1.03); }

.mv-thumb-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; color: #bbb;
}

.mv-play-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.25);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 150ms;
}
.mv-card:hover .mv-play-overlay { opacity: 1; }

.mv-play-btn {
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.125rem; color: #fff;
  padding-left: 3px;
}

/* ── Info ────────────────────────────────────────────────── */
.mv-info { padding: 0.875rem 1rem; }
.mv-video-title {
  font-size: 0.9375rem; font-weight: 600; color: #111;
  line-height: 1.4; margin-bottom: 0.25rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.mv-channel { font-size: 0.75rem; color: #888; }

/* ── Lightbox ────────────────────────────────────────────── */
.lightbox-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.88);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.lightbox-wrap {
  width: 100%;
  max-width: 900px;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.lightbox-close {
  align-self: flex-end;
  background: #fff; border: 1px solid #ddd;
  color: #333; font-size: 0.875rem;
  width: 32px; height: 32px; border-radius: 50%;
  cursor: pointer; transition: background 150ms;
  display: flex; align-items: center; justify-content: center;
}
.lightbox-close:hover { background: #f0f0f0; }
.lightbox-title {
  font-size: 1rem; font-weight: 600; color: #fff; text-align: center;
}
.lightbox-embed {
  position: relative; padding-top: 56.25%;
  background: #000; border-radius: 0.5rem; overflow: hidden;
}
.lightbox-embed iframe {
  position: absolute; inset: 0; width: 100%; height: 100%;
}

.fade-enter-active, .fade-leave-active { transition: opacity 200ms; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
