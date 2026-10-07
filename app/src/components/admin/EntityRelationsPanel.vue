<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Concert } from '@/types/concert'
import type { Tag } from '@/types/tag'
import type { Album } from '@/types/album'
import type { ReleaseSummary } from '@/types/release'
import type { PostSummary } from '@/types/post'
import type { TourSummary } from '@/types/tour'
import type { MusicVideo } from '@/types/musicVideo'
import type { PressReleaseSummary } from '@/types/press-release'
import type { ShopItemSummary } from '@/types/shop'

const props = defineProps<{
  concerts?: Concert[]
  posts?: PostSummary[]
  albums?: Album[]
  releases?: ReleaseSummary[]
  tours?: TourSummary[]
  tags?: Tag[]
  musicVideos?: MusicVideo[]
  pressReleases?: PressReleaseSummary[]
  shopItems?: ShopItemSummary[]
  /** Band members, for content that can be about several of them. */
  members?: readonly { id: number; first_name: string; last_name: string }[]
}>()

const concertIds      = defineModel<number[]>('concertIds',      { default: () => [] })
const postIds         = defineModel<number[]>('postIds',         { default: () => [] })
const albumIds        = defineModel<number[]>('albumIds',        { default: () => [] })
const releaseIds      = defineModel<number[]>('releaseIds',      { default: () => [] })
const tourIds         = defineModel<number[]>('tourIds',         { default: () => [] })
const tagIds          = defineModel<number[]>('tagIds',          { default: () => [] })
const musicVideoIds   = defineModel<number[]>('musicVideoIds',   { default: () => [] })
const pressReleaseIds = defineModel<number[]>('pressReleaseIds', { default: () => [] })
const shopItemIds     = defineModel<number[]>('shopItemIds',     { default: () => [] })
const memberIds       = defineModel<number[]>('memberIds',       { default: () => [] })

const { t } = useI18n()

type SectionKey = 'tags' | 'members' | 'concerts' | 'releases' | 'shopItems' | 'tours' | 'albums' | 'posts' | 'musicVideos' | 'pressReleases'

interface Item { id: number; label: string; badge?: string }
interface Section {
  key: SectionKey
  title: string
  items: Item[]
  ids: number[]
  set: (v: number[]) => void
  testid?: string
}

const expanded = reactive<Record<SectionKey, boolean>>({
  tags: false, members: false, concerts: false, releases: false, shopItems: false,
  tours: false, albums: false, posts: false, musicVideos: false, pressReleases: false,
})

// One list drives the template, so every section gets the same toggle,
// summary and checkbox list — and the order is the order the forms always had.
const sections = computed<Section[]>(() => {
  const out: Section[] = []
  if (props.tags?.length) out.push({
    key: 'tags', title: t('common.relations.tags'),
    items: props.tags.map(x => ({ id: x.id, label: x.name })),
    ids: tagIds.value, set: v => (tagIds.value = v),
  })
  if (props.members?.length) out.push({
    key: 'members', title: t('common.relations.members'), testid: 'relations-members',
    items: props.members.map(m => ({ id: m.id, label: `${m.first_name} ${m.last_name}` })),
    ids: memberIds.value, set: v => (memberIds.value = v),
  })
  if (props.concerts?.length) out.push({
    key: 'concerts', title: t('common.relations.concerts'),
    items: props.concerts.map(c => ({ id: c.id, label: c.venue?.name ? `${c.date} — ${c.venue.name}` : c.date })),
    ids: concertIds.value, set: v => (concertIds.value = v),
  })
  if (props.releases?.length) out.push({
    key: 'releases', title: t('common.relations.releases'),
    items: props.releases.map(r => ({ id: r.id, label: r.title, badge: r.type })),
    ids: releaseIds.value, set: v => (releaseIds.value = v),
  })
  if (props.shopItems?.length) out.push({
    key: 'shopItems', title: t('common.relations.shopItems'),
    items: props.shopItems.map(s => ({ id: s.id, label: s.name })),
    ids: shopItemIds.value, set: v => (shopItemIds.value = v),
  })
  if (props.tours?.length) out.push({
    key: 'tours', title: t('common.relations.tours'),
    items: props.tours.map(x => ({ id: x.id, label: x.name })),
    ids: tourIds.value, set: v => (tourIds.value = v),
  })
  if (props.albums?.length) out.push({
    key: 'albums', title: t('common.relations.albums'),
    items: props.albums.map(a => ({ id: a.id, label: a.title })),
    ids: albumIds.value, set: v => (albumIds.value = v),
  })
  if (props.posts?.length) out.push({
    key: 'posts', title: t('common.relations.posts'),
    items: props.posts.map(p => ({ id: p.id, label: p.title })),
    ids: postIds.value, set: v => (postIds.value = v),
  })
  if (props.musicVideos?.length) out.push({
    key: 'musicVideos', title: t('common.relations.musicVideos'),
    items: props.musicVideos.map(v => ({ id: v.id, label: v.og_title ?? v.title })),
    ids: musicVideoIds.value, set: v => (musicVideoIds.value = v),
  })
  if (props.pressReleases?.length) out.push({
    key: 'pressReleases', title: t('common.relations.press'),
    items: props.pressReleases.map(pr => ({ id: pr.id, label: pr.og_title ?? pr.url })),
    ids: pressReleaseIds.value, set: v => (pressReleaseIds.value = v),
  })
  return out
})

