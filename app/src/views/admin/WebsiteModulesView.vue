<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { ApiValidationError } from '@/api/client'
import type { WebsiteModule, ModuleSettings } from '@/types/website-module'
import { settingsFieldsFor } from '@/config/moduleSettings'

const { query, rebuildStatusQuery, toggleModule, updateSettings, reorder, setAutoRebuild, rebuild } = useWebsiteModules()

const autoRebuild = computed(() => query.data.value?.auto_rebuild ?? false)

const rebuildStatus  = computed(() => rebuildStatusQuery.data.value?.status ?? 'idle')
const rebuildStarted = computed(() => rebuildStatusQuery.data.value?.startedAt ?? null)

// ── Elapsed-time ticker ───────────────────────────────────────────────────────

const ESTIMATED_MS = 45_000

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

watch(rebuildStatus, (status) => {
  if (ticker) { clearInterval(ticker); ticker = null }
  if (status === 'building') {
    ticker = setInterval(() => { now.value = Date.now() }, 1000)
  }
}, { immediate: true })

onUnmounted(() => { if (ticker) clearInterval(ticker) })

const elapsedSec = computed(() => {
  if (!rebuildStarted.value) return 0
  return Math.floor((now.value - rebuildStarted.value) / 1000)
})

const progressPct = computed(() => {
  if (rebuildStatus.value === 'done')  return 100
  if (rebuildStatus.value === 'error') return 100
  if (rebuildStatus.value !== 'building' || !rebuildStarted.value) return 0
  return Math.min((elapsedSec.value / (ESTIMATED_MS / 1000)) * 90, 90)
})

const showBar = computed(() =>
  rebuildStatus.value === 'building' ||
  rebuildStatus.value === 'done'     ||
  rebuildStatus.value === 'error'
)

// ── Draggable ordered list ────────────────────────────────────────────────────

const localModules = ref<WebsiteModule[]>([])

watch(() => query.data.value?.data, (data) => {
  if (data) localModules.value = [...data]
}, { immediate: true, deep: false })

let dragFrom = -1
const dragOverIndex = ref(-1)

