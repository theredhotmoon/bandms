<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useHeroImages } from '@/composables/useHeroImages'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { scopeSet, hasOwnSet } from '@/utils/heroImageScopes'
import { NON_PAGE_MODULES } from '@/config/moduleSettings'
import type { HeroImage } from '@/types/heroImage'

const { query, upload, update, reorder, remove } = useHeroImages()
const { query: modulesQ, rebuild, rebuildStatusQuery } = useWebsiteModules()

const sets = computed(() => query.data.value?.data)

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

/** The selected scope's rows, in server order — includes inactive rows. */
const current = computed<HeroImage[]>(() => scopeSet(sets.value, selected.value))

const fileInput = ref<HTMLInputElement | null>(null)

async function onFilesChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return

  try {
    await upload.mutateAsync({
      scope: selected.value,
      files: files.map(file => ({ file, caption: '' })),
    })
    toast.success(files.length === 1 ? 'Picture uploaded' : `${files.length} pictures uploaded`)
  } catch {
    toast.error('Upload failed')
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

/**
 * Captions are edited inline, after upload, rather than in a pre-upload form —
 * an optional field doesn't earn a second form. Keyed by image id so a pending
 * edit in one thumbnail survives a cache update to another.
 */
const captionDrafts = ref<Record<number, string>>({})

function captionFor(image: HeroImage): string {
  return captionDrafts.value[image.id] ?? image.caption ?? ''
}

async function saveCaption(image: HeroImage, value: string) {
  delete captionDrafts.value[image.id]
  if (value === (image.caption ?? '')) return
  try {
    await update.mutateAsync({ id: image.id, payload: { caption: value || null } })
  } catch {
    toast.error('Could not save caption')
  }
}

async function toggleActive(image: HeroImage) {
  try {
    await update.mutateAsync({ id: image.id, payload: { active: !image.active } })
  } catch {
    toast.error('Could not update')
  }
}

/**
 * Fires the reorder call immediately per click — no separate "Save order" bar.
 * These lists are a handful of pictures, not a full photo album, so a
 * dirty-tracked batch save isn't worth the extra state.
 */
async function move(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= current.value.length) return
  const order = current.value.map(h => h.id)
  const [moved] = order.splice(index, 1)
  order.splice(next, 0, moved)
  try {
    await reorder.mutateAsync({ scope: selected.value, order })
  } catch {
    toast.error('Could not reorder')
  }
}

async function removeImage(image: HeroImage) {
  try {
    await remove.mutateAsync(image.id)
    toast.success('Picture removed')
  } catch {
    toast.error('Could not remove picture')
  }
}

/** Count shown beside each scope, or the inheritance note. */
function scopeSummary(key: string): string {
  if (!hasOwnSet(sets.value, key)) return key === 'main' ? 'none set' : 'inherits Main'
  const n = scopeSet(sets.value, key).filter(h => h.active).length
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
            Pictures shown behind a page's title. With more than one active picture, one
            is chosen at random on each visit. A page with none of its own uses Main.
            Uploaded here directly — never from the photo gallery.
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

        <!-- Selected scope -->
        <div>
          <p v-if="current.length === 0" class="text-sm text-zinc-500 mb-4">
            No pictures yet.
            <template v-if="selected !== 'main'">This page uses the Main set.</template>
          </p>

          <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <li
              v-for="(image, i) in current" :key="image.id"
              class="rounded-lg overflow-hidden bg-zinc-800"
              :class="{ 'opacity-40': !image.active }"
            >
              <img
                v-if="image.url"
                :src="image.url"
                :alt="image.caption ?? ''"
                class="w-full h-28 object-cover"
              />
              <div v-else class="w-full h-28 grid place-items-center text-xs text-zinc-500">no file</div>

              <input
                :value="captionFor(image)"
                placeholder="Caption (optional)"
                class="w-full bg-transparent border-0 border-b border-zinc-700 text-xs text-zinc-300 px-2 py-1 focus:outline-none focus:border-teal-500"
                @input="captionDrafts[image.id] = ($event.target as HTMLInputElement).value"
                @blur="saveCaption(image, captionFor(image))"
              />

              <div class="flex items-center gap-1 p-2 text-xs">
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === 0 || reorder.isPending.value" aria-label="Move earlier" @click="move(i, -1)"
                >←</button>
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === current.length - 1 || reorder.isPending.value" aria-label="Move later" @click="move(i, 1)"
                >→</button>
                <label class="ml-auto flex items-center gap-1 cursor-pointer select-none text-zinc-400">
                  <input type="checkbox" :checked="image.active" @change="toggleActive(image)" />
                  Active
                </label>
              </div>
              <div class="p-2 pt-0">
                <button
                  type="button" class="w-full px-2 py-1 rounded text-red-400 hover:bg-zinc-700"
                  :disabled="remove.isPending.value"
                  @click="removeImage(image)"
                >Remove</button>
              </div>
            </li>
          </ul>

          <label
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold cursor-pointer"
            :class="{ 'opacity-50 cursor-not-allowed': upload.isPending.value }"
          >
            {{ upload.isPending.value ? 'Uploading…' : '+ Upload pictures' }}
            <input
              ref="fileInput" type="file" accept="image/*" multiple class="hidden"
              :disabled="upload.isPending.value"
              @change="onFilesChosen"
            />
          </label>

          <p v-if="!autoRebuild" class="text-xs text-zinc-500 mt-3">
            The public site is static — hero changes appear after a rebuild.
          </p>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
