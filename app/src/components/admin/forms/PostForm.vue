<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, reactive, watch } from 'vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import SingleImageUpload from '@/components/admin/forms/SingleImageUpload.vue'
import SlugInput from '@/components/admin/forms/SlugInput.vue'
import PostBlockEditor from '@/components/admin/forms/PostBlockEditor.vue'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { useContentLocales } from '@/composables/useContentLocales'
import { bagFrom, compactBag, emptyBag, shortLabel, type Lang } from '@/locales'
import type { RefEntityLists } from '@/components/admin/forms/blocks/RefBlockEditor.vue'
import type { Post, PostPayload, PostBlockDraft } from '@/types/post'
import type { Tag } from '@/types/tag'
import type { Concert } from '@/types/concert'
import type { Album } from '@/types/album'
import type { ReleaseSummary } from '@/types/release'
import type { MusicVideo } from '@/types/musicVideo'
import type { PressReleaseSummary } from '@/types/press-release'
import type { ShopItemSummary } from '@/types/shop'
import type { Clip } from '@/types/clip'

const { t } = useI18n()

const props = defineProps<{
  initial?: Post | null
  tags: Tag[]
  concerts: Concert[]
  albums: Album[]
  releases: ReleaseSummary[]
  musicVideos: MusicVideo[]
  pressReleases: PressReleaseSummary[]
  shopItems: ShopItemSummary[]
  clips: Clip[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [PostPayload]; cancel: [] }>()

const { order: contentLocales, isPrimary } = useContentLocales()

// The sample text inside each input is written in that input's language, so it
// is a per-locale map rather than one string. A third locale is a compile error
// here, which is the point: it needs its own sample sentence.
const titlePlaceholder = computed<Record<Lang, string>>(() => ({
  en: t('content.posts.titlePlaceholderEn'),
  pl: t('content.posts.titlePlaceholderPl'),
}))
const introPlaceholder = computed<Record<Lang, string>>(() => ({
  en: t('content.posts.introPlaceholderEn'),
  pl: t('content.posts.introPlaceholderPl'),
}))

const form = reactive({
  title: emptyBag(),
  slug_en: '',
  slug_pl: '',
  intro: emptyBag(),
  image: null as string | null,
  published_at: '',
  event_date_display: 'range' as 'range' | 'list',
  tag_ids: [] as number[],
  concert_ids: [] as number[],
  blocks: [] as PostBlockDraft[],
})

const entityLists = computed<RefEntityLists>(() => ({
  concert:       props.concerts.map(c => ({ id: c.id, label: `${c.date} — ${c.venue?.name ?? t('content.posts.venueTba')}` })),
  album:         props.albums.map(a => ({ id: a.id, label: a.title })),
  release:       props.releases.map(r => ({ id: r.id, label: r.title })),
  music_video:   props.musicVideos.map(v => ({ id: v.id, label: v.og_title ?? v.title })),
  press_release: props.pressReleases.map(p => ({ id: p.id, label: p.og_title ?? p.url })),
  shop_item:     props.shopItems.map(s => ({ id: s.id, label: s.name })),
  clip:          props.clips.map(c => ({
    id: c.id,
    label: [c.title ?? c.url, c.category, c.owners[0]?.label].filter(Boolean).join(' · '),
  })),
}))

const { isDirty, markClean } = useDirtyGuard(() => form)

watch(() => props.initial, (val) => {
  form.title = bagFrom(val?.translations?.title, val?.title)
  form.slug_en = val?.slug_en ?? ''
  form.slug_pl = val?.slug_pl ?? ''
  form.intro = bagFrom(val?.translations?.intro, val?.intro)
  form.image = val?.image ?? null
  form.published_at = val?.published_at ? val.published_at.slice(0, 16) : ''
  form.event_date_display = val?.event_date_display ?? 'range'
  form.tag_ids = val?.tags?.map(t => t.id) ?? []
  form.concert_ids = val?.concerts?.map(c => c.id) ?? []
  form.blocks = (val?.blocks ?? []).map(b => {
    if (b.type === 'text')  return { type: 'text',  payload: { body: b.translations.body } }
    if (b.type === 'image') return { type: 'image', payload: { path: b.path, url: b.url, alt: b.translations.alt, caption: b.translations.caption } }
    if (b.type === 'embed') return { type: 'embed', payload: { url: b.url, label: b.translations.label } }
    // data is null when the referenced entity was deleted — flagged rather
    // than silently defaulted to id 0, which is otherwise indistinguishable
    // from a freshly-added, never-configured block.
    return { type: 'ref', payload: { entity: b.entity, id: (b.data?.id as number) ?? 0 }, dangling: b.data === null }
  })
  markClean()
}, { immediate: true })

function submit() {
  emit('submit', {
    // `{}` rather than null when blank: the API requires `title`, and an empty
    // object fails that rule with a message keyed `title`, which renders below.
    title: compactBag(form.title) ?? {},
    slug_en: form.slug_en || null,
    slug_pl: form.slug_pl || null,
    intro: compactBag(form.intro),
    image: form.image || null,
    published_at: form.published_at || null,
    event_date_display: form.event_date_display,
    tag_ids: form.tag_ids,
    concert_ids: form.concert_ids,
    // `url` is a preview-only field on image drafts; strip it before sending.
    blocks: form.blocks.map(b => ({
      type: b.type,
      payload: b.type === 'image' ? { ...b.payload, url: undefined } : b.payload,
    })),
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">{{ $t('common.fields.title') }} <span style="color:#f87171;">*</span></label>
      <div class="trans-group">
        <div v-for="l in contentLocales" :key="l" class="trans-row" :data-locale="l">
          <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
          <input v-model="form.title[l]" :required="isPrimary(l)" class="field-input flex-1" :placeholder="titlePlaceholder[l]" />
        </div>
      </div>
      <p v-if="errors?.title" class="field-error">{{ errors.title[0] }}</p>
    </div>
    <div>
      <label class="field-label">{{ $t('common.fields.slug') }}</label>
      <SlugInput
        v-model="form.slug_en"
        v-model:modelValuePl="form.slug_pl"
        :sourceEn="form.title.en"
        :sourcePl="form.title.pl"
        :bilingual="true"
      />
      <p v-if="errors?.slug_en" class="field-error">{{ errors.slug_en[0] }}</p>
      <p v-if="errors?.slug_pl" class="field-error">{{ errors.slug_pl[0] }}</p>
    </div>
    <div>
      <label class="field-label">{{ $t('content.posts.intro') }}</label>
      <div class="trans-group">
        <div v-for="l in contentLocales" :key="l" class="trans-row trans-row--top" :data-locale="l">
          <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
          <textarea v-model="form.intro[l]" class="field-input flex-1" rows="2" :placeholder="introPlaceholder[l]" />
        </div>
      </div>
      <p v-if="errors?.intro" class="field-error">{{ errors.intro[0] }}</p>
    </div>
    <div>
      <label class="field-label">{{ $t('common.fields.image') }}</label>
      <SingleImageUpload v-model="form.image" />
      <p v-if="errors?.image" class="field-error">{{ errors.image[0] }}</p>
    </div>
    <div>
      <label class="field-label">{{ $t('content.posts.publishAt') }}</label>
      <input v-model="form.published_at" type="datetime-local" class="field-input" />
      <p v-if="errors?.published_at" class="field-error">{{ errors.published_at[0] }}</p>
    </div>

    <EntityRelationsPanel
      :tags="tags"
      :concerts="concerts"
      v-model:tagIds="form.tag_ids"
      v-model:concertIds="form.concert_ids"
    />

    <div v-if="form.concert_ids.length > 1">
      <label class="field-label">{{ $t('content.posts.eventDateShownAs') }}</label>
      <div class="flex gap-4">
        <label class="flex items-center gap-2 text-sm">
          <input type="radio" value="range" v-model="form.event_date_display" />
          {{ $t('content.posts.dateRange') }}
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="radio" value="list" v-model="form.event_date_display" />
          {{ $t('content.posts.dateList') }}
        </label>
      </div>
    </div>

    <PostBlockEditor v-model="form.blocks" :entities="entityLists" />
    <p v-if="errors?.blocks" class="field-error">{{ errors.blocks[0] }}</p>

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading || !isDirty" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : (initial ? $t('common.actions.update') : $t('common.actions.create')) }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
