<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import TranslatedSlugInput from '@/components/admin/forms/TranslatedSlugInput.vue'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import TranslateFormButton from '@/components/admin/forms/TranslateFormButton.vue'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { reportSaveError } from '@/utils/formErrors'
import type { Localized, WebsiteModule, ModuleSettings, ModuleVisibility, ContentWidth } from '@/types/website-module'
import { settingsFieldsFor, settingsGroupsFor, visibilityFieldsFor, hasContentWidth, NON_PAGE_MODULES, ALWAYS_ON_MODULES, type ModuleSettingField } from '@/config/moduleSettings'
import { LOCALES, bagFrom, emptyBag, type Lang, type TranslationBag } from '@/locales'
import type { TranslateFormat } from '@/types/assistant'
import { toDraft, toPayload } from '@/utils/moduleCopyDraft'
import { useContentLocales } from '@/composables/useContentLocales'
import ContentLanguagesCard from '@/components/admin/ContentLanguagesCard.vue'
import { copyFieldGroup, copyFieldHelp, copyFieldLabel } from '@/i18n/copyFields'
import { useUiLang } from '@/composables/useUiLang'

// The band's first content language names a module in the list and resolves
// its live slug; the inputs themselves order their rows through TranslatedField.
const { primary: primaryLocale } = useContentLocales()

/**
 * The row's label: the custom name in the band's primary language, with no
 * fallback to another language. It replaced `custom_name?.en`, which was
 * single-language too; walking the whole order instead labelled a row
 * "Kontakt (Contact)" for an English-first band whose English nav still says
 * "Contact" — the list then described a page nobody visiting in that language
 * sees.
 */
function customNameOf(mod: WebsiteModule): string | null {
  return mod.custom_name?.[primaryLocale.value] || null
}

const { t } = useI18n()
const { uiLang } = useUiLang()

/**
 * Class lists live here, not inline in `:class`.
 *
 * A space-separated Tailwind list looks exactly like copy to the string lint
 * (two letters, an inner space), and the usual escape hatch does not work in a
 * template: an `i18n-ignore` comment inside a tag's attribute list breaks the
 * tag. Naming the expression removes the literal from the template and reads
 * better anyway.
 */
const badgeClass = (on: boolean) =>
  on ? 'bg-teal-900 text-teal-300' : 'bg-zinc-800 text-zinc-500' // i18n-ignore: CSS classes

const editIconClass = (editing: boolean) =>
  editing ? 'text-teal-400' : 'text-zinc-600 hover:text-zinc-400' // i18n-ignore: CSS classes


const { query, toggleModule, updateSettings, reorder } = useWebsiteModules()

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
const draftName    = ref<TranslationBag>(emptyBag())
const draftSlug    = ref<TranslationBag>(emptyBag())
const draftPerPage = ref<number | null>(null)
const draftWidth   = ref<ContentWidth>('full')
const fieldErrors  = ref<Record<string, string[]>>({})

// Editable page copy: one translation bag per schema field, so each field is a
// TranslatedField like every other translated input (utils/moduleCopyDraft.ts).
const draftSettings = ref<Record<string, TranslationBag>>({})

const settingsFields = computed(() =>
  editingSlug.value ? settingsFieldsFor(editingSlug.value) : [],
)

// The same fields bucketed by page section. About alone has ~35 fields × two
// locales, so the form folds each group into a <details>; the first group (the
// page header) starts open, the rest closed.
const settingsGroups = computed(() =>
  editingSlug.value ? settingsGroupsFor(editingSlug.value) : [],
)

// Section toggles, keyed by field — no locale dimension, so a flat boolean
// map is enough.
const draftVisibility = ref<Record<string, boolean>>({})

const { isDirty, markClean } = useDirtyGuard(() => ({
  name: draftName.value,
  slug: draftSlug.value,
  perPage: draftPerPage.value,
  width: draftWidth.value,
  settings: draftSettings.value,
  visibility: draftVisibility.value,
}))

const visibilityFields = computed(() =>
  editingSlug.value ? visibilityFieldsFor(editingSlug.value) : [],
)

// Chrome and fixed-route modules (footer, site, home, privacy) have no movable
// URL, so a slug and a per-page count would be inputs that change nothing.
const isPageModule = computed(() =>
  editingSlug.value ? !NON_PAGE_MODULES.has(editingSlug.value) : true,
)

