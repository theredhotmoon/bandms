<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import { useHeroImages } from '@/composables/useHeroImages'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { useAlbums } from '@/composables/useAlbums'
import { scopeSet, hasOwnSet, shouldReseedDraft } from '@/utils/heroImageScopes'
import { NON_PAGE_MODULES } from '@/config/moduleSettings'
import type { AlbumPhoto } from '@/types/album'

const { query, save } = useHeroImages()
const { query: modulesQ, rebuild, rebuildStatusQuery } = useWebsiteModules()
const { query: albumsQ } = useAlbums()

const sets = computed(() => query.data.value?.data)

/**
 * Every gallery photo, flattened out of its album.
 *
 * useAlbums returns the array directly rather than a `{data}` envelope, unlike
 * useWebsiteModules — the two composables differ here.
 */
const allPhotos = computed<AlbumPhoto[]>(() =>
  (albumsQ.data.value ?? []).flatMap(a => a.photos ?? []),
)

/**
 * Modules whose public page renders no hero, so a picture here would do nothing.
 *
 * Kept local rather than folded into NON_PAGE_MODULES: tech-rider *does* have a
 * route and a URL slug, so hiding it there would remove inputs that work. What
 * it lacks is a PageHero — its page is the token-gated rider document, which is
 * built to print black-on-white and deliberately carries no backdrop.
 */
const NO_HERO_MODULES = new Set(['tech-rider'])

/**
 * Scopes in editing order: the fallback first, then the homepage, then pages.
 *
 * NON_PAGE_MODULES is excluded because those rows have no route at all — a hero
 * for the footer would be a control that changes nothing. Disabled modules stay
 * in the list: switching a section off must not make its pictures unreachable.
 */
const scopes = computed(() => [
  { key: 'main', label: 'Main', hint: 'Used by every page that has none of its own' },
  { key: 'home', label: 'Homepage', hint: '' },
  ...(modulesQ.data.value?.data ?? [])
    .filter(m => !NON_PAGE_MODULES.has(m.slug) && !NO_HERO_MODULES.has(m.slug))
    .map(m => ({
      key: m.slug,
      label: m.display_name,
      hint: m.enabled ? '' : 'module currently switched off',
    })),
])

const selected = ref('main')

/**
 * One thumbnail in the working copy: a gallery photo's id and enough to draw it.
 *
 * Deliberately NOT an AlbumPhoto. Seeding the draft by looking each stored
 * photo_id up in the albums list silently dropped any it could not find, and
 * `dirty` then went true with no user input — so one click on Save deleted them.
 * Two ways to reach that: the albums query resolving after the hero query (the
 * grid renders empty and Save is live), and photos orphaned by album deletion,
 * which /api/albums never returns at all.
 *
 * The API already sends `url` and `caption` with each hero entry, so the draft
 * needs no join and can render every stored picture whatever happened to its
 * album.
 */
interface DraftPhoto {
  /** The gallery photo's id — what gets saved. */
  id: number
  url: string | null
  caption: string | null
}

/** The working copy. Only written back to the server on Save. */
const draft = ref<DraftPhoto[]>([])

/** What the server currently holds for the selected scope, in order. */
const storedIds = computed(() => scopeSet(sets.value, selected.value).map(h => h.photo_id))

const dirty = computed(() =>
  JSON.stringify(draft.value.map(p => p.id)) !== JSON.stringify(storedIds.value),
)

/** The scope the draft was last seeded from — re-seeding is keyed on this. */
const seededScope = ref<string | null>(null)

/**
 * Re-seed the draft when the scope changes, or when fresh data lands on a draft
 * with nothing unsaved in it.
 *
 * The dirty guard is the point. `sets` changes identity on every refetch, and
 * TanStack refetches on window focus by default (VueQueryPlugin is registered
 * with no options in main.ts) — so without it, alt-tabbing away to find another
 * picture and coming back silently discarded every unsaved selection.
 */
watch([selected, sets], () => {
  if (!shouldReseedDraft(seededScope.value !== selected.value, dirty.value)) return

  draft.value = scopeSet(sets.value, selected.value)
    .map(h => ({ id: h.photo_id, url: h.url, caption: h.caption }))
  seededScope.value = selected.value
}, { immediate: true })

const chosenIds = computed(() => new Set(draft.value.map(p => p.id)))

const showPicker = ref(false)

function addPhoto(photo: AlbumPhoto) {
  if (chosenIds.value.has(photo.id)) return
  draft.value = [...draft.value, { id: photo.id, url: photo.image_url, caption: photo.caption }]
}

function removeAt(index: number) {
  draft.value = draft.value.filter((_, i) => i !== index)
}

/**
 * Up/down rather than drag: the admin has no shared drag utility, and adding a
 * library for a list that is usually three items long is not a trade worth
 * making. Order matters only as the order the random pick draws from.
 */
