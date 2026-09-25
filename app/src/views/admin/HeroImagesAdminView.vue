<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useHeroImages } from '@/composables/useHeroImages'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { useSiteRebuild } from '@/composables/useSiteRebuild'
import { reportSaveError } from '@/utils/formErrors'
import { scopeSet, hasOwnSet } from '@/utils/heroImageScopes'
import { NON_PAGE_MODULES } from '@/config/moduleSettings'
import type { HeroImage } from '@/types/heroImage'

const { t } = useI18n()

/** See WebsiteModulesView: a class list is not copy, but it looks like it. */
const scopeClass = (on: boolean) =>
  on ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-800' // i18n-ignore: CSS classes

const uploadLabelClass = (pending: boolean) =>
  pending ? 'opacity-50 cursor-not-allowed' : '' // i18n-ignore: CSS classes


const { query, upload, update, reorder, remove } = useHeroImages()
const { query: modulesQ } = useWebsiteModules()
const { autoRebuild } = useSiteRebuild()

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
 * NON_PAGE_MODULES is excluded because those rows have no route, or a fixed one
 * with no PageHero — a hero for the footer or the privacy policy would be a
 * control that changes nothing. `home` is in that set too, which is why the
 * homepage appears once, as the hardcoded scope below, and not again as a row.
 * Disabled modules stay in the list: switching a section off must not make its
 * pictures unreachable.
 */
const scopes = computed(() => [
  { key: 'main', label: t('pages.heroImages.scopeMain'), hint: t('pages.heroImages.scopeMainHint') },
  { key: 'home', label: t('pages.heroImages.scopeHome'), hint: '' },
  ...(modulesQ.data.value?.data ?? [])
    .filter(m => !NON_PAGE_MODULES.has(m.slug) && !NO_HERO_MODULES.has(m.slug))
    .map(m => ({
      key: m.slug,
      // The module's own name, already resolved for the content locale by the
      // API — not chrome, so it is not translated here.
      label: m.display_name,
      hint: m.enabled ? '' : t('pages.heroImages.scopeOffHint'),
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
    toast.success(t('pages.heroImages.uploaded', files.length, { named: { n: files.length } }))
  } catch (e) {
    reportSaveError(e, t('pages.heroImages.uploadFailed'))
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
  } catch (e) {
    reportSaveError(e, t('pages.heroImages.captionFailed'))
  }
}

async function toggleActive(image: HeroImage) {
  try {
    await update.mutateAsync({ id: image.id, payload: { active: !image.active } })
  } catch (e) {
    reportSaveError(e, t('pages.heroImages.updateFailed'))
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
  } catch (e) {
    reportSaveError(e, t('pages.heroImages.reorderFailed'))
  }
}

async function removeImage(image: HeroImage) {
  try {
    await remove.mutateAsync(image.id)
    toast.success(t('pages.heroImages.removed'))
  } catch (e) {
    reportSaveError(e, t('pages.heroImages.removeFailed'))
  }
}

/** Count shown beside each scope, or the inheritance note. */
function scopeSummary(key: string): string {
  if (!hasOwnSet(sets.value, key)) {
    return key === 'main' ? t('pages.heroImages.noneSet') : t('pages.heroImages.inheritsMain')
  }
  const n = scopeSet(sets.value, key).filter(h => h.active).length
  return t('pages.heroImages.pictureCount', n, { named: { n } })
}

</script>

<template>
  <AdminLayout>
    <div class="p-6 max-w-5xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white">{{ $t('pages.heroImages.title') }}</h1>
        <p class="text-sm text-zinc-500 mt-1">{{ $t('pages.heroImages.lead') }}</p>
      </div>

      <p v-if="query.isError.value" class="text-sm text-red-400 mb-4">{{ $t('pages.heroImages.loadFailed') }}</p>

      <div class="grid gap-6 md:grid-cols-[240px_1fr]">
        <!-- Scopes -->
        <ul class="space-y-1">
          <li v-for="s in scopes" :key="s.key">
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-lg transition-colors"
              :class="scopeClass(selected === s.key)"
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
            {{ $t('pages.heroImages.empty') }}
            <template v-if="selected !== 'main'">{{ $t('pages.heroImages.usesMain') }}</template>
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
              <div v-else class="w-full h-28 grid place-items-center text-xs text-zinc-500">{{ $t('pages.heroImages.noFile') }}</div>

              <input
                :value="captionFor(image)"
                :placeholder="$t('pages.heroImages.caption')"
                class="w-full bg-transparent border-0 border-b border-zinc-700 text-xs text-zinc-300 px-2 py-1 focus:outline-none focus:border-teal-500"
                @input="captionDrafts[image.id] = ($event.target as HTMLInputElement).value"
                @blur="saveCaption(image, captionFor(image))"
              />

              <div class="flex items-center gap-1 p-2 text-xs">
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === 0 || reorder.isPending.value" :aria-label="$t('pages.heroImages.moveEarlier')" @click="move(i, -1)"
                >←</button>
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === current.length - 1 || reorder.isPending.value" :aria-label="$t('pages.heroImages.moveLater')" @click="move(i, 1)"
                >→</button>
                <label class="ml-auto flex items-center gap-1 cursor-pointer select-none text-zinc-400">
                  <input type="checkbox" :checked="image.active" @change="toggleActive(image)" />
                  {{ $t('pages.heroImages.active') }}
                </label>
              </div>
              <div class="p-2 pt-0">
                <button
                  type="button" class="w-full px-2 py-1 rounded text-red-400 hover:bg-zinc-700"
                  :disabled="remove.isPending.value"
                  @click="removeImage(image)"
                >{{ $t('pages.heroImages.remove') }}</button>
              </div>
            </li>
          </ul>

          <label
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold cursor-pointer"
            :class="uploadLabelClass(upload.isPending.value)"
          >
            {{ upload.isPending.value ? $t('pages.heroImages.uploading') : $t('pages.heroImages.upload') }}
            <input
              ref="fileInput" type="file" accept="image/*" multiple class="hidden"
              :disabled="upload.isPending.value"
              @change="onFilesChosen"
            />
          </label>

          <p v-if="!autoRebuild" class="text-xs text-zinc-500 mt-3">{{ $t('pages.heroImages.rebuildNote') }}</p>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
