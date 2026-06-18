<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePosts } from '@/composables/usePosts'
import { useTags } from '@/composables/useTags'
import { useLang } from '@/composables/useLang'
import SiteNav from '@/components/public/SiteNav.vue'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'
import type { PostFilters } from '@/api/posts'

const { lang } = useLang()
const router = useRouter()

// Filters
const search = ref('')
const activeTag = ref<number | null>(null)
const filters = ref<PostFilters>({})

watch([search, activeTag], () => {
  filters.value = {
    ...(search.value.trim() ? { search: search.value.trim() } : {}),
    ...(activeTag.value !== null ? { tag_id: activeTag.value } : {}),
  }
}, { immediate: true })

const { query: postsQ } = usePosts(filters)
const { query: tagsQ } = useTags()

const posts = computed(() => postsQ.data.value?.data ?? [])
const tags = computed(() => tagsQ.data.value ?? [])

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const T = {
  en: {
    heroTitle: 'News',
    heroSub: 'Studio sessions, new releases, tour stories and announcements — all right here.',
    searchPh: 'Search posts…',
    all: 'All',
    noPosts: 'No posts found.',
    loading: 'Loading…',
    readMore: 'Read more →',
    featured: 'Featured',
  },
  pl: {
    heroTitle: 'Aktualności',
    heroSub: 'Sesje studyjne, nowe wydania, opowieści z trasy i ogłoszenia — wszystko tutaj.',
    searchPh: 'Szukaj wpisów…',
    all: 'Wszystkie',
    noPosts: 'Nie znaleziono wpisów.',
    loading: 'Ładowanie…',
    readMore: 'Czytaj więcej →',
    featured: 'Wyróżniony',
  },
}
const t = computed(() => T[lang.value])

function goToPost(id: number) {
  router.push(`/posts/${id}`)
}
</script>