function move(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= draft.value.length) return
  const copy = [...draft.value]
  const [moved] = copy.splice(index, 1)
  copy.splice(next, 0, moved)
  draft.value = copy
}

async function onSave() {
  try {
    await save.mutateAsync({ scope: selected.value, photoIds: draft.value.map(p => p.id) })
    toast.success('Hero images saved')
  } catch {
    toast.error('Could not save hero images')
  }
}

/** Count shown beside each scope, or the inheritance note. */
function scopeSummary(key: string): string {
  if (!hasOwnSet(sets.value, key)) return key === 'main' ? 'none set' : 'inherits Main'
  const n = scopeSet(sets.value, key).length
  return n === 1 ? '1 picture' : `${n} pictures`
}

const rebuilding = computed(() => rebuildStatusQuery.data.value?.status === 'building')
const autoRebuild = computed(() => modulesQ.data.value?.auto_rebuild ?? false)
</script>

<template>
  <AdminLayout>
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold text-white">Hero Images</h1>
          <p class="text-sm text-zinc-500 mt-1">
            Pictures shown behind a page's title. With more than one, a random picture
            is chosen on each visit. A page with none of its own uses Main.
          </p>
        </div>

        <button
          v-if="!autoRebuild"
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          :disabled="rebuilding"
          title="Rebuild the public site so the change becomes visible"
          @click="rebuild.mutate()"
        >
          {{ rebuilding ? 'Rebuilding…' : '↺ Rebuild Public Site' }}
        </button>
      </div>

      <p v-if="query.isError.value" class="text-sm text-red-400 mb-4">
        Could not load hero images.
      </p>

      <div class="grid gap-6 md:grid-cols-[240px_1fr]">
        <!-- Scopes -->
        <ul class="space-y-1">
          <li v-for="s in scopes" :key="s.key">
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-lg transition-colors"
              :class="selected === s.key ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-800'"
              @click="selected = s.key"
            >
              <span class="font-semibold">{{ s.label }}</span>
              <span class="block text-xs text-zinc-500">{{ scopeSummary(s.key) }}</span>
              <span v-if="s.hint" class="block text-xs text-zinc-600">{{ s.hint }}</span>
            </button>
          </li>
        </ul>

        <!-- Selected set -->
        <div>
          <p v-if="draft.length === 0" class="text-sm text-zinc-500 mb-4">
            No pictures yet.
            <template v-if="selected !== 'main'">This page uses the Main set.</template>
          </p>

          <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <li v-for="(photo, i) in draft" :key="photo.id" class="rounded-lg overflow-hidden bg-zinc-800">
              <img
                v-if="photo.url"
                :src="photo.url"
                :alt="photo.caption ?? ''"
                class="w-full h-28 object-cover"
              />
              <div v-else class="w-full h-28 grid place-items-center text-xs text-zinc-500">no file</div>
              <div class="flex items-center gap-1 p-2 text-xs">
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === 0" aria-label="Move earlier" @click="move(i, -1)"
                >←</button>
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === draft.length - 1" aria-label="Move later" @click="move(i, 1)"
                >→</button>
                <button
                  type="button" class="ml-auto px-2 py-1 rounded text-red-400 hover:bg-zinc-700"
                  @click="removeAt(i)"
                >Remove</button>
              </div>
            </li>
          </ul>

          <div class="flex gap-2 flex-wrap">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold"
              @click="showPicker = true"
            >Add from gallery</button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
              :disabled="!dirty || save.isPending.value"
              @click="onSave"
            >{{ save.isPending.value ? 'Saving…' : 'Save' }}</button>
          </div>

          <p v-if="!autoRebuild" class="text-xs text-zinc-500 mt-3">
            The public site is static — hero changes appear after a rebuild.
          </p>
        </div>
      </div>

      <AdminModal :open="showPicker" title="Choose photos" max-width="52rem" @close="showPicker = false">
        <p v-if="allPhotos.length === 0" class="text-sm text-zinc-400">
          No photos in the gallery yet — upload some under Photos first.
        </p>
        <ul v-else class="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <li v-for="photo in allPhotos" :key="photo.id">
            <button
              type="button"
              class="block w-full rounded overflow-hidden"
              :class="chosenIds.has(photo.id) ? 'opacity-40 cursor-not-allowed' : 'hover:ring-2 hover:ring-teal-500'"
              :disabled="chosenIds.has(photo.id)"
              :title="chosenIds.has(photo.id) ? 'Already chosen' : 'Add'"
              @click="addPhoto(photo)"
            >
              <img
                v-if="photo.image_url"
                :src="photo.image_url"
                :alt="photo.caption ?? ''"
                class="w-full h-24 object-cover"
              />
              <div v-else class="w-full h-24 grid place-items-center text-xs text-zinc-500 bg-zinc-800">no file</div>
            </button>
          </li>
        </ul>
      </AdminModal>
    </div>
  </AdminLayout>
</template>
