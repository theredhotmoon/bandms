<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { formatEventDates, fmtDateShort, postSlug } from '@/lib/i18n'
import type { Locale } from '@/types/shared'
import type { PostSummary } from '@/types/post'
import { fetchPostBatch, MAX_BATCH } from '@/lib/postFeed'
import { DEFAULT_LOCALE } from '@/lib/locales'
import ShowMoreButton from './ShowMoreButton.vue'

export interface NewsFilterCopy {
  all: string
  searchPlaceholder: string
  searchLabel: string
  noMatch: string
  featured: string
  readFull: string
  event: string
}

export interface NewsTag { id: number; slug: string; name: string }

const props = defineProps<{
  /**
   * The post on top: highlighted in the admin, else the newest. Decided at
   * build time and never filtered — it stays whatever the visitor picks.
   */
  featured: PostSummary | null
  /** The grid's first batch, baked into the page. */
  initialPosts: PostSummary[]
  /** Where "Show more" picks up after it; null when that batch was the last. */
  initialCursor: string | null
  /** When this page was built — see PostBatchQuery.builtAt. */
  builtAt: string
  /** Every tag on a published post — more than the first batch carries. */
  tags: NewsTag[]
  accent: string
  /**
   * Locale-aware base for a post URL, e.g. `/pl/aktualnosci`. Required, and
   * deliberately has no default: post pages are emitted at
   * `/[lang]/[section]/[postSlug]`, so any guessed base (the old `/posts`
   * fallback) builds a URL nothing renders — a silent 404 the build cannot see.
   */
  postHrefBase: string
  lang?: Locale
  /** Labels from the News module's copy — see PostsSection.astro. */
  copy: NewsFilterCopy
  /**
   * Grid cards per batch (the featured post is extra) — Website Modules →
   * News → Items per page. Null ("Default") baked them all; a filter then
   * fetches in the API's largest batches.
   */
  perPage?: number | null
  /** Site-wide "Show more" strings (the `site` module's copy). */
  showMoreLabel: string
  showMoreLoading: string
  showMoreError: string
  /** A tag or a search failed — the list on screen is not its answer. */
  listLoadError: string
  tryAgainLabel: string
}>()

const lang = computed<Locale>(() => props.lang ?? DEFAULT_LOCALE)
const href = (p: PostSummary) => `${props.postHrefBase}/${postSlug(p, lang.value)}`

const q   = ref('')
const tag = ref('all')

// ── The grid, a batch at a time from the API ──────────────────
// Only the first batch is in the page. "Show more" asks the API for the
// posts after the last one shown; a tag or a search asks for a fresh first
// batch. The featured post is excluded server-side, so it is never repeated.
const posts   = ref<PostSummary[]>(props.initialPosts)
const cursor  = ref<string | null>(props.initialCursor)
const loading = ref(false)
/** A fresh list (tag, search) is on its way; the cards on screen are the old answer. */
const refreshing = ref(false)
/** Set when the last request failed: true for a fresh list, false for "more". */
const failed  = ref<boolean | null>(null)
const batch   = computed(() => props.perPage && props.perPage > 0 ? props.perPage : MAX_BATCH)

const tagId = computed(() => props.tags.find(t => t.slug === tag.value)?.id ?? null)
// The search box asks the server, so it waits for a pause in typing.
const searchTerm = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(q, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { searchTerm.value = value.trim() }, 300)
})
const filtered = computed(() => tagId.value !== null || searchTerm.value !== '')

// A request superseded by a newer one (typing on, another tag) is dropped
// when it lands, so a slow answer can never overwrite a newer list.
let request = 0
let controller: AbortController | null = null

async function load(fresh: boolean) {
  const mine = ++request
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  refreshing.value = fresh
  failed.value = null
  try {
    const next = await fetchPostBatch('', {
      lang: lang.value,
      limit: batch.value,
      exclude: props.featured?.id,
      cursor: fresh ? null : cursor.value,
      tagId: tagId.value,
      search: searchTerm.value,
      builtAt: props.builtAt,
    }, { signal: controller.signal })
    if (mine !== request) return
    const shown = posts.value.length
    posts.value = fresh ? next.posts : [...posts.value, ...next.posts]
    cursor.value = next.nextCursor
    if (!fresh) void focusCard(shown)
  } catch {
    if (mine !== request) return
    failed.value = fresh
    // A fresh list that failed must not leave the previous one standing
    // under the new filter, where its cards would read as matches.
    if (fresh) { posts.value = []; cursor.value = null }
  } finally {
    if (mine === request) { loading.value = false; refreshing.value = false }
  }
}

watch([tagId, searchTerm], () => {
  if (filtered.value) return void load(true)
  // Back to everything: the baked first batch is that list, no request needed.
  request++
  controller?.abort()
  posts.value = props.initialPosts
  cursor.value = props.initialCursor
  loading.value = false
  refreshing.value = false
  failed.value = null
})

