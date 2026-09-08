<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import SingleImageUpload from '@/components/admin/forms/SingleImageUpload.vue'
import SlugInput from '@/components/admin/forms/SlugInput.vue'
import PostBlockEditor from '@/components/admin/forms/PostBlockEditor.vue'
import type { RefEntityLists } from '@/components/admin/forms/blocks/RefBlockEditor.vue'
import type { Post, PostPayload, PostBlockDraft } from '@/types/post'
import type { Tag } from '@/types/tag'
import type { Concert } from '@/types/concert'
import type { Album } from '@/types/album'
import type { ReleaseSummary } from '@/types/release'
import type { MusicVideo } from '@/types/musicVideo'
import type { PressReleaseSummary } from '@/types/press-release'
import type { ShopItemSummary } from '@/types/shop'

const props = defineProps<{
  initial?: Post | null
  tags: Tag[]
  concerts: Concert[]
  albums: Album[]
  releases: ReleaseSummary[]
  musicVideos: MusicVideo[]
  pressReleases: PressReleaseSummary[]
  shopItems: ShopItemSummary[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [PostPayload]; cancel: [] }>()

const form = reactive({
  title_en: '',
  title_pl: '',
  slug_en: '',
  slug_pl: '',
  intro_en: '',
  intro_pl: '',
  image: null as string | null,
  published_at: '',
  event_date: '',
  tag_ids: [] as number[],
  blocks: [] as PostBlockDraft[],
})

const entityLists = computed<RefEntityLists>(() => ({
  concert:       props.concerts.map(c => ({ id: c.id, label: `${c.date} — ${c.venue?.name ?? 'TBA'}` })),
  album:         props.albums.map(a => ({ id: a.id, label: a.title })),
  release:       props.releases.map(r => ({ id: r.id, label: r.title })),
  music_video:   props.musicVideos.map(v => ({ id: v.id, label: v.og_title ?? v.title })),
  press_release: props.pressReleases.map(p => ({ id: p.id, label: p.og_title ?? p.url })),
  shop_item:     props.shopItems.map(s => ({ id: s.id, label: s.name })),
}))

watch(() => props.initial, (val) => {
  form.title_en = val?.translations?.title?.en ?? val?.title ?? ''
  form.title_pl = val?.translations?.title?.pl ?? ''
  form.slug_en = val?.slug_en ?? ''
  form.slug_pl = val?.slug_pl ?? ''
  form.intro_en = val?.translations?.intro?.en ?? val?.intro ?? ''
  form.intro_pl = val?.translations?.intro?.pl ?? ''
  form.image = val?.image ?? null
  form.published_at = val?.published_at ? val.published_at.slice(0, 16) : ''
  form.event_date = val?.event_date ?? ''
  form.tag_ids = val?.tags?.map(t => t.id) ?? []
  form.blocks = (val?.blocks ?? []).map(b => {
    if (b.type === 'text')  return { type: 'text',  payload: { body: b.translations.body } }
    if (b.type === 'image') return { type: 'image', payload: { path: b.path, url: b.url, alt: b.translations.alt, caption: b.translations.caption } }
    if (b.type === 'embed') return { type: 'embed', payload: { url: b.url, label: b.label } }
    // data is null when the referenced entity was deleted — flagged rather
    // than silently defaulted to id 0, which is otherwise indistinguishable
    // from a freshly-added, never-configured block.
    return { type: 'ref', payload: { entity: b.entity, id: (b.data?.id as number) ?? 0 }, dangling: b.data === null }
  })
}, { immediate: true })

function submit() {
  emit('submit', {
    title: { en: form.title_en, pl: form.title_pl || undefined },
    slug_en: form.slug_en || null,
    slug_pl: form.slug_pl || null,
    intro: (form.intro_en || form.intro_pl) ? { en: form.intro_en || undefined, pl: form.intro_pl || undefined } : null,
    image: form.image || null,
    published_at: form.published_at || null,
    event_date: form.event_date || null,
    tag_ids: form.tag_ids,
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
      <label class="field-label">Title <span style="color:#f87171;">*</span></label>
      <div class="trans-group">
        <div class="trans-row">
          <span class="lang-badge">EN</span>
          <input v-model="form.title_en" required class="field-input flex-1" placeholder="Post title" />
        </div>
        <div class="trans-row">
          <span class="lang-badge lang-badge--pl">PL</span>
          <input v-model="form.title_pl" class="field-input flex-1" placeholder="Tytuł posta" />
        </div>
      </div>
      <p v-if="errors?.title" class="field-error">{{ errors.title[0] }}</p>
    </div>
    <div>
      <label class="field-label">Slug URL</label>
      <SlugInput
        v-model="form.slug_en"
        v-model:modelValuePl="form.slug_pl"
        :sourceEn="form.title_en"
        :sourcePl="form.title_pl"
        :bilingual="true"
      />
      <p v-if="errors?.slug_en" class="field-error">{{ errors.slug_en[0] }}</p>
      <p v-if="errors?.slug_pl" class="field-error">{{ errors.slug_pl[0] }}</p>
    </div>
    <div>
      <label class="field-label">Intro</label>
      <div class="trans-group">
        <div class="trans-row trans-row--top">
          <span class="lang-badge">EN</span>
          <textarea v-model="form.intro_en" class="field-input flex-1" rows="2" placeholder="Short introductory text shown in previews…" />
        </div>
        <div class="trans-row trans-row--top">
          <span class="lang-badge lang-badge--pl">PL</span>
          <textarea v-model="form.intro_pl" class="field-input flex-1" rows="2" placeholder="Krótki tekst wprowadzający…" />
        </div>
      </div>
      <p v-if="errors?.intro" class="field-error">{{ errors.intro[0] }}</p>
    </div>
    <div>
      <label class="field-label">Image</label>
      <SingleImageUpload v-model="form.image" />
      <p v-if="errors?.image" class="field-error">{{ errors.image[0] }}</p>
    </div>
    <div class="flex gap-4">
      <div class="flex-1">
        <label class="field-label">Publish at</label>
        <input v-model="form.published_at" type="datetime-local" class="field-input" />
        <p v-if="errors?.published_at" class="field-error">{{ errors.published_at[0] }}</p>
      </div>
      <div class="flex-1">
        <label class="field-label">Event date</label>
        <input v-model="form.event_date" type="date" class="field-input" />
        <p v-if="errors?.event_date" class="field-error">{{ errors.event_date[0] }}</p>
      </div>
    </div>

    <EntityRelationsPanel :tags="tags" v-model:tagIds="form.tag_ids" />

    <PostBlockEditor v-model="form.blocks" :entities="entityLists" />
    <p v-if="errors?.blocks" class="field-error">{{ errors.blocks[0] }}</p>

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update' : 'Create') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
