<script setup lang="ts">
import { reactive } from 'vue'
import type { Concert } from '@/types/concert'
import type { Tag } from '@/types/tag'
import type { Album } from '@/types/album'
import type { ReleaseSummary } from '@/types/release'
import type { PostSummary } from '@/types/post'
import type { TourSummary } from '@/types/tour'
import type { MusicVideo } from '@/types/musicVideo'
import type { PressReleaseSummary } from '@/types/press-release'
import type { ShopCategory } from '@/types/shop'

defineProps<{
  concerts?: Concert[]
  posts?: PostSummary[]
  albums?: Album[]
  releases?: ReleaseSummary[]
  tours?: TourSummary[]
  tags?: Tag[]
  musicVideos?: MusicVideo[]
  pressReleases?: PressReleaseSummary[]
  shopCategories?: ShopCategory[]
}>()

const concertIds      = defineModel<number[]>('concertIds',      { default: () => [] })
const postIds         = defineModel<number[]>('postIds',         { default: () => [] })
const albumIds        = defineModel<number[]>('albumIds',        { default: () => [] })
const releaseIds      = defineModel<number[]>('releaseIds',      { default: () => [] })
const tourIds         = defineModel<number[]>('tourIds',         { default: () => [] })
const tagIds          = defineModel<number[]>('tagIds',          { default: () => [] })
const musicVideoIds   = defineModel<number[]>('musicVideoIds',   { default: () => [] })
const pressReleaseIds  = defineModel<number[]>('pressReleaseIds',  { default: () => [] })
const shopCategoryIds  = defineModel<number[]>('shopCategoryIds',  { default: () => [] })

const expanded = reactive({
  concerts:       false,
  posts:          false,
  albums:         false,
  releases:       false,
  tours:          false,
  tags:           false,
  musicVideos:    false,
  pressReleases:  false,
  shopCategories: false,
})

function toggle(current: number[], set: (v: number[]) => void, id: number) {
  const arr = [...current]
  const i = arr.indexOf(id)
  if (i === -1) arr.push(id)
  else arr.splice(i, 1)
  set(arr)
}

function label(text: string, count: number) {
  return count ? `${text} (${count})` : text
}
</script>