// Not while a fresh list loads: the old list's cursor would fetch its next
// batch, not the new filter's.
const hasMore = computed(() => !refreshing.value && (cursor.value !== null || failed.value !== null))
function showMore() {
  if (loading.value) return
  void load(failed.value === true)
}

// The button may be gone after the last batch, and focus would drop to
// <body>; it moves to the first new card instead.
async function focusCard(index: number) {
  await nextTick()
  root.value?.querySelectorAll<HTMLElement>('#news-grid .nf-card')[index]?.focus()
}

onBeforeUnmount(() => { clearTimeout(searchTimer); controller?.abort() })

// ── ?tag=<slug> ───────────────────────────────────────────────
// A tag on an article links here with ?tag=, so the list opens filtered.
// Read on mount, not during render: the island is server-rendered at build
// time, when there is no URL to read.
onMounted(() => {
  const wanted = new URLSearchParams(window.location.search).get('tag')
  if (wanted && props.tags.some(t => t.slug === wanted)) tag.value = wanted
})
watch(tag, (slug) => {
  const url = new URL(window.location.href)
  if (slug === 'all') url.searchParams.delete('tag')
  else url.searchParams.set('tag', slug)
  history.replaceState(history.state, '', url)
})

// ── One-line tag rows ─────────────────────────────────────────
// Every tag shows, on one line. A row wider than its card gets
// data-overflow and the distance to travel; hovering the card then slides the
// hidden tags into view (CSS below). Measured, because only the browser knows
// how wide a row of translated, theme-fonted chips actually is.
const root = ref<HTMLElement | null>(null)

