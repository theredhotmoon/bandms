<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { reactive, ref, watch } from 'vue'
import MemberPicker from '@/components/admin/forms/MemberPicker.vue'
import { useDirtyGuard, useModalGuard } from '@/composables/useDirtyGuard'
import { useRetrieveVideoMetadata } from '@/composables/useMusicVideos'
import { reportSaveError } from '@/utils/formErrors'
import type { MusicVideo, MusicVideoPayload, VideoMetadata } from '@/types/musicVideo'

/**
 * The music video form, shared by the Music Videos page and the quick-add
 * (EntityQuickAdd). It used to be inline in MusicVideosAdminView; a form a
 * modal can stack over another modal has to be a component, so the discard
 * guard travels with it (useModalGuard). The metadata a "Retrieve" fetched
 * for the URL rides along in the payload as the og_* fields, as it always
 * did; changing the URL forgets it.
 */
const props = defineProps<{
  initial?: MusicVideo | null
  members: readonly { id: number; first_name: string; last_name: string; is_current: boolean }[]
  /** Where a new video sorts: the page passes its list length. */
  nextSortOrder?: number
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [MusicVideoPayload]; cancel: [] }>()

const { t } = useI18n()
const retrieveMetadata = useRetrieveVideoMetadata()
const retrievedMeta = ref<VideoMetadata | null>(null)

const form = reactive<MusicVideoPayload>({
  title:        '',
  video_url:    '',
  published_at: null,
  sort_order:   0,
  member_ids:   [],
})

watch(() => form.video_url, () => { retrievedMeta.value = null })

const { isDirty, markClean } = useDirtyGuard(() => form)
const { cancel } = useModalGuard(isDirty, () => emit('cancel'))

watch(() => props.initial, (v) => {
  form.title          = v?.title ?? ''
  form.video_url      = v?.video_url ?? ''
  form.published_at   = v?.published_at ?? null
  form.sort_order     = v?.sort_order ?? props.nextSortOrder ?? 0
  form.member_ids     = v?.member_ids ? [...v.member_ids] : []
  retrievedMeta.value = null
  markClean()
}, { immediate: true })

function isVideoUrl(url: string): boolean {
  return /youtu(\.be|be\.com)|vimeo\.com/.test(url)
}

async function doRetrieveMetadata() {
  if (!form.video_url) return
  retrievedMeta.value = null
  try {
    const meta = await retrieveMetadata.mutateAsync(form.video_url)
    retrievedMeta.value = meta
    if (meta.title && !form.title) form.title = meta.title
  } catch (e) {
    reportSaveError(e, t('media.videos.metaFailed'))
  }
}