function toggle(section: Section, id: number) {
  const arr = [...section.ids]
  const i = arr.indexOf(id)
  if (i === -1) arr.push(id)
  else arr.splice(i, 1)
  section.set(arr)
}

function label(text: string, count: number) {
  return count ? `${text} (${count})` : text
}

/** What is linked, readable while the section is closed. */
function summary(section: Section): string {
  const chosen = section.items.filter(i => section.ids.includes(i.id)).map(i => i.label)
  return chosen.join(', ')
}
</script>

<template>
  <div class="assoc-sections">
    <div class="assoc-title">{{ $t('common.relations.title') }}</div>

    <div v-for="s in sections" :key="s.key" class="assoc-section" :data-testid="s.testid">
      <button type="button" class="assoc-toggle" :aria-expanded="expanded[s.key]" @click="expanded[s.key] = !expanded[s.key]">
        <span class="assoc-toggle-text">
          <span>{{ label(s.title, s.ids.length) }}</span>
          <span v-if="!expanded[s.key] && s.ids.length" class="assoc-summary">{{ summary(s) }}</span>
        </span>
        <svg class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded[s.key] }" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div v-if="expanded[s.key]" class="assoc-body checkbox-list">
        <label v-for="i in s.items" :key="i.id" class="checkbox-item">
          <input type="checkbox" :checked="s.ids.includes(i.id)" @change="toggle(s, i.id)" />
          <span>{{ i.label }} <span v-if="i.badge" class="assoc-badge">{{ i.badge }}</span></span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped src="./form-styles.css" />
<style scoped>
.assoc-sections {
  display: flex; flex-direction: column; gap: 0;
  border: 1px solid var(--c-222222); border-radius: 0.5rem; overflow: hidden;
}
.assoc-title {
  font-size: var(--fs-2xs); font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-555555); padding: 0.5rem 0.875rem;
  background: var(--c-141414); border-bottom: 1px solid var(--c-222222);
}
.assoc-section { border-bottom: 1px solid var(--c-222222); }
.assoc-section:last-child { border-bottom: none; }
.assoc-toggle {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.5rem 0.875rem; background: transparent; border: none; cursor: pointer;
  color: var(--c-94a3b8); font-size: var(--fs-sm); font-weight: 500; text-align: left;
  transition: background 100ms;
}
.assoc-toggle:hover { background: var(--c-111111); }
.assoc-toggle-text { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.assoc-summary {
  font-size: var(--fs-xs); font-weight: 400; color: var(--c-64748b);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.assoc-chevron { width: 0.875rem; height: 0.875rem; flex-shrink: 0; transition: transform 200ms; color: var(--c-555555); }
.assoc-chevron--open { transform: rotate(90deg); }
.assoc-body { padding: 0.5rem 0.875rem 0.75rem; background: var(--c-141414); }
.assoc-badge {
  display: inline-block; padding: 0.05rem 0.35rem; border-radius: 0.25rem;
  background: var(--c-2a2a2a); color: var(--c-aaaaaa); font-size: var(--fs-2xs); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; margin-left: 0.35rem;
}
@media (prefers-reduced-motion: reduce) { .assoc-chevron { transition: none; } }
</style>