<template>
  <div class="posts-page">
    <SiteNav active="news" />
    <main>
    <!-- HERO -->
    <section class="hero">
      <div class="hero-checker" />
      <div class="hero-inner">
        <span class="hero-kicker">BLOG · NEWS</span>
        <h1 class="hero-title">{{ t.heroTitle }}</h1>
        <p class="hero-sub">{{ t.heroSub }}</p>
      </div>
    </section>

    <!-- SEARCH + FILTERS -->
    <div class="toolbar">
      <div class="search-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
        <input v-model="search" type="search" :placeholder="t.searchPh" class="search-input" />
      </div>
      <div class="tag-filters">
        <button
          class="tag-btn"
          :class="{ 'tag-btn--active': activeTag === null }"
          @click="activeTag = null"
        >{{ t.all }}</button>
        <button
          v-for="tag in tags"
          :key="tag.id"
          class="tag-btn"
          :class="{ 'tag-btn--active': activeTag === tag.id }"
          @click="activeTag = tag.id"
        >{{ tag.name }}</button>
      </div>
    </div>

    <!-- POSTS -->
    <section class="posts-section">
      <div v-if="postsQ.isPending.value" class="loading">{{ t.loading }}</div>

      <template v-else-if="posts.length">
        <!-- Featured (first post) -->
        <article class="featured-post" @click="goToPost(posts[0].id)">
          <div class="featured-img">
            <div class="img-placeholder-dark" />
            <span class="feat-label">{{ t.featured }}</span>
            <span v-if="posts[0].tags.length" class="post-tag">{{ posts[0].tags[0].name }}</span>
          </div>
          <div class="featured-body">
            <span class="post-date">{{ formatDate(posts[0].published_at ?? posts[0].created_at) }}</span>
            <h2 class="featured-title">{{ posts[0].title }}</h2>
            <p class="featured-excerpt">{{ posts[0].excerpt }}</p>
            <span class="read-more">{{ t.readMore }}</span>
          </div>
        </article>

        <!-- Grid -->
        <div v-if="posts.length > 1" class="posts-grid">
          <article
            v-for="post in posts.slice(1)"
            :key="post.id"
            class="post-card"
            @click="goToPost(post.id)"
          >
            <div class="card-img">
              <div class="img-placeholder" />
              <span v-if="post.tags.length" class="post-tag">{{ post.tags[0].name }}</span>
            </div>
            <div class="card-body">
              <span class="post-date">{{ formatDate(post.published_at ?? post.created_at) }}</span>
              <h3 class="card-title">{{ post.title }}</h3>
              <p class="card-excerpt">{{ post.excerpt }}</p>
              <span class="read-more read-more--small">{{ t.readMore }}</span>
            </div>
          </article>
        </div>
      </template>

      <p v-else class="empty-text">{{ t.noPosts }}</p>
    </section>

    <CheckerStrip :h="14" :size="28" color-a="var(--color-accent)" color-b="#EFE7D6" />
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.posts-page { background: #EFE7D6; color: #121212; font-family: 'Archivo', sans-serif; }

/* HERO */
.hero { background: #121212; color: #EFE7D6; position: relative; overflow: hidden; }
.hero-checker {
  position: absolute; inset: 0;
  background-image: repeating-conic-gradient(rgba(255,255,255,.04) 0% 25%, transparent 0% 50%);
  background-size: 36px 36px;
}
.hero-inner { position: relative; padding: 64px 90px; }
.hero-kicker {
  font: 800 13px/1 'Archivo', sans-serif; letter-spacing: .28em;
  color: var(--color-accent); text-transform: uppercase; display: block; margin-bottom: 16px;
}
.hero-title { font: 400 80px/.85 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 20px; }
.hero-sub { font: 500 18px/1.5 'Archivo', sans-serif; color: rgba(239,231,214,.75); max-width: 520px; margin: 0; }

/* TOOLBAR */
.toolbar {
  display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
  padding: 28px 90px;
  border-bottom: 3px solid #121212;
}
.search-wrap {
  position: relative; flex: 1; min-width: 240px; max-width: 380px;
}
.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.search-input {
  width: 100%; padding: 13px 16px 13px 44px;
  border: 3px solid #121212; background: #fff; color: #121212;
  font: 600 16px/1 'Archivo', sans-serif; outline: none;
}
.search-input:focus { outline: 3px solid var(--color-accent); outline-offset: -3px; }
.tag-filters { display: flex; gap: 8px; flex-wrap: wrap; }
.tag-btn {
  border: 3px solid #121212; background: transparent; color: #121212;
  font: 700 13px/1 'Archivo', sans-serif; letter-spacing: .08em; text-transform: uppercase;
  padding: 10px 16px; cursor: pointer; transition: all 150ms;
}
.tag-btn:hover, .tag-btn--active {
  background: var(--color-accent); border-color: var(--color-accent); color: #fff;
  box-shadow: 4px 4px 0 #121212;
}

/* POSTS */
.posts-section { padding: 40px 90px 56px; }
.loading { font: 500 16px/1 'Archivo', sans-serif; color: #777; padding: 32px 0; }
.empty-text { font: 500 16px/1.5 'Archivo', sans-serif; color: #777; padding: 32px 0; }

.featured-post {
  display: grid; grid-template-columns: 1.15fr 1fr;
  border: 3px solid #121212; box-shadow: 10px 10px 0 var(--color-accent);
  cursor: pointer; margin-bottom: 36px; transition: box-shadow 200ms;
  background: #fff;
}
.featured-post:hover { box-shadow: 14px 14px 0 var(--color-accent); }
.featured-img { position: relative; overflow: hidden; min-height: 360px; }
.img-placeholder-dark {
  width: 100%; height: 100%; min-height: 360px;
  background: repeating-linear-gradient(45deg, #1e1e1e, #1e1e1e 9px, #282828 9px, #282828 18px);
}
.img-placeholder {
  width: 100%; height: 100%; min-height: 220px;
  background: repeating-linear-gradient(45deg, #c8c0b0, #c8c0b0 9px, #d6cebd 9px, #d6cebd 18px);
}
.feat-label {
  position: absolute; top: 14px; left: 14px;
  background: #121212; color: #EFE7D6;
  font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .14em; text-transform: uppercase;
  padding: 7px 11px;
}
.post-tag {
  position: absolute; top: 14px; right: 14px;
  background: var(--color-accent); color: #fff;
  font: 800 12px/1 'Archivo', sans-serif; letter-spacing: .12em; text-transform: uppercase;
  padding: 7px 11px;
}
.featured-body { padding: 40px 36px; display: flex; flex-direction: column; justify-content: center; }
.post-date {
  font: 700 12px/1 'Archivo', sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #888;
}
.featured-title {
  font: 400 42px/.9 'Anton', sans-serif; text-transform: uppercase; margin: 14px 0;
}
.featured-excerpt { font: 500 17px/1.55 'Archivo', sans-serif; color: #444; margin: 0; flex: 1; }
.read-more {
  display: inline-block; font: 800 13px/1 'Archivo', sans-serif; letter-spacing: .08em;
  text-transform: uppercase; color: var(--color-accent); margin-top: 20px; cursor: pointer;
}
.read-more--small { margin-top: 14px; font-size: 12px; }

.posts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.post-card {
  background: #fff; border: 3px solid #121212; box-shadow: 5px 5px 0 #121212;
  cursor: pointer; display: flex; flex-direction: column; transition: box-shadow 180ms;
}
.post-card:hover { box-shadow: 8px 8px 0 var(--color-accent); }
.card-img { position: relative; overflow: hidden; }
.card-body { padding: 20px 22px 24px; flex: 1; display: flex; flex-direction: column; }
.card-title {
  font: 400 26px/.95 'Anton', sans-serif; text-transform: uppercase; margin: 10px 0;
}
.card-excerpt {
  font: 500 14px/1.5 'Archivo', sans-serif; color: #444; margin: 0; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

@media (max-width: 1100px) {
  .hero-inner, .toolbar, .posts-section { padding-left: 40px; padding-right: 40px; }
}
@media (max-width: 768px) {
  .hero-inner { padding: 40px 20px; }
  .hero-title { font-size: 52px; }
  .toolbar { padding: 20px; }
  .posts-section { padding: 28px 20px 40px; }
  .featured-post { grid-template-columns: 1fr; }
  .featured-img { min-height: 220px; }
  .img-placeholder-dark { min-height: 220px; }
  .posts-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 520px) {
  .posts-grid { grid-template-columns: 1fr; }
}
</style>
