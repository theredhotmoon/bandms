<script setup lang="ts">
import { ref, computed } from 'vue'

interface Tag { id: number; name: string; slug: string }

interface PostSummary {
  id: number
  title: string
  intro: string | null
  excerpt: string
  published_at: string | null
  created_at: string
  tags: Tag[]
}

const props = defineProps<{
  posts: PostSummary[]
  accent: string
}>()

const q   = ref('')
const tag = ref('all')

const allTags = computed(() => {
  const seen = new Map<string, string>()
  props.posts.forEach(p => p.tags.forEach(t => seen.set(t.slug, t.name)))
  return [...seen.entries()].map(([slug, name]) => ({ slug, name }))
})

const matched = computed(() => props.posts.filter(p => {
  const okTag = tag.value === 'all' || p.tags.some(t => t.slug === tag.value)
  const hay = ((p.title ?? '') + ' ' + (p.intro ?? '')).toLowerCase()
  const okQ  = !q.value.trim() || hay.includes(q.value.trim().toLowerCase())
  return okTag && okQ
}))

const featured = computed(() => matched.value[0] ?? null)
const rest     = computed(() => matched.value.slice(1))

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${mo[d.getMonth()]} ${d.getFullYear()}`
}

function postDate(p: PostSummary): string {
  return fmtDate(p.published_at ?? p.created_at)
}
</script>

<template>
  <div class="nf-root">
    <!-- SEARCH + TAGS ROW -->
    <section class="nf-controls">
      <div class="nf-tags">
        <button
          class="nf-tag-btn"
          :class="{ active: tag === 'all' }"
          type="button"
          @click="tag = 'all'"
        >All</button>
        <button
          v-for="t in allTags"
          :key="t.slug"
          class="nf-tag-btn"
          :class="{ active: tag === t.slug }"
          type="button"
          @click="tag = t.slug"
        >{{ t.name }}</button>
      </div>
      <div class="nf-search-wrap">
        <svg class="nf-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>
        </svg>
        <input
          v-model="q"
          class="nf-search"
          type="search"
          placeholder="Search posts…"
          aria-label="Search posts"
        />
      </div>
    </section>

    <!-- NO RESULTS -->
    <div v-if="matched.length === 0" class="nf-empty">
      No posts match your search.
    </div>

    <!-- FEATURED POST -->
    <section v-if="featured" class="nf-featured-wrap">
      <a :href="`/posts/${featured.id}`" class="nf-featured">
        <div class="nf-feat-img">
          <div class="nf-placeholder nf-placeholder--dark" aria-hidden="true" />
          <span class="nf-feat-badge" :style="{ background: accent }">Featured</span>
        </div>
        <div class="nf-feat-body">
          <div class="nf-chip-row">
            <span
              v-for="tg in featured.tags.slice(0, 3)"
              :key="tg.id"
              class="nf-chip"
              :style="{ color: accent, borderColor: accent }"
            >{{ tg.name }}</span>
          </div>
          <h2 class="nf-feat-title">{{ featured.title }}</h2>
          <p class="nf-feat-intro">{{ featured.intro ?? featured.excerpt }}</p>
          <div class="nf-feat-meta">
            <span class="nf-meta-date">{{ postDate(featured) }}</span>
            <span class="nf-read-full" :style="{ color: accent }">
              Read full story
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </span>
          </div>
        </div>
      </a>
    </section>

    <!-- GRID -->
    <section v-if="rest.length > 0" class="nf-grid-wrap">
      <div class="nf-grid">
        <a
          v-for="p in rest"
          :key="p.id"
          :href="`/posts/${p.id}`"
          class="nf-card"
        >
          <div class="nf-card-img">
            <div class="nf-placeholder nf-placeholder--dark" aria-hidden="true" />
          </div>
          <div class="nf-card-body">
            <div class="nf-chip-row">
              <span
                v-for="tg in p.tags.slice(0, 2)"
                :key="tg.id"
                class="nf-chip"
                :style="{ color: accent, borderColor: accent }"
              >{{ tg.name }}</span>
            </div>
            <h3 class="nf-card-title">{{ p.title }}</h3>
            <p class="nf-card-intro">{{ p.intro ?? p.excerpt }}</p>
            <span class="nf-card-date">{{ postDate(p) }}</span>
          </div>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.nf-root {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* CONTROLS */
.nf-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 40px 90px 8px;
}
.nf-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.nf-tag-btn {
  background: transparent;
  color: #121212;
  border: 3px solid #121212;
  font-family: 'Anton', sans-serif;
  font-size: 16px;
  line-height: 1;
  text-transform: uppercase;
  padding: 9px 15px;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.nf-tag-btn.active,
.nf-tag-btn:hover {
  background: #121212;
  color: #EFE7D6;
}
.nf-search-wrap {
  position: relative;
  min-width: 280px;
}
.nf-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.nf-search {
  width: 100%;
  box-sizing: border-box;
  border: 3px solid #121212;
  padding: 13px 16px 13px 44px;
  font: 600 15px/1 'Archivo', sans-serif;
  outline: none;
  background: #fff;
  color: #121212;
}
.nf-search::-webkit-search-cancel-button { cursor: pointer; }

/* EMPTY */
.nf-empty {
  margin: 28px 90px 56px;
  border: 3px dashed #121212;
  padding: 60px 30px;
  text-align: center;
  font-family: 'Anton', sans-serif;
  font-size: clamp(20px, 3vw, 28px);
  text-transform: uppercase;
  color: #888;
}

/* FEATURED */
.nf-featured-wrap {
  padding: 28px 90px 16px;
}
.nf-featured {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  border: 3px solid #121212;
  background: #fff;
  text-decoration: none;
  color: #121212;
  box-shadow: v-bind("'10px 10px 0 ' + accent");
  transition: box-shadow .15s;
}
.nf-featured:hover {
  box-shadow: v-bind("'14px 14px 0 ' + accent");
}
.nf-feat-img {
  position: relative;
  border-right: 3px solid #121212;
  min-height: 320px;
  overflow: hidden;
}
.nf-placeholder {
  position: absolute;
  inset: 0;
}
.nf-placeholder--dark {
  background: repeating-linear-gradient(
    45deg,
    #1b1b1b,
    #1b1b1b 9px,
    #222 9px,
    #222 18px
  );
}
.nf-placeholder--light {
  background: repeating-linear-gradient(
    45deg,
    #dcd3c0,
    #dcd3c0 9px,
    #e6ddca 9px,
    #e6ddca 18px
  );
}
.nf-feat-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  color: #fff;
  font: 800 11px/1 'Archivo', sans-serif;
  letter-spacing: .12em;
  text-transform: uppercase;
  padding: 7px 11px;
  z-index: 1;
}
.nf-feat-body {
  padding: 32px 34px;
  display: flex;
  flex-direction: column;
}
.nf-chip-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.nf-chip {
  font: 800 10px/1 'Archivo', sans-serif;
  letter-spacing: .1em;
  text-transform: uppercase;
  border: 2px solid;
  padding: 5px 8px;
  white-space: nowrap;
}
.nf-feat-title {
  font-family: 'Anton', sans-serif;
  font-size: clamp(32px, 4vw, 46px);
  line-height: .95;
  letter-spacing: .01em;
  text-transform: uppercase;
  margin: 0 0 16px;
  color: #121212;
  text-wrap: balance;
}
.nf-feat-intro {
  font: 500 18px/1.55 'Archivo', sans-serif;
  color: #333;
  margin: 0 0 20px;
  flex: 1;
}
.nf-feat-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.nf-meta-date {
  font: 700 13px/1 'Archivo', sans-serif;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: #888;
}
.nf-read-full {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'Anton', sans-serif;
  font-size: 16px;
  text-transform: uppercase;
}

/* GRID */
.nf-grid-wrap {
  padding: 20px 90px 56px;
}
.nf-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.nf-card {
  border: 3px solid #121212;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  text-decoration: none;
  color: #121212;
  transition: box-shadow .14s;
}
.nf-card:hover {
  box-shadow: v-bind("'6px 6px 0 ' + accent");
}
.nf-card-img {
  position: relative;
  border-bottom: 3px solid #121212;
  height: 180px;
  overflow: hidden;
  flex-shrink: 0;
}
.nf-card-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.nf-card-title {
  font-family: 'Anton', sans-serif;
  font-size: clamp(20px, 2.5vw, 25px);
  line-height: 1.02;
  letter-spacing: .01em;
  text-transform: uppercase;
  margin: 0 0 10px;
  color: #121212;
}
.nf-card-intro {
  font: 500 14px/1.5 'Archivo', sans-serif;
  color: #555;
  margin: 0 0 16px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nf-card-date {
  font: 700 12px/1 'Archivo', sans-serif;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: #999;
  margin-top: auto;
}

/* RESPONSIVE */
@media (max-width: 1100px) {
  .nf-controls { padding: 36px 40px 8px; }
  .nf-empty { margin: 28px 40px 56px; }
  .nf-featured-wrap { padding: 28px 40px 16px; }
  .nf-grid-wrap { padding: 20px 40px 56px; }
}
@media (max-width: 768px) {
  .nf-controls { padding: 28px 24px 8px; flex-direction: column; align-items: stretch; }
  .nf-search-wrap { min-width: unset; }
  .nf-empty { margin: 24px 24px 40px; }
  .nf-featured-wrap { padding: 24px 24px 16px; }
  .nf-featured { grid-template-columns: 1fr; }
  .nf-feat-img { min-height: 220px; border-right: none; border-bottom: 3px solid #121212; }
  .nf-feat-body { padding: 22px 22px; }
  .nf-grid-wrap { padding: 16px 24px 40px; }
  .nf-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 520px) {
  .nf-grid { grid-template-columns: 1fr; }
}
</style>