<template>
  <div class="assoc-sections">
    <div class="assoc-title">Link to…</div>

    <div v-if="tags?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.tags = !expanded.tags">
        <span>{{ label('Tags', tagIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.tags }">›</span>
      </button>
      <div v-if="expanded.tags" class="assoc-body checkbox-list">
        <label v-for="t in tags" :key="t.id" class="checkbox-item">
          <input type="checkbox" :checked="tagIds.includes(t.id)" @change="toggle(tagIds, v => tagIds = v, t.id)" />
          <span>{{ t.name }}</span>
        </label>
      </div>
    </div>

    <div v-if="concerts?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.concerts = !expanded.concerts">
        <span>{{ label('Concerts', concertIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.concerts }">›</span>
      </button>
      <div v-if="expanded.concerts" class="assoc-body checkbox-list">
        <label v-for="c in concerts" :key="c.id" class="checkbox-item">
          <input type="checkbox" :checked="concertIds.includes(c.id)" @change="toggle(concertIds, v => concertIds = v, c.id)" />
          <span>{{ c.date }}<template v-if="c.venue?.name"> — {{ c.venue.name }}</template></span>
        </label>
      </div>
    </div>

    <div v-if="releases?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.releases = !expanded.releases">
        <span>{{ label('Music releases', releaseIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.releases }">›</span>
      </button>
      <div v-if="expanded.releases" class="assoc-body checkbox-list">
        <label v-for="r in releases" :key="r.id" class="checkbox-item">
          <input type="checkbox" :checked="releaseIds.includes(r.id)" @change="toggle(releaseIds, v => releaseIds = v, r.id)" />
          <span>{{ r.title }} <span class="assoc-badge">{{ r.type }}</span></span>
        </label>
      </div>
    </div>

    <div v-if="tours?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.tours = !expanded.tours">
        <span>{{ label('Tours', tourIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.tours }">›</span>
      </button>
      <div v-if="expanded.tours" class="assoc-body checkbox-list">
        <label v-for="t in tours" :key="t.id" class="checkbox-item">
          <input type="checkbox" :checked="tourIds.includes(t.id)" @change="toggle(tourIds, v => tourIds = v, t.id)" />
          <span>{{ t.name }}</span>
        </label>
      </div>
    </div>

    <div v-if="albums?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.albums = !expanded.albums">
        <span>{{ label('Photo albums', albumIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.albums }">›</span>
      </button>
      <div v-if="expanded.albums" class="assoc-body checkbox-list">
        <label v-for="a in albums" :key="a.id" class="checkbox-item">
          <input type="checkbox" :checked="albumIds.includes(a.id)" @change="toggle(albumIds, v => albumIds = v, a.id)" />
          <span>{{ a.title }}</span>
        </label>
      </div>
    </div>

    <div v-if="posts?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.posts = !expanded.posts">
        <span>{{ label('Blog posts', postIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.posts }">›</span>
      </button>
      <div v-if="expanded.posts" class="assoc-body checkbox-list">
        <label v-for="p in posts" :key="p.id" class="checkbox-item">
          <input type="checkbox" :checked="postIds.includes(p.id)" @change="toggle(postIds, v => postIds = v, p.id)" />
          <span>{{ p.title }}</span>
        </label>
      </div>
    </div>

    <div v-if="musicVideos?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.musicVideos = !expanded.musicVideos">
        <span>{{ label('Music videos', musicVideoIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.musicVideos }">›</span>
      </button>
      <div v-if="expanded.musicVideos" class="assoc-body checkbox-list">
        <label v-for="v in musicVideos" :key="v.id" class="checkbox-item">
          <input type="checkbox" :checked="musicVideoIds.includes(v.id)" @change="toggle(musicVideoIds, val => musicVideoIds = val, v.id)" />
          <span>{{ v.og_title ?? v.title }}</span>
        </label>
      </div>
    </div>

    <div v-if="pressReleases?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.pressReleases = !expanded.pressReleases">
        <span>{{ label('Press', pressReleaseIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.pressReleases }">›</span>
      </button>
      <div v-if="expanded.pressReleases" class="assoc-body checkbox-list">
        <label v-for="pr in pressReleases" :key="pr.id" class="checkbox-item">
          <input type="checkbox" :checked="pressReleaseIds.includes(pr.id)" @change="toggle(pressReleaseIds, val => pressReleaseIds = val, pr.id)" />
          <span>{{ pr.og_title ?? pr.url }}</span>
        </label>
      </div>
    </div>

    <div v-if="shopCategories?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.shopCategories = !expanded.shopCategories">
        <span>{{ label('Categories', shopCategoryIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.shopCategories }">›</span>
      </button>
      <div v-if="expanded.shopCategories" class="assoc-body checkbox-list">
        <label v-for="c in shopCategories" :key="c.id" class="checkbox-item">
          <input type="checkbox" :checked="shopCategoryIds.includes(c.id)" @change="toggle(shopCategoryIds, val => shopCategoryIds = val, c.id)" />
          <span>{{ c.name }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped src="./form-styles.css" />
<style scoped>
.assoc-sections {
  display: flex; flex-direction: column; gap: 0;
  border: 1px solid #222222; border-radius: 0.5rem; overflow: hidden;
}
.assoc-title {
  font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.07em; color: #555555; padding: 0.5rem 0.875rem;
  background: #141414; border-bottom: 1px solid #222222;
}
.assoc-section { border-bottom: 1px solid #222222; }
.assoc-section:last-child { border-bottom: none; }
.assoc-toggle {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0.875rem; background: transparent; border: none; cursor: pointer;
  color: #94a3b8; font-size: 0.8rem; font-weight: 500; text-align: left;
  transition: background 100ms;
}
.assoc-toggle:hover { background: #111111; }
.assoc-chevron { font-size: 1rem; line-height: 1; transition: transform 200ms; color: #555555; }
.assoc-chevron--open { transform: rotate(90deg); }
.assoc-body { padding: 0.5rem 0.875rem 0.75rem; background: #141414; }
.assoc-badge {
  display: inline-block; padding: 0.05rem 0.35rem; border-radius: 0.2rem;
  background: #2a2a2a; color: #aaaaaa; font-size: 0.62rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; margin-left: 0.35rem;
}
</style>