function measureTagRows() {
  root.value?.querySelectorAll<HTMLElement>('.nf-chip-row').forEach(row => {
    const track = row.firstElementChild as HTMLElement | null
    if (!track) return
    const overflow = track.scrollWidth - row.clientWidth
    if (overflow > 1) {
      row.dataset.overflow = ''
      row.style.setProperty('--tag-shift', `-${overflow}px`)
      // ~60px per second, so a long row does not whip past.
      row.style.setProperty('--tag-duration', `${Math.max(0.6, overflow / 60)}s`)
    } else {
      delete row.dataset.overflow
    }
  })
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  measureTagRows()
  resizeObserver = new ResizeObserver(() => measureTagRows())
  if (root.value) resizeObserver.observe(root.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

watch(posts, () => nextTick(measureTagRows))

function postDate(p: PostSummary): string {
  return fmtDateShort(p.published_at ?? p.created_at, lang.value)
}

function eventDate(p: PostSummary): string {
  return formatEventDates(p.event_dates ?? [], p.event_date_display ?? 'range', lang.value)
}
</script>

<template>
  <div ref="root" class="nf-root">
    <!-- SEARCH + TAGS ROW -->
    <section class="nf-controls page-content">
      <div class="nf-tags">
        <button
          class="nf-tag-btn"
          :class="{ active: tag === 'all' }"
          type="button"
          @click="tag = 'all'"
        >{{ copy.all }}</button>
        <button
          v-for="t in tags"
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
          :placeholder="copy.searchPlaceholder"
          :aria-label="copy.searchLabel"
        />
      </div>
    </section>

    <!-- FEATURED POST — never filtered, see the prop -->
    <section v-if="featured" class="nf-featured-wrap page-content">
      <a :href="href(featured)" class="nf-featured" data-testid="news-featured">
        <div class="nf-feat-img">
          <img v-if="featured.image" :src="featured.image" alt="" class="nf-img" loading="eager" />
          <div v-else class="nf-placeholder nf-placeholder--dark" aria-hidden="true" />
          <span class="nf-feat-badge" :style="{ background: accent }">{{ copy.featured }}</span>
        </div>
        <div class="nf-feat-body">
          <div class="nf-chip-row" data-testid="news-card-tags">
            <span class="nf-chip-track">
              <span
                v-for="tg in featured.tags"
                :key="tg.id"
                class="nf-chip"
                :style="{ color: accent, borderColor: accent }"
              >{{ tg.name }}</span>
            </span>
          </div>
          <h2 class="nf-feat-title">{{ featured.title }}</h2>
          <p class="nf-feat-intro">{{ featured.intro ?? featured.excerpt }}</p>
          <div class="nf-feat-meta">
            <span class="nf-meta-date">{{ postDate(featured) }}</span>
            <span v-if="eventDate(featured)" class="nf-meta-date" :style="{ color: accent }">{{ copy.event }}: {{ eventDate(featured) }}</span>
            <span class="nf-read-full" :style="{ color: accent }">
              {{ copy.readFull }}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </span>
          </div>
        </div>
      </a>
    </section>

    <!-- NO RESULTS — not while a fresh list is still on its way -->
    <div v-if="posts.length === 0 && !loading && failed === null && (filtered || !featured)" class="page-content">
      <div class="nf-empty">
        {{ copy.noMatch }}
      </div>
    </div>

    <!-- GRID -->
    <section v-if="posts.length > 0 || hasMore" class="nf-grid-wrap page-content">
      <div id="news-grid" class="nf-grid" :class="{ 'nf-grid--stale': refreshing }" :aria-busy="loading">
        <a
          v-for="p in posts"
          :key="p.id"
          :href="href(p)"
          class="nf-card"
        >
          <div class="nf-card-img">
            <img v-if="p.image" :src="p.image" alt="" class="nf-img" loading="lazy" />
            <div v-else class="nf-placeholder nf-placeholder--dark" aria-hidden="true" />
          </div>
          <div class="nf-card-body">
            <div class="nf-chip-row" data-testid="news-card-tags">
              <span class="nf-chip-track">
                <span
                  v-for="tg in p.tags"
                  :key="tg.id"
                  class="nf-chip"
                  :style="{ color: accent, borderColor: accent }"
                >{{ tg.name }}</span>
              </span>
            </div>
            <h3 class="nf-card-title">{{ p.title }}</h3>
            <p class="nf-card-intro">{{ p.intro ?? p.excerpt }}</p>
            <span class="nf-card-date">{{ postDate(p) }}</span>
            <span v-if="eventDate(p)" class="nf-card-date" :style="{ color: accent }">{{ copy.event }}: {{ eventDate(p) }}</span>
          </div>
        </a>
      </div>
      <p v-if="failed !== null" class="nf-load-error" role="alert">{{ failed ? listLoadError : showMoreError }}</p>
      <ShowMoreButton
        v-if="hasMore"
        list="news-grid"
        :label="loading ? showMoreLoading : failed ? tryAgainLabel : showMoreLabel"
        :busy="loading"
        @click="showMore"
      />
    </section>
  </div>
</template>

<style scoped>
/* Width comes from the global .page-content on each band below — limited or
   full, per the admin. */
.nf-root {
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
  padding-block: 40px 8px;
}
.nf-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.nf-tag-btn {
  background: transparent;
  color: var(--color-ink);
  border: 3px solid var(--color-ink);
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1;
  text-transform: uppercase;
  padding: 9px 15px;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.nf-tag-btn.active,
.nf-tag-btn:hover {
  background: var(--color-ink);
  color: var(--color-page);
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
  border: 3px solid var(--color-ink);
  padding: 13px 16px 13px 44px;
  font: 600 15px/1 var(--font-body);
  outline: none;
  background: var(--color-surface);
  color: var(--color-ink);
}
.nf-search::-webkit-search-cancel-button { cursor: pointer; }

/* A tag or search is loading: the cards are the previous answer, so they
   fade rather than read as matches. */
.nf-grid--stale {
  opacity: 0.4;
  pointer-events: none;
  transition: opacity .15s;
}

/* SHOW MORE FAILED */
.nf-load-error {
  margin: 28px 0 0;
  text-align: center;
  font-weight: 600;
  color: var(--color-ink);
}

/* EMPTY */
.nf-empty {
  margin: 28px 0 56px;
  border: 3px dashed var(--color-ink);
  padding: 60px 30px;
  text-align: center;
  font-family: var(--font-display);
  font-size: clamp(20px, 3vw, 28px);
  text-transform: uppercase;
  color: var(--color-subtle);
}

/* FEATURED */
.nf-featured-wrap {
  padding-block: 28px 16px;
}
.nf-featured {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  border: 3px solid var(--color-ink);
  background: var(--color-surface);
  text-decoration: none;
  color: var(--color-ink);
  box-shadow: v-bind("'10px 10px 0 ' + accent");
  transition: box-shadow .15s;
}
.nf-featured:hover {
  box-shadow: v-bind("'14px 14px 0 ' + accent");
}
.nf-feat-img {
  position: relative;
  border-right: 3px solid var(--color-ink);
  min-height: 320px;
  overflow: hidden;
}
.nf-placeholder {
  position: absolute;
  inset: 0;
}
/* The card's main image — decorative, the title beside it carries the meaning */
.nf-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.nf-placeholder--dark {
  background: repeating-linear-gradient(
    45deg,
    var(--color-ink),
    var(--color-ink) 9px,
    var(--color-body) 9px,
    var(--color-body) 18px
  );
}
.nf-placeholder--light {
  background: repeating-linear-gradient(
    45deg,
    color-mix(in oklab, var(--color-page) 92%, black),
    color-mix(in oklab, var(--color-page) 92%, black) 9px,
    color-mix(in oklab, var(--color-page) 97%, black) 9px,
    color-mix(in oklab, var(--color-page) 97%, black) 18px
  );
}
.nf-feat-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  color: var(--color-on-accent);
  font: 800 11px/1 var(--font-body);
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
/* One line, always. Overflowing tags slide in on hover — see measureTagRows(). */
.nf-chip-row {
  overflow: hidden;
  margin-bottom: 16px;
}
.nf-chip-row[data-overflow] {
  -webkit-mask-image: linear-gradient(to right, #000 85%, transparent); /* token-lint-ignore: mask alpha, not a colour */
  mask-image: linear-gradient(to right, #000 85%, transparent); /* token-lint-ignore: mask alpha, not a colour */
}
.nf-chip-track {
  display: inline-flex;
  gap: 8px;
  flex-wrap: nowrap;
  transform: translateX(0);
  transition: transform .3s ease-out;
}
:is(.nf-card, .nf-featured):is(:hover, :focus-visible) .nf-chip-row[data-overflow] {
  -webkit-mask-image: none;
  mask-image: none;
}
:is(.nf-card, .nf-featured):is(:hover, :focus-visible) .nf-chip-row[data-overflow] .nf-chip-track {
  transform: translateX(var(--tag-shift, 0));
  transition: transform var(--tag-duration, 1.5s) linear .2s;
}
@media (prefers-reduced-motion: reduce) {
  .nf-chip-track { transition: none !important; }
  :is(.nf-card, .nf-featured):is(:hover, :focus-visible) .nf-chip-row[data-overflow] .nf-chip-track { transform: none; }
  .nf-chip-row[data-overflow] { overflow-x: auto; -webkit-mask-image: none; mask-image: none; }
}
.nf-chip {
  font: 800 10px/1 var(--font-body);
  letter-spacing: .1em;
  text-transform: uppercase;
  border: 2px solid;
  padding: 5px 8px;
  flex-shrink: 0;
  white-space: nowrap;
}
.nf-feat-title {
  font-family: var(--font-display);
  font-size: clamp(32px, 4vw, 46px);
  line-height: .95;
  letter-spacing: .01em;
  text-transform: uppercase;
  margin: 0 0 16px;
  color: var(--color-ink);
  text-wrap: balance;
}
.nf-feat-intro {
  font: 500 18px/1.55 var(--font-body);
  color: var(--color-body);
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
  font: 700 13px/1 var(--font-body);
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--color-subtle);
}
.nf-read-full {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: 16px;
  text-transform: uppercase;
}

/* GRID */
.nf-grid-wrap {
  padding-block: 20px 56px;
}
/* minmax(0, …), never a bare 1fr: 1fr means minmax(auto, 1fr), so a card's
   one-line tag row would set its column's minimum and widen that card past
   its neighbours — and, widened, the row would never overflow, so the
   hover-scroll above never engaged. */
.nf-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.nf-card {
  min-width: 0;
  border: 3px solid var(--color-ink);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  text-decoration: none;
  color: var(--color-ink);
  transition: box-shadow .14s;
}
.nf-card:hover {
  box-shadow: v-bind("'6px 6px 0 ' + accent");
}
.nf-card-img {
  position: relative;
  border-bottom: 3px solid var(--color-ink);
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
  font-family: var(--font-display);
  font-size: clamp(20px, 2.5vw, 25px);
  line-height: 1.02;
  letter-spacing: .01em;
  text-transform: uppercase;
  margin: 0 0 10px;
  color: var(--color-ink);
}
.nf-card-intro {
  font: 500 14px/1.5 var(--font-body);
  color: var(--color-muted);
  margin: 0 0 16px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nf-card-date {
  font: 700 12px/1 var(--font-body);
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--color-subtle);
  margin-top: auto;
}

/* RESPONSIVE */
@media (max-width: 1100px) {
  .nf-controls { padding: 36px 40px 8px; }
  .nf-empty { margin: 28px 0 56px; }
  .nf-featured-wrap { padding: 28px 40px 16px; }
  .nf-grid-wrap { padding: 20px 40px 56px; }
}
@media (max-width: 768px) {
  .nf-controls { padding: 28px 24px 8px; flex-direction: column; align-items: stretch; }
  .nf-search-wrap { min-width: unset; }
  .nf-empty { margin: 24px 24px 40px; }
  .nf-featured-wrap { padding: 24px 24px 16px; }
  .nf-featured { grid-template-columns: minmax(0, 1fr); }
  .nf-feat-img { min-height: 220px; border-right: none; border-bottom: 3px solid var(--color-ink); }
  .nf-feat-body { padding: 22px 22px; }
  .nf-grid-wrap { padding: 16px 24px 40px; }
  .nf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 520px) {
  .nf-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