function onDragStart(index: number, event: DragEvent) {
  dragFrom = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(toIndex: number, event: DragEvent) {
  event.preventDefault()
  dragOverIndex.value = -1
  if (dragFrom === -1 || dragFrom === toIndex) { dragFrom = -1; return }

  const next = [...localModules.value]
  const [moved] = next.splice(dragFrom, 1)
  next.splice(toIndex, 0, moved)
  localModules.value = next
  dragFrom = -1

  reorder.mutate(next.map((m) => m.slug))
}

function onDragEnd() {
  dragFrom = -1
  dragOverIndex.value = -1
}

// ── Inline edit ───────────────────────────────────────────────────────────────

const LIST_SLUGS       = new Set(['posts', 'concerts', 'photos', 'press', 'videos', 'merch'])
const PER_PAGE_OPTIONS = [6, 9, 10, 12, 15, 20, 24] as const

const editingSlug  = ref<string | null>(null)
const draftNameEn  = ref('')
const draftNamePl  = ref('')
const draftSlugEn  = ref('')
const draftSlugPl  = ref('')
const draftPerPage = ref<number | null>(null)
const fieldErrors  = ref<Record<string, string[]>>({})

// Editable page copy, keyed `<field>.<locale>` so one flat ref backs a form
// whose shape comes from the schema rather than from named refs.
const draftSettings = ref<Record<string, string>>({})

const settingsFields = computed(() =>
  editingSlug.value ? settingsFieldsFor(editingSlug.value) : [],
)

function startEdit(mod: WebsiteModule) {
  editingSlug.value  = mod.slug
  draftNameEn.value  = mod.custom_name?.en ?? ''
  draftNamePl.value  = mod.custom_name?.pl ?? ''
  draftSlugEn.value  = mod.custom_slug?.en ?? ''
  draftSlugPl.value  = mod.custom_slug?.pl ?? ''
  draftPerPage.value = mod.per_page ?? null
  fieldErrors.value  = {}

  const next: Record<string, string> = {}
  for (const field of settingsFieldsFor(mod.slug)) {
    for (const locale of ['en', 'pl'] as const) {
      next[`${field.key}.${locale}`] = mod.settings?.[field.key]?.[locale] ?? ''
    }
  }
  draftSettings.value = next
}

function cancelEdit() {
  editingSlug.value = null
  fieldErrors.value = {}
}

// Mirrors the API fallback exactly: an empty slug is served under the module
// key. Tested for empty rather than with `||`, which would treat the legal slug
// "0" as absent — the same trap PHP's `?:` sets on the server.
function effectiveSlug(stored: string | null | undefined, moduleKey: string) {
  const trimmed = stored?.trim() ?? ''
  return trimmed === '' ? moduleKey : trimmed
}

// The path shown under each slug input; never blank, so the hint always shows
// where the page will actually live.
function previewPath(mod: WebsiteModule, lang: 'en' | 'pl', draft: string) {
  return `/${lang}/${effectiveSlug(draft, mod.slug)}`
}

/**
 * Fold the flat draft back into `{field: {en, pl}}`.
 *
 * Empty becomes null rather than being dropped: the API merges per locale and
 * treats an absent locale as "leave alone", so omitting a cleared field would
 * silently keep the old copy — the same trap the slug fields set.
 */
function collectSettings(slug: string): ModuleSettings {
  const out: ModuleSettings = {}
  for (const field of settingsFieldsFor(slug)) {
    out[field.key] = {
      en: draftSettings.value[`${field.key}.en`]?.trim() || null,
      pl: draftSettings.value[`${field.key}.pl`]?.trim() || null,
    }
  }
  return out
}

async function saveEdit(slug: string) {
  fieldErrors.value = {}
  try {
    await updateSettings.mutateAsync({
      slug,
      payload: {
        custom_name: {
          en: draftNameEn.value.trim() || null,
          pl: draftNamePl.value.trim() || null,
        },
        custom_slug: {
          en: draftSlugEn.value.trim() || null,
          pl: draftSlugPl.value.trim() || null,
        },
        per_page: draftPerPage.value,
        ...(settingsFields.value.length > 0 ? { settings: collectSettings(slug) } : {}),
      },
    })
    editingSlug.value = null
  } catch (e) {
    // Field-level errors render inline next to the offending input; anything
    // else would otherwise vanish, leaving the form looking like it saved.
    if (e instanceof ApiValidationError) fieldErrors.value = e.errors
    else toast.error('Could not save the module')
  }
}
</script>

<template>
  <AdminLayout>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-white">Website Modules</h1>
        <p class="text-sm text-zinc-500 mt-1">Drag rows to set the nav order. Order takes effect after a rebuild.</p>
      </div>

      <div class="flex items-center gap-4 flex-wrap">
        <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            class="w-4 h-4 rounded accent-teal-500"
            :checked="autoRebuild"
            :disabled="setAutoRebuild.isPending.value"
            @change="setAutoRebuild.mutate(!autoRebuild)"
          />
          Auto-rebuild on changes
        </label>

        <button
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          :disabled="rebuildStatus === 'building' || autoRebuild"
          :title="autoRebuild ? 'Auto-rebuild is active — changes rebuild automatically' : 'Rebuild the public Astro site'"
          @click="rebuild.mutate()"
        >
          <span>{{ rebuildStatus === 'building' ? 'Rebuilding…' : '↺ Rebuild Public Site' }}</span>
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div v-if="showBar" class="mb-6 rounded-xl overflow-hidden bg-zinc-800">
      <div
        class="h-2 transition-all duration-1000 ease-out"
        :class="{
          'bg-teal-500': rebuildStatus === 'building',
          'bg-green-500': rebuildStatus === 'done',
          'bg-red-500': rebuildStatus === 'error',
        }"
        :style="{ width: `${progressPct}%` }"
      />
      <div class="px-4 py-2 flex items-center justify-between text-xs">
        <span
          :class="{
            'text-teal-400': rebuildStatus === 'building',
            'text-green-400': rebuildStatus === 'done',
            'text-red-400': rebuildStatus === 'error',
          }"
        >
          <template v-if="rebuildStatus === 'building'">Building… {{ elapsedSec }}s</template>
          <template v-else-if="rebuildStatus === 'done'">Rebuild complete ✓</template>
          <template v-else-if="rebuildStatus === 'error'">Rebuild failed — check container logs</template>
        </span>
        <span class="text-zinc-500">~{{ Math.round(ESTIMATED_MS / 1000) }}s estimated</span>
      </div>
    </div>

    <div v-if="query.isLoading.value" class="text-zinc-500">Loading…</div>

    <div v-else-if="query.isError.value" class="text-red-400">
      Failed to load modules. Check the API connection.
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(mod, i) in localModules"
        :key="mod.slug"
        class="rounded-xl border bg-zinc-900 transition-colors select-none overflow-hidden"
        :class="{
          'border-zinc-700': mod.enabled,
          'border-zinc-800': !mod.enabled,
          'border-t-2 border-t-teal-500': dragOverIndex === i,
        }"
      >
        <!-- ── Row ── -->
        <div
          class="flex items-center gap-3 px-4 transition-colors"
          :class="mod.enabled ? 'py-3' : 'py-1.5'"
          draggable="true"
          @dragstart="onDragStart(i, $event)"
          @dragover="onDragOver(i, $event)"
          @drop="onDrop(i, $event)"
          @dragend="onDragEnd"
        >
          <!-- Drag handle -->
          <span class="cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing flex-shrink-0" aria-hidden="true">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="3" cy="2"  r="1.5" /><circle cx="7" cy="2"  r="1.5" />
              <circle cx="3" cy="7"  r="1.5" /><circle cx="7" cy="7"  r="1.5" />
              <circle cx="3" cy="12" r="1.5" /><circle cx="7" cy="12" r="1.5" />
            </svg>
          </span>

          <!-- Position number -->
          <span class="w-5 text-center text-xs font-mono text-zinc-500 flex-shrink-0">{{ i + 1 }}</span>

          <!-- Module info -->
          <div class="flex-1 min-w-0">
            <span
              class="font-semibold text-sm"
              :class="mod.enabled ? 'text-white' : 'text-zinc-500'"
            >{{ mod.custom_name?.en || mod.display_name }}</span>
            <span v-if="mod.custom_name?.en" class="ml-1.5 text-xs text-zinc-600">({{ mod.display_name }})</span>
            <span class="ml-2 text-xs text-zinc-500">/{{ mod.slug === 'tech-rider' ? 'rider' : effectiveSlug(mod.custom_slug?.en, mod.slug) }}</span>
          </div>

          <!-- Status badge -->
          <span
            class="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            :class="mod.enabled ? 'bg-teal-900 text-teal-300' : 'bg-zinc-800 text-zinc-500'"
          >
            {{ mod.enabled ? 'Live' : 'Off' }}
          </span>

          <!-- Edit button -->
          <button
            class="flex-shrink-0 p-1 rounded transition-colors"
            :class="editingSlug === mod.slug ? 'text-teal-400' : 'text-zinc-600 hover:text-zinc-400'"
            :aria-label="`Edit ${mod.display_name} settings`"
            @click="editingSlug === mod.slug ? cancelEdit() : startEdit(mod)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

          <!-- Toggle -->
          <label class="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-400 flex-shrink-0">
            <input
              type="checkbox"
              class="w-4 h-4 rounded accent-teal-500"
              :checked="mod.enabled"
              :disabled="toggleModule.isPending.value"
              @change="toggleModule.mutate({ slug: mod.slug, enabled: !mod.enabled })"
            />
            {{ mod.enabled ? 'Enabled' : 'Disabled' }}
          </label>
        </div>

        <!-- ── Expand area ── -->
        <div v-if="editingSlug === mod.slug" class="border-t border-zinc-800 px-4 py-3 flex flex-col gap-3">

          <!-- Custom name inputs -->
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Custom name</span>
            <div class="flex gap-3">
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-xs text-zinc-600">EN</span>
                <input
                  v-model="draftNameEn"
                  type="text"
                  maxlength="80"
                  :placeholder="mod.display_name"
                  class="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-xs text-zinc-600">PL</span>
                <input
                  v-model="draftNamePl"
                  type="text"
                  maxlength="80"
                  :placeholder="mod.display_name"
                  class="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <!-- URL slug inputs.
               Deliberately not SlugInput.vue: that component derives the slug
               from a source title and offers a regenerate button, which is the
               label→URL coupling this field exists to break. With no source to
               regenerate from it would emit '' and move a live page. These also
               need a per-locale error and a path preview, which it has no slot
               for. -->
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">URL slug</span>
            <div class="flex gap-3">
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-xs text-zinc-600">EN</span>
                <input
                  v-model="draftSlugEn"
                  type="text"
                  maxlength="60"
                  :placeholder="mod.slug"
                  :aria-invalid="Boolean(fieldErrors['custom_slug.en'])"
                  class="w-full rounded-lg bg-zinc-800 border px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                  :class="fieldErrors['custom_slug.en'] ? 'border-red-500' : 'border-zinc-700 focus:border-teal-500'"
                />
                <span v-if="fieldErrors['custom_slug.en']" class="text-xs text-red-400">
                  {{ fieldErrors['custom_slug.en'][0] }}
                </span>
                <span v-else class="text-xs text-zinc-600 font-mono">{{ previewPath(mod, 'en', draftSlugEn) }}</span>
              </div>
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-xs text-zinc-600">PL</span>
                <input
                  v-model="draftSlugPl"
                  type="text"
                  maxlength="60"
                  :placeholder="mod.slug"
                  :aria-invalid="Boolean(fieldErrors['custom_slug.pl'])"
                  class="w-full rounded-lg bg-zinc-800 border px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                  :class="fieldErrors['custom_slug.pl'] ? 'border-red-500' : 'border-zinc-700 focus:border-teal-500'"
                />
                <span v-if="fieldErrors['custom_slug.pl']" class="text-xs text-red-400">
                  {{ fieldErrors['custom_slug.pl'][0] }}
                </span>
                <span v-else class="text-xs text-zinc-600 font-mono">{{ previewPath(mod, 'pl', draftSlugPl) }}</span>
              </div>
            </div>
            <span class="text-xs text-zinc-600">
              Lowercase letters, numbers and dashes. Leave empty to serve under
              <code class="text-zinc-500">/{{ mod.slug }}</code>. Changing this moves the page — old links stop working.
            </span>
          </div>

          <!-- Page copy. Which fields appear comes from MODULE_SETTINGS_SCHEMA,
               not from the server: settings is a free-form bag, so a module
               gains a field here without a migration. -->
          <div v-if="settingsFields.length > 0" class="flex flex-col gap-3">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Page copy</span>

            <div v-for="field in settingsFields" :key="field.key" class="flex flex-col gap-1">
              <span class="text-xs text-zinc-400">{{ field.label }}</span>
              <div class="flex gap-3" :class="field.type === 'textarea' ? 'flex-col sm:flex-row' : ''">
                <div v-for="locale in (['en', 'pl'] as const)" :key="locale" class="flex flex-col gap-1 flex-1">
                  <label class="text-xs text-zinc-600" :for="`set-${field.key}-${locale}`">
                    {{ locale.toUpperCase() }}
                  </label>
                  <textarea
                    v-if="field.type === 'textarea'"
                    :id="`set-${field.key}-${locale}`"
                    v-model="draftSettings[`${field.key}.${locale}`]"
                    rows="3"
                    :maxlength="field.maxLength"
                    :placeholder="field.placeholder"
                    :aria-invalid="Boolean(fieldErrors[`settings.${field.key}.${locale}`])"
                    class="w-full rounded-lg bg-zinc-800 border px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors resize-y"
                    :class="fieldErrors[`settings.${field.key}.${locale}`] ? 'border-red-500' : 'border-zinc-700 focus:border-teal-500'"
                  />
                  <input
                    v-else
                    :id="`set-${field.key}-${locale}`"
                    v-model="draftSettings[`${field.key}.${locale}`]"
                    type="text"
                    :maxlength="field.maxLength"
                    :placeholder="field.placeholder"
                    :aria-invalid="Boolean(fieldErrors[`settings.${field.key}.${locale}`])"
                    class="w-full rounded-lg bg-zinc-800 border px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    :class="fieldErrors[`settings.${field.key}.${locale}`] ? 'border-red-500' : 'border-zinc-700 focus:border-teal-500'"
                  />
                  <span v-if="fieldErrors[`settings.${field.key}.${locale}`]" class="text-xs text-red-400">
                    {{ fieldErrors[`settings.${field.key}.${locale}`][0] }}
                  </span>
                </div>
              </div>
              <span v-if="field.help" class="text-xs text-zinc-600">{{ field.help }}</span>
            </div>

            <span class="text-xs text-zinc-600">
              Copy changes appear on the public site after a rebuild. Leaving a locale
              empty clears it for that language only.
            </span>
          </div>

          <!-- Per-page select (list modules only) -->
          <div v-if="LIST_SLUGS.has(mod.slug)" class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Items per page</span>
            <select
              v-model="draftPerPage"
              class="w-44 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option :value="null">Default</option>
              <option v-for="n in PER_PAGE_OPTIONS" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-1">
            <button
              class="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              @click="cancelEdit"
            >
              Cancel
            </button>
            <button
              class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="updateSettings.isPending.value"
              @click="saveEdit(mod.slug)"
            >
              {{ updateSettings.isPending.value ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </AdminLayout>
</template>
