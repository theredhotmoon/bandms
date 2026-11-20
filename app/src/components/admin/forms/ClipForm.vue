<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDirtyGuard, useModalGuard } from '@/composables/useDirtyGuard'
import { useRetrieveClipMetadata } from '@/composables/useClips'
import { useContentLocaleOrder } from '@/composables/useContentLocales'
import EmbedBlockEditor from '@/components/admin/forms/blocks/EmbedBlockEditor.vue'
import ClipCategoryPicker from '@/components/admin/forms/ClipCategoryPicker.vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import { LOCALES, emptyBag } from '@/locales'
import { CLIP_SOURCES, canRetrieveMetadata, sourceMessageKey } from '@/utils/clipSources'
import { reportSaveError } from '@/utils/formErrors'
import type { ClipSource } from '@/utils/clipSources'
import type { Clip, ClipAttach, ClipOwnerType, ClipPayload } from '@/types/clip'
import type { Concert } from '@/types/concert'
import type { ReleaseSummary } from '@/types/release'
import type { ShopItemSummary } from '@/types/shop'

/**
 * One video in the library — the band's own or a fan's. A fan video carries
 * a channel credit; Retrieve fills that, the title and the thumbnail from
 * the provider. Views and duration ride along as the provider reported them
 * and are never typed.
 */