function submit() {
  const meta = retrievedMeta.value
  emit('submit', {
    title:        form.title,
    video_url:    form.video_url,
    published_at: form.published_at || null,
    sort_order:   Number(form.sort_order),
    member_ids:   form.member_ids ?? [],
    ...(meta ? {
      og_title:     meta.title,
      og_image:     meta.thumbnail_url,
      channel_name: meta.channel_name,
      view_count:   meta.view_count,
      duration:     meta.duration,
    } : {}),
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">{{ $t('media.videos.url') }} <span class="field-req">*</span></label>
      <div class="url-row">
        <input v-model="form.video_url" required type="url" class="field-input url-input" :placeholder="$t('media.videos.urlPlaceholder')" />
        <button
          type="button"
          class="btn-retrieve"
          :class="{ 'btn-retrieve--active': isVideoUrl(form.video_url) }"
          :disabled="!isVideoUrl(form.video_url) || retrieveMetadata.isPending.value"
          @click="doRetrieveMetadata"
        >
          <svg v-if="!retrieveMetadata.isPending.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <svg v-else class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          {{ retrieveMetadata.isPending.value ? $t('media.videos.retrieving') : $t('media.videos.retrieve') }}
        </button>
      </div>
      <p v-if="errors?.video_url" class="field-error">{{ errors.video_url[0] }}</p>
    </div>

    <!-- Metadata preview card -->
    <div v-if="retrievedMeta" class="meta-card">
      <img v-if="retrievedMeta.thumbnail_url" :src="retrievedMeta.thumbnail_url" class="meta-thumb" alt="" />
      <div class="meta-info">
        <div class="meta-title">{{ retrievedMeta.title ?? '—' }}</div>
        <div class="meta-details">
          <span v-if="retrievedMeta.channel_name" class="meta-chip">{{ retrievedMeta.channel_name }}</span>
          <span v-if="retrievedMeta.duration" class="meta-chip">{{ retrievedMeta.duration }}</span>
          <span v-if="retrievedMeta.view_count !== null" class="meta-chip">{{ $t('media.videos.views', { n: retrievedMeta.view_count?.toLocaleString() }) }}</span>
          <span v-if="retrievedMeta.view_count === null && retrievedMeta.provider_name" class="meta-chip meta-chip--dim">{{ $t('media.videos.noApiKey') }}</span>
        </div>
      </div>
    </div>

    <div>
      <label class="field-label">{{ $t('media.videos.videoTitle') }} <span class="field-req">*</span></label>
      <input v-model="form.title" required class="field-input" :placeholder="$t('media.videos.videoTitlePlaceholder')" />
      <p v-if="errors?.title" class="field-error">{{ errors.title[0] }}</p>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="field-label">{{ $t('media.videos.publishedDate') }}</label>
        <input v-model="form.published_at" type="date" class="field-input" />
      </div>
      <div>
        <label class="field-label">{{ $t('media.videos.sortOrder') }}</label>
        <input v-model="form.sort_order" type="number" min="0" class="field-input" />
      </div>
    </div>
    <MemberPicker
      v-model="form.member_ids!"
      :members="members"
      :label="$t('media.videos.whoIsIn')"
      testid="video-members"
    />
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" class="btn-ghost" @click="cancel()">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : $t('common.actions.save') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.field-req { color: var(--c-f87171); }

/* Retrieve button + URL row */
.url-row { display: flex; gap: 0.5rem; align-items: stretch; }
.url-input { flex: 1; min-width: 0; }
.btn-retrieve {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0 0.75rem; border-radius: 0.375rem; font-size: var(--fs-xs); font-weight: 500;
  white-space: nowrap; cursor: pointer;
  background: var(--c-1a1a1a); border: 1px solid var(--c-2a2a2a); color: var(--c-475569);
  transition: background 120ms, color 120ms, border-color 120ms;
  flex-shrink: 0;
}
.btn-retrieve--active { border-color: var(--c-065f46); color: var(--c-34d399); background: var(--c-0f2a1e); }
.btn-retrieve--active:hover:not(:disabled) { background: var(--c-134e35); }
.btn-retrieve:disabled { opacity: 0.45; cursor: not-allowed; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* Metadata preview card */
.meta-card {
  display: flex; gap: 0.75rem; align-items: flex-start;
  background: var(--c-111111); border: 1px solid var(--c-222222); border-radius: var(--radius-card);
  padding: 0.625rem; overflow: hidden;
}
.meta-thumb {
  width: 7rem; aspect-ratio: 16/9; object-fit: cover;
  border-radius: 0.25rem; flex-shrink: 0; display: block; background: var(--c-1a1a1a);
}
.meta-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.375rem; }
.meta-title { font-size: var(--fs-sm); font-weight: 600; color: var(--c-e2e8f0); line-height: 1.3; }
.meta-details { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.meta-chip {
  font-size: var(--fs-2xs); font-weight: 500; color: var(--c-64748b);
  background: var(--c-1e1e1e); border: 1px solid var(--c-2a2a2a);
  border-radius: 0.25rem; padding: 0.15rem 0.4rem;
}
.meta-chip--dim { color: var(--c-334155); border-color: var(--c-1e1e1e); }
</style>