function startEdit(mod: WebsiteModule) {
  editingSlug.value  = mod.slug
  draftName.value    = bagFrom(mod.custom_name)
  draftSlug.value    = bagFrom(mod.custom_slug)
  draftPerPage.value = mod.per_page ?? null
  draftWidth.value   = mod.content_width ?? 'full'
  fieldErrors.value  = {}

  draftSettings.value = toDraft(settingsFieldsFor(mod.slug).map(f => f.key), mod.settings)

  // Absent means visible — mirrors how the public site treats a missing key,
  // so a module that has never saved this bag opens with every toggle on.
  const nextVisibility: Record<string, boolean> = {}
  for (const field of visibilityFieldsFor(mod.slug)) {
    nextVisibility[field.key] = mod.visibility?.[field.key] ?? true
  }
  draftVisibility.value = nextVisibility

  markClean()
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
function previewPath(mod: WebsiteModule, lang: Lang, draft: string) {
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
  return toPayload(settingsFieldsFor(slug).map(f => f.key), draftSettings.value)
}

// ── "Translate empty fields", one button per copy group ─────────────────────
// TranslatedField keys its rows `module.<slug>.<field>.<locale>`; the group
// button must plan under the same keys so the two share one pending state.
const copyFieldKey = (field: string): string => `module.${editingSlug.value}.${field}`

function groupBags(fields: ModuleSettingField[]): Record<string, TranslationBag> {
  return Object.fromEntries(fields.map(f => [copyFieldKey(f.key), draftSettings.value[f.key] ?? emptyBag()]))
}

function groupFormats(fields: ModuleSettingField[]): Record<string, TranslateFormat> {
  return Object.fromEntries(fields.map(f => [copyFieldKey(f.key), 'text' as const]))
}

function onGroupFill(bags: Record<string, TranslationBag>): void {
  const prefix = copyFieldKey('')
  for (const [key, bag] of Object.entries(bags)) {
    if (key.startsWith(prefix)) draftSettings.value[key.slice(prefix.length)] = bag
  }
}

function collectVisibility(slug: string): ModuleVisibility {
  const out: ModuleVisibility = {}
  for (const field of visibilityFieldsFor(slug)) {
    out[field.key] = draftVisibility.value[field.key] ?? true
  }
  return out
}

async function saveEdit(slug: string) {
  fieldErrors.value = {}
  try {
    await updateSettings.mutateAsync({
      slug,
      payload: {
        // Every locale, a blank one as null — an omitted locale would keep its
        // old name, because the API merges translations.
        custom_name: Object.fromEntries(LOCALES.map(l => [l, draftName.value[l].trim() || null])) as Localized,
        // Omitted entirely for a chrome module: sending nulls would clear the
        // column, and the API treats an explicit null as "clear this locale".
        ...(isPageModule.value
          ? {
              custom_slug: Object.fromEntries(LOCALES.map(l => [l, draftSlug.value[l].trim() || null])) as Localized,
            }
          : {}),
        per_page: draftPerPage.value,
        ...(hasContentWidth(slug) ? { content_width: draftWidth.value } : {}),
        ...(settingsFields.value.length > 0 ? { settings: collectSettings(slug) } : {}),
        ...(visibilityFields.value.length > 0 ? { visibility: collectVisibility(slug) } : {}),
      },
    })
    editingSlug.value = null
    markClean()
  } catch (e) {
    // Field-level errors render inline next to the offending input; anything
    // else would otherwise vanish, leaving the form looking like it saved.
    reportSaveError(e, t('pages.modules.saveFailed'), fieldErrors)
  }
}
</script>

<template>
  <AdminLayout>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white">{{ $t('pages.modules.title') }}</h1>
      <p class="text-sm text-zinc-500 mt-1">{{ $t('pages.modules.lead') }}</p>
    </div>

    <ContentLanguagesCard />

    <div v-if="query.isLoading.value" class="text-zinc-500">{{ $t('common.state.loading') }}</div>

    <div v-else-if="query.isError.value" class="text-red-400">
      {{ $t('pages.modules.loadFailed') }}
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(mod, i) in localModules"
        :key="mod.slug"
        class="rounded-card border bg-zinc-900 transition-colors select-none overflow-hidden"
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
          <span class="w-5 text-center text-xs tabular-nums text-zinc-500 flex-shrink-0">{{ i + 1 }}</span>

          <!-- Module info -->
          <div class="flex-1 min-w-0">
            <span
              class="font-semibold text-sm"
              :class="mod.enabled ? 'text-white' : 'text-zinc-500'"
            >{{ customNameOf(mod) || mod.display_name }}</span>
            <span v-if="customNameOf(mod)" class="ml-1.5 text-xs text-zinc-600">({{ mod.display_name }})</span>
            <!-- No URL hint for chrome rows: /home and /site are not routes.
                 privacy keeps its fixed one, like tech-rider does. -->
            <span v-if="!NON_PAGE_MODULES.has(mod.slug) || mod.slug === 'privacy'" class="ml-2 text-xs text-zinc-500">/{{ mod.slug === 'tech-rider' ? 'rider' : effectiveSlug(mod.custom_slug?.[primaryLocale], mod.slug) }}</span>
          </div>

          <!-- Status badge. Hidden with the toggle for rows the public build
               never switches off — a badge that can only ever read "Live"
               is a control pretending to be one. -->
          <span
            v-if="!ALWAYS_ON_MODULES.has(mod.slug)"
            class="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            :class="badgeClass(mod.enabled)"
          >
            {{ mod.enabled ? $t('pages.modules.live') : $t('pages.modules.off') }}
          </span>

          <!-- Edit button -->
          <button
            class="flex-shrink-0 p-1 rounded transition-colors"
            :class="editIconClass(editingSlug === mod.slug)"
            :aria-label="$t('pages.modules.editSettings', { name: mod.display_name })"
            @click="editingSlug === mod.slug ? cancelEdit() : startEdit(mod)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

          <!-- Toggle -->
          <label v-if="!ALWAYS_ON_MODULES.has(mod.slug)" class="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-400 flex-shrink-0">
            <input
              type="checkbox"
              class="w-4 h-4 rounded accent-teal-500"
              :checked="mod.enabled"
              :disabled="toggleModule.isPending.value"
              @change="toggleModule.mutate({ slug: mod.slug, enabled: !mod.enabled })"
            />
            {{ mod.enabled ? $t('pages.modules.enabled') : $t('pages.modules.disabled') }}
          </label>
        </div>

        <!-- ── Expand area ── -->
        <div v-if="editingSlug === mod.slug" class="border-t border-zinc-800 px-4 py-3 flex flex-col gap-3">

          <!-- Custom name inputs -->
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.modules.customName') }}</span>
            <TranslatedField
              v-model="draftName"
              kind="input"
              :field-key="`module.${mod.slug}.customName`"
              :label="$t('pages.modules.customName')"
              :maxlength="80"
              :placeholders="Object.fromEntries(LOCALES.map(l => [l, mod.display_name]))"
            />
          </div>

          <!-- URL slug. TranslatedSlugInput like every other slug field in the
               admin, but with no `sources`: that suppresses the regenerate
               button, since this field exists to break the label→URL coupling
               regenerating would reintroduce. `hints` carry the resolved path
               preview instead. -->
          <p v-if="!isPageModule" class="text-xs text-zinc-500">{{ $t('pages.modules.chromeNote') }}</p>

          <div v-if="isPageModule" class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.modules.urlSlug') }}</span>
            <TranslatedSlugInput
              v-model="draftSlug"
              editing
              :maxlength="60"
              :placeholders="Object.fromEntries(LOCALES.map(l => [l, mod.slug]))"
              :errors="Object.fromEntries(LOCALES.map(l => [l, fieldErrors[`custom_slug.${l}`]?.[0]]))"
              :hints="Object.fromEntries(LOCALES.map(l => [l, previewPath(mod, l, draftSlug[l])]))"
            />
            <!-- <i18n-t>, not a parameter: {path} is a <code> element, and an
                 interpolated parameter renders as escaped plain text. -->
            <i18n-t keypath="pages.modules.slugHint" tag="span" class="text-xs text-zinc-600" scope="global">
              <template #path><code class="text-zinc-500">/{{ mod.slug }}</code></template>
            </i18n-t>
          </div>

          <!-- Page copy. Which fields appear comes from the @bandms/site-copy
               registry, not from the server: settings is a free-form bag, so a
               module gains a field there without a migration. Grouped by page
               section; a group's <details> keeps the form scannable. -->
          <div v-if="settingsFields.length > 0" class="flex flex-col gap-3" data-testid="page-copy">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.modules.pageCopy') }}</span>

            <details
              v-for="(group, gi) in settingsGroups"
              :key="group.group"
              :open="gi === 0"
              class="copy-group rounded-card border border-zinc-800 bg-zinc-900/40"
              :data-copy-group="group.group"
            >
              <summary class="flex items-center justify-between gap-3 cursor-pointer select-none px-3 py-2 text-sm text-zinc-300">
                <span>{{ copyFieldGroup(group.group, uiLang) }}</span>
                <span class="text-xs text-zinc-600">{{ $t('pages.modules.fieldCount', group.fields.length, { named: { n: group.fields.length } }) }}</span>
              </summary>

              <div class="flex flex-col gap-3 px-3 pb-3 pt-1 border-t border-zinc-800">
                <TranslateFormButton
                  :fields="groupBags(group.fields)"
                  :formats="groupFormats(group.fields)"
                  @filled="onGroupFill"
                />
                <div v-for="field in group.fields" :key="field.key" class="flex flex-col gap-1">
                  <span class="text-xs text-zinc-400">{{ copyFieldLabel(field, uiLang) }}</span>
                  <TranslatedField
                    v-model="draftSettings[field.key]"
                    :kind="field.type === 'textarea' ? 'textarea' : 'input'"
                    :field-key="copyFieldKey(field.key)"
                    :id-prefix="`set-${field.key}`"
                    :label="copyFieldLabel(field, uiLang)"
                    :rows="3"
                    :maxlength="field.maxLength"
                    :placeholders="Object.fromEntries(LOCALES.map(l => [l, field.placeholder(l)]))"
                    :errors="Object.fromEntries(LOCALES.map(l => [l, fieldErrors[`settings.${field.key}.${l}`]?.[0]]))"
                  />
                  <span v-if="field.help" class="text-xs text-zinc-600">{{ copyFieldHelp(field, uiLang) }}</span>
                </div>
              </div>
            </details>

            <span class="text-xs text-zinc-600">{{ $t('pages.modules.pageCopyHint') }}</span>
          </div>

          <!-- Section visibility. Which toggles appear comes from
               MODULE_VISIBILITY_SCHEMA — a module absent from it shows none,
               same additive-and-safe rule as page copy. Independent of the
               module's own `enabled` switch, which controls the whole page. -->
          <div v-if="visibilityFields.length > 0" class="flex flex-col gap-2">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.modules.visibility') }}</span>

            <label
              v-for="field in visibilityFields"
              :key="field.key"
              :for="`visibility-${field.key}`"
              class="flex items-start gap-2.5 text-sm text-zinc-300 cursor-pointer select-none"
            >
              <input
                :id="`visibility-${field.key}`"
                v-model="draftVisibility[field.key]"
                type="checkbox"
                class="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <span class="flex flex-col gap-0.5">
                <span>{{ $t(`pages.visibility.${mod.slug}.${field.key}`) }}</span>
                <span v-if="field.help" class="text-xs text-zinc-600">{{ $t(`pages.visibility.${mod.slug}.${field.key}_help`) }}</span>
              </span>
            </label>

            <span class="text-xs text-zinc-600">{{ $t('pages.modules.rebuildNote') }}</span>
          </div>

          <!-- Content width. Read by BaseLayout on the public site; detail
               pages (a show, a post, a release) follow their section. -->
          <div v-if="hasContentWidth(mod.slug)" class="flex flex-col gap-1.5">
            <label :for="`content-width-${mod.slug}`" class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.modules.contentWidth') }}</label>
            <select
              :id="`content-width-${mod.slug}`"
              v-model="draftWidth"
              data-testid="content-width"
              class="w-44 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option value="full">{{ $t('pages.modules.contentWidthFull') }}</option>
              <option value="limited">{{ $t('pages.modules.contentWidthLimited') }}</option>
            </select>
            <span class="text-xs text-zinc-600">{{ $t('pages.modules.contentWidthHelp') }}</span>
          </div>

          <!-- Per-page select (list modules only) -->
          <div v-if="isPageModule && LIST_SLUGS.has(mod.slug)" class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.modules.perPage') }}</span>
            <select
              v-model="draftPerPage"
              class="w-44 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option :value="null">{{ $t('pages.modules.perPageDefault') }}</option>
              <option v-for="n in PER_PAGE_OPTIONS" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-1">
            <button
              class="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              @click="cancelEdit"
            >
              {{ $t('common.actions.cancel') }}
            </button>
            <button
              class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-[#fff] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="updateSettings.isPending.value || !isDirty"
              @click="saveEdit(mod.slug)"
            >
              {{ updateSettings.isPending.value ? $t('common.actions.saving') : $t('common.actions.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </AdminLayout>
</template>

<style scoped src="../../components/admin/form-styles.css" />