const props = defineProps<{
  initial?: Clip | null
  concerts: Concert[]
  releases: ReleaseSummary[]
  shopItems: ShopItemSummary[]
  members?: readonly { id: number; first_name: string; last_name: string }[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [ClipPayload]; cancel: [] }>()

const { t } = useI18n()
const retrieve = useRetrieveClipMetadata()
// The band's first content language — not the registry's first entry.
const contentOrder = useContentLocaleOrder()

const form = reactive({
  url: '',
  title: emptyBag(),
  category: 'live',
  source: 'official' as ClipSource,
  channel_name: '',
  channel_url: '',
  recorded_on: '',
  show_in_epk: false,
  concertIds: [] as number[],
  releaseIds: [] as number[],
  shopItemIds: [] as number[],
  memberIds: [] as number[],
})

// Owners this form has no picker for (posts link clips from the post's own
// "Link to…", albums are not offered). `attach` is the full list — an omitted
// type is detached server-side — so they are sent back exactly as loaded.
const EDITED_OWNERS: readonly ClipOwnerType[] = ['concert', 'release', 'shop_item']
let keptOwners: ClipAttach[] = []

/** What the provider said about the URL currently in the field. */
const meta = reactive({
  thumbnail_url: null as string | null,
  duration: null as string | null,
  view_count: null as number | null,
  /** The URL these values describe; a different URL makes them stale. */
  forUrl: '',
})

const { isDirty, markClean } = useDirtyGuard(() => form)
const { cancel } = useModalGuard(isDirty, () => emit('cancel'))

watch(() => props.initial, (val) => {
  form.url = val?.url ?? ''
  for (const l of LOCALES) form.title[l] = val?.translations?.title?.[l] ?? ''
  form.category = val?.category ?? 'live'
  form.source = val?.source ?? 'official'
  form.channel_name = val?.channel_name ?? ''
  form.channel_url = val?.channel_url ?? ''
  form.recorded_on = val?.recorded_on ?? ''
  form.show_in_epk = val?.show_in_epk ?? false
  form.concertIds  = val?.owners.filter(o => o.type === 'concert').map(o => o.id) ?? []
  form.releaseIds  = val?.owners.filter(o => o.type === 'release').map(o => o.id) ?? []
  form.shopItemIds = val?.owners.filter(o => o.type === 'shop_item').map(o => o.id) ?? []
  form.memberIds   = val?.member_ids ? [...val.member_ids] : []
  keptOwners = (val?.owners ?? []).filter(o => !EDITED_OWNERS.includes(o.type)).map(o => ({ type: o.type, id: o.id }))
  meta.thumbnail_url = val?.thumbnail_url ?? null
  meta.duration = val?.duration ?? null
  meta.view_count = val?.view_count ?? null
  meta.forUrl = val?.url ?? ''
  markClean()
}, { immediate: true })

// EmbedBlockEditor speaks payload objects; only `url` matters here — the clip
// has its own title, so the editor's link-label inputs are hidden via a prop.
const embedPayload = computed(() => ({ url: form.url }))

const metaIsCurrent = computed(() => meta.forUrl !== '' && meta.forUrl === form.url.trim())
const retrievable = computed(() => canRetrieveMetadata(form.url))

async function doRetrieve() {
  const url = form.url.trim()
  if (!canRetrieveMetadata(url)) return
  try {
    const m = await retrieve.mutateAsync(url)
    // A refresh of the same URL keeps what the provider did not answer this
    // time: without a YouTube key, or for Vimeo/TikTok, views and duration
    // come back null, and Save would otherwise wipe a synced count.
    const sameUrl = meta.forUrl === url
    meta.thumbnail_url = m.thumbnail_url ?? (sameUrl ? meta.thumbnail_url : null)
    meta.duration = m.duration ?? (sameUrl ? meta.duration : null)
    meta.view_count = m.view_count ?? (sameUrl ? meta.view_count : null)
    meta.forUrl = url
    // Fill blanks only: what the band typed wins over the provider.
    const first = contentOrder.value[0] ?? LOCALES[0]
    if (m.title && LOCALES.every(l => !form.title[l].trim())) form.title[first] = m.title
    if (m.channel_name && !form.channel_name.trim()) form.channel_name = m.channel_name
    if (m.channel_url && !form.channel_url.trim()) form.channel_url = m.channel_url
  } catch (e) {
    reportSaveError(e, t('band.clips.form.metaFailed'))
  }
}

function submit() {
  const attach: ClipAttach[] = [
    ...form.concertIds.map(id => ({ type: 'concert' as const, id })),
    ...form.releaseIds.map(id => ({ type: 'release' as const, id })),
    ...form.shopItemIds.map(id => ({ type: 'shop_item' as const, id })),
    ...keptOwners,
  ]
  // A new URL without a Retrieve clears the old one's thumbnail and stats;
  // an unchanged URL sends them back as they were.
  const fresh = metaIsCurrent.value
  emit('submit', {
    url: form.url.trim(),
    title: Object.fromEntries(LOCALES.map(l => [l, form.title[l].trim() || null])),
    category: form.category,
    source: form.source,
    channel_name: form.channel_name.trim() || null,
    channel_url: form.channel_url.trim() || null,
    thumbnail_url: fresh ? meta.thumbnail_url : null,
    duration: fresh ? meta.duration : null,
    view_count: fresh ? meta.view_count : null,
    recorded_on: form.recorded_on || null,
    show_in_epk: form.show_in_epk,
    member_ids: form.memberIds,
    attach,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4" data-testid="clip-form">
    <div>
      <label class="field-label">{{ $t('band.clips.form.url') }} <span style="color:var(--c-f87171);">*</span></label>
      <div class="url-row">
        <div class="url-input">
          <EmbedBlockEditor :payload="embedPayload" hide-label @update:payload="form.url = String($event.url ?? '')" />
        </div>
        <button
          type="button"
          class="btn-retrieve"
          :class="{ 'btn-retrieve--active': retrievable }"
          :disabled="!retrievable || retrieve.isPending.value"
          :title="$t('band.clips.form.retrieveHint')"
          data-testid="clip-retrieve"
          @click="doRetrieve"
        >{{ retrieve.isPending.value ? $t('band.clips.form.retrieving') : $t('band.clips.form.retrieve') }}</button>
      </div>
      <p v-if="errors?.url" class="field-error">{{ errors.url[0] }}</p>
    </div>

    <div v-if="metaIsCurrent && (meta.thumbnail_url || meta.duration || meta.view_count !== null)" class="meta-card" data-testid="clip-meta">
      <img v-if="meta.thumbnail_url" :src="meta.thumbnail_url" class="meta-thumb" alt="" />
      <div class="meta-details">
        <span v-if="meta.duration" class="meta-chip">{{ meta.duration }}</span>
        <span v-if="meta.view_count !== null" class="meta-chip">{{ $t('band.clips.form.views', { n: meta.view_count.toLocaleString() }) }}</span>
      </div>
    </div>

    <fieldset class="source-field">
      <legend class="field-label">{{ $t('band.clips.form.source') }}</legend>
      <div class="source-toggle" role="radiogroup" data-testid="clip-source">
        <label v-for="s in CLIP_SOURCES" :key="s" class="source-option" :class="{ active: form.source === s }">
          <input v-model="form.source" type="radio" name="clip-source" :value="s" class="sr-only" :data-testid="`clip-source-${s}`" />
          {{ $t(sourceMessageKey(s)) }}
        </label>
      </div>
      <p class="field-hint">{{ $t('band.clips.form.sourceHint') }}</p>
    </fieldset>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="field-label" for="clip-channel-name">{{ $t('band.clips.form.channelName') }}</label>
        <input id="clip-channel-name" v-model="form.channel_name" class="field-input" maxlength="255" data-testid="clip-channel-name" />
        <p v-if="errors?.channel_name" class="field-error">{{ errors.channel_name[0] }}</p>
      </div>
      <div>
        <label class="field-label" for="clip-channel-url">{{ $t('band.clips.form.channelUrl') }}</label>
        <input id="clip-channel-url" v-model="form.channel_url" type="url" class="field-input" maxlength="500" data-testid="clip-channel-url" />
        <p v-if="errors?.channel_url" class="field-error">{{ errors.channel_url[0] }}</p>
      </div>
    </div>
    <p v-if="form.source === 'fan'" class="field-hint" style="margin-top:-0.5rem;">{{ $t('band.clips.form.channelHint') }}</p>

    <div>
      <label class="field-label">{{ $t('common.fields.title') }}</label>
      <TranslatedField
        v-model="form.title"
        kind="input"
        field-key="clip.title"
        :label="$t('common.fields.title')"
        :placeholders="Object.fromEntries(LOCALES.map(l => [l, $t('band.clips.form.titlePlaceholder', {}, { locale: l })]))"
      />
    </div>

    <div>
      <label class="field-label">{{ $t('band.clips.columns.category') }}</label>
      <ClipCategoryPicker v-model="form.category" />
      <p v-if="errors?.category" class="field-error">{{ errors.category[0] }}</p>
    </div>

    <div class="flex gap-4 items-end">
      <div>
        <label class="field-label">{{ $t('band.clips.form.recordedOn') }}</label>
        <input v-model="form.recorded_on" type="date" class="field-input" />
      </div>
      <label class="flex items-center gap-2 pb-2" style="color:var(--c-d0d0d0); font-size:var(--fs-base);">
        <input v-model="form.show_in_epk" type="checkbox" /> {{ $t('band.clips.form.showInEpk') }}
      </label>
    </div>

    <EntityRelationsPanel
      :concerts="concerts" :releases="releases" :shop-items="shopItems" :members="members"
      v-model:concert-ids="form.concertIds" v-model:release-ids="form.releaseIds" v-model:shop-item-ids="form.shopItemIds"
      v-model:member-ids="form.memberIds"
    />

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="cancel()" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : (initial ? $t('common.actions.update') : $t('common.actions.create')) }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.url-row { display: flex; gap: 0.5rem; align-items: flex-start; }
.url-input { flex: 1; min-width: 0; }
.btn-retrieve {
  padding: 0.45rem 0.75rem; border-radius: 0.375rem; font-size: var(--fs-xs); font-weight: 500;
  white-space: nowrap; cursor: pointer; flex-shrink: 0;
  background: var(--c-1a1a1a); border: 1px solid var(--c-2a2a2a); color: var(--c-475569);
  transition: background 120ms, color 120ms, border-color 120ms;
}
.btn-retrieve--active { border-color: var(--c-065f46); color: var(--c-34d399); background: var(--c-0f2a1e); }
.btn-retrieve--active:hover:not(:disabled) { background: var(--c-134e35); }
.btn-retrieve:disabled { opacity: 0.45; cursor: not-allowed; }

.meta-card {
  display: flex; gap: 0.75rem; align-items: center;
  background: var(--c-111111); border: 1px solid var(--c-222222); border-radius: var(--radius-card);
  padding: 0.5rem;
}
.meta-thumb { width: 7rem; aspect-ratio: 16/9; object-fit: cover; border-radius: 0.25rem; display: block; background: var(--c-1a1a1a); }
.meta-details { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.meta-chip {
  font-size: var(--fs-2xs); font-weight: 500; color: var(--c-64748b);
  background: var(--c-1e1e1e); border: 1px solid var(--c-2a2a2a); border-radius: 0.25rem; padding: 0.15rem 0.4rem;
}

.source-field { border: 0; padding: 0; margin: 0; min-width: 0; }
.source-toggle { display: inline-flex; border: 1px solid var(--c-2a2a2a); border-radius: 0.4rem; overflow: hidden; }
.source-option {
  padding: 0.35rem 0.9rem; font-size: var(--fs-sm); cursor: pointer;
  color: var(--c-94a3b8); background: var(--c-141414);
}
.source-option + .source-option { border-left: 1px solid var(--c-2a2a2a); }
.source-option.active { background: var(--c-0f2540); color: var(--c-38bdf8); font-weight: 600; }
.source-option:focus-within { outline: 2px solid var(--c-38bdf8); outline-offset: -2px; }
.field-hint { font-size: var(--fs-2xs); color: var(--c-64748b); margin-top: 0.3rem; }
</style>
