<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { fetchPressReleases } from '@/api/press-releases'

const query = useQuery({
  queryKey: ['press-releases'],
  queryFn: fetchPressReleases,
})

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
</script>

<template>
  <main class="press-page">
    <div class="press-header">
      <h1 class="press-heading">Press</h1>
      <p class="press-sub">Articles and coverage from around the web</p>
    </div>

    <div v-if="query.isPending.value" class="press-loading">Loading…</div>
    <div v-else-if="query.isError.value" class="press-error">Failed to load press releases.</div>
    <div v-else-if="!query.data.value?.length" class="press-empty">No press coverage yet.</div>

    <div v-else class="press-grid">
      <a
        v-for="pr in query.data.value"
        :key="pr.id"
        :href="pr.url"
        target="_blank"
        rel="noopener noreferrer"
        class="pr-card"
      >
        <div class="pr-img-wrap">
          <img
            v-if="pr.og_image"
            :src="pr.og_image"
            :alt="pr.og_title ?? ''"
            class="pr-img"
            loading="lazy"
            @error="($event.target as HTMLImageElement).parentElement!.classList.add('no-img')"
          />
          <div v-else class="pr-img-placeholder">📰</div>
        </div>

        <div class="pr-body">
          <div class="pr-meta-row">
            <span class="pr-source">{{ pr.og_site_name ?? hostname(pr.url) }}</span>
            <span v-if="pr.published_at" class="pr-date">{{ formatDate(pr.published_at) }}</span>
          </div>
          <h2 class="pr-title">{{ pr.og_title ?? pr.url }}</h2>
          <p v-if="pr.og_description" class="pr-desc">{{ pr.og_description }}</p>
          <div v-if="pr.tags?.length" class="pr-tags">
            <span v-for="t in pr.tags" :key="t.id" class="pr-tag">{{ t.name }}</span>
          </div>
          <div class="pr-read">Read article →</div>
        </div>
      </a>
    </div>
  </main>
</template>

<style scoped>
.press-page    { max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
.press-header  { margin-bottom: 2.5rem; }
.press-heading { font-size: 2rem; font-weight: 700; color: #e2e8f0; margin: 0 0 0.375rem; }
.press-sub     { font-size: 0.9375rem; color: #64748b; margin: 0; }
.press-loading, .press-error, .press-empty {
  text-align: center; color: #475569; padding: 4rem 0; font-size: 0.9375rem;
}
.press-error { color: #f87171; }

.press-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.pr-card {
  display: flex; flex-direction: column;
  background: #0e0c2a; border: 1px solid #1e1a4a; border-radius: 0.75rem;
  overflow: hidden; text-decoration: none; transition: border-color 150ms, transform 150ms;
}
.pr-card:hover { border-color: #4338ca; transform: translateY(-2px); }

.pr-img-wrap { width: 100%; aspect-ratio: 16/9; overflow: hidden; background: #111128; flex-shrink: 0; }
.pr-img      { width: 100%; height: 100%; object-fit: cover; display: block; }
.pr-img-wrap.no-img .pr-img { display: none; }
.pr-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2rem; }

.pr-body    { padding: 1rem 1.125rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
.pr-meta-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.pr-source   { font-size: 0.72rem; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.06em; }
.pr-date     { font-size: 0.72rem; color: #475569; white-space: nowrap; }
.pr-title    {
  font-size: 0.9375rem; font-weight: 600; color: #e2e8f0; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  margin: 0;
}
.pr-desc {
  font-size: 0.8125rem; color: #64748b; line-height: 1.55;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  margin: 0;
}
.pr-tags   { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: auto; }
.pr-tag {
  display: inline-block; padding: 0.1rem 0.45rem; border-radius: 0.25rem;
  background: #1e1b4b; color: #818cf8; font-size: 0.65rem; font-weight: 500;
}
.pr-read {
  font-size: 0.78rem; font-weight: 600; color: #6366f1; margin-top: 0.25rem;
  transition: color 120ms;
}
.pr-card:hover .pr-read { color: #818cf8; }
</style>
