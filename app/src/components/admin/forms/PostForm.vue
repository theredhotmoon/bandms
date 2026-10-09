<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, nextTick, provide, reactive, ref, watch } from 'vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import SingleImageUpload, { type ImageField } from '@/components/admin/forms/SingleImageUpload.vue'
import TranslatedSlugInput from '@/components/admin/forms/TranslatedSlugInput.vue'
import PostBlockEditor from '@/components/admin/forms/PostBlockEditor.vue'
import { useDirtyGuard, useModalGuard } from '@/composables/useDirtyGuard'
import { useContentLocales } from '@/composables/useContentLocales'
import { useAuth } from '@/composables/useAuth'
import { uploadPostImage } from '@/api/posts'
import { LOCALES, bagFrom, bagHasText, compactBag, emptyBag, shortLabel, slugPayload, type Lang } from '@/locales'
import { VISIBLE_LOCALES, loadLocaleView, saveLocaleView, visibleFor, type LocaleView } from '@/utils/editorLocales'
import { localDateTimeInputValue } from '@/utils/dateInput'
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

// Locales whose slug still follows the title — sent as null on create.
const slugAuto = ref<Partial<Record<Lang, boolean>>>({})

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
  members?: readonly { id: number; first_name: string; last_name: string }[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [PostPayload]; cancel: [] }>()

const { order: contentLocales, isPrimary } = useContentLocales()
const { token } = useAuth()
const uploadImage = (file: File) => uploadPostImage(token.value!, file)

// The sample text inside each input is written in that input's language, so it
// is looked up in that language's own admin catalogue rather than the UI
// language's. A content locale with no admin catalogue falls back to English
// sample text (vue-i18n's fallbackLocale) — harmless for a placeholder.
const titlePlaceholder = (l: Lang): string => t('content.posts.titlePlaceholder', {}, { locale: l })
const introPlaceholder = (l: Lang): string => t('content.posts.introPlaceholder', {}, { locale: l })

// ── Language view ─────────────────────────────────────────────
// A post is prose, so the writer can work in one language at a time. The
// title always shows every locale (it is the post's identity and two short
// inputs); intro and blocks follow the view. Data for a hidden locale is kept.
const view = ref<LocaleView>(loadLocaleView())
watch(view, saveLocaleView)
const visibleLocales = computed<Lang[]>(() => {
  const chosen = visibleFor(view.value, contentLocales.value)
  return chosen.length ? chosen : [...contentLocales.value]
})
provide(VISIBLE_LOCALES, visibleLocales)

// ── Form state ────────────────────────────────────────────────
const form = reactive({
  title: emptyBag(),
  slug: emptyBag(),
  intro: emptyBag(),
  // `{ url }` as loaded (nothing to submit), `{ path, url }` once a new file
  // is stored, null after Remove. An untouched picture has no `path`, so the
  // payload omits `image` and the server leaves it alone.
  image: null as ImageField | null,
  published_at: '',
  event_date_display: 'range' as 'range' | 'list',
  tag_ids: [] as number[],
  concert_ids: [] as number[],
  member_ids: [] as number[],
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

// ── Status ────────────────────────────────────────────────────
// `published_at` is a switch, not a timer (any date publishes), so the form
// shows it as one: Draft / Published, with the date only once it matters.
// The flag is its own state rather than "is the date non-empty": a
// datetime-local input reports '' while any segment is mid-edit, and deriving
// status from that would unmount the input under the cursor and flip the post
// to Draft. The date input is `required`, so an incomplete date blocks the
// save instead of silently unpublishing.
const isPublished = ref(false)

function setPublished(published: boolean) {
  isPublished.value = published
  if (published && !form.published_at) form.published_at = localDateTimeInputValue()
}

const { isDirty, markClean } = useDirtyGuard(() => ({ form, published: isPublished.value }))
const { cancel } = useModalGuard(isDirty, () => emit('cancel'))

watch(() => props.initial, (val) => {
  form.title = bagFrom(val?.translations?.title, val?.title)
  form.slug = bagFrom(val?.translations?.slug)
  form.intro = bagFrom(val?.translations?.intro, val?.intro)
  form.image = val?.image ? { url: val.image } : null
  form.published_at = val?.published_at ? val.published_at.slice(0, 16) : ''
  isPublished.value = !!val?.published_at
  form.event_date_display = val?.event_date_display ?? 'range'
  form.tag_ids = val?.tags?.map(t => t.id) ?? []
  form.concert_ids = val?.concerts?.map(c => c.id) ?? []
  form.member_ids = val?.member_ids ? [...val.member_ids] : []
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

// ── Errors ────────────────────────────────────────────────────
// A 422 lands under the offending field, which on a long post can be a long
// way above the button that was just pressed; bring it into view so the
// click never looks like it did nothing.
const formEl = ref<HTMLFormElement | null>(null)
const hasErrors = computed(() => Object.keys(props.errors ?? {}).length > 0)

watch(() => props.errors, async () => {
  if (!hasErrors.value) return
  await nextTick()
  formEl.value?.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})

function submit() {
  emit('submit', {
    // `{}` rather than null when blank: the API requires `title`, and an empty
    // object fails that rule with a message keyed `title`, which renders below.
    title: bagHasText(form.title) ? compactBag(form.title) : {},
    // Auto locales go as null only on create — the API generates slugs then;
    // on edit the form saves exactly what it shows (#153, #154).
    slug: slugPayload(form.slug, props.initial ? {} : slugAuto.value),
    intro: compactBag(form.intro),
    image: form.image === null ? null : form.image.path,
    published_at: isPublished.value ? form.published_at || null : null,
    event_date_display: form.event_date_display,
    tag_ids: form.tag_ids,
    concert_ids: form.concert_ids,
    member_ids: form.member_ids,
    // `url` is a preview-only field on image drafts; strip it before sending.
    blocks: form.blocks.map(b => ({
      type: b.type,
      payload: b.type === 'image' ? { ...b.payload, url: undefined } : b.payload,
    })),
  })
}
</script>

<template>
  <form ref="formEl" @submit.prevent="submit" class="post-form">
   <div class="pf-grid">
   <div class="pf-main">

    <!-- ── Post: what it is ─────────────────────────────────── -->
    <section class="pf-section">
      <h3 class="section-title">{{ $t('content.posts.section.post') }}</h3>
      <div class="pf-head">
        <div class="flex flex-col gap-3 min-w-0">
          <div>
            <label class="field-label" for="post-title-0">{{ $t('common.fields.title') }} <span class="field-req">*</span></label>
            <div class="trans-group">
              <div v-for="(l, idx) in contentLocales" :key="l" class="trans-row" :data-locale="l">
                <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
                <input
                  v-model="form.title[l]"
                  :id="idx === 0 ? 'post-title-0' : undefined"
                  :required="isPrimary(l) && !bagHasText(form.title)"
                  class="field-input flex-1"
                  :placeholder="titlePlaceholder(l)"
                  :aria-label="`${$t('common.fields.title')} ${shortLabel(l)}`"
                />
              </div>
            </div>
            <p v-if="errors?.title" class="field-error">{{ errors.title[0] }}</p>
          </div>
          <div>
            <label class="field-label">{{ $t('content.posts.intro') }}</label>
            <div class="trans-group">
              <div v-for="l in visibleLocales" :key="l" class="trans-row trans-row--top" :data-locale="l">
                <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
                <textarea
                  v-model="form.intro[l]"
                  class="field-input flex-1" rows="2"
                  :placeholder="introPlaceholder(l)"
                  :aria-label="`${$t('content.posts.intro')} ${shortLabel(l)}`"
                />
              </div>
            </div>
            <p v-if="errors?.intro" class="field-error">{{ errors.intro[0] }}</p>
          </div>
        </div>
        <div class="pf-cover">
          <label class="field-label">{{ $t('content.posts.cover') }}</label>
          <SingleImageUpload v-model="form.image" :upload="uploadImage" />
          <p v-if="errors?.image" class="field-error">{{ errors.image[0] }}</p>
        </div>
      </div>
    </section>

    <!-- ── Content: the post itself ─────────────────────────── -->
    <section class="pf-section">
      <PostBlockEditor v-model="form.blocks" :entities="entityLists">
        <template #tools>
          <div v-if="contentLocales.length > 1" class="segment segment--compact" role="radiogroup" :aria-label="$t('content.posts.localeView')">
            <label class="segment-option">
              <input type="radio" name="post-locale-view" value="all" v-model="view" />
              <span>{{ $t('content.posts.localeViewAll') }}</span>
            </label>
            <label v-for="l in contentLocales" :key="l" class="segment-option">
              <input type="radio" name="post-locale-view" :value="l" v-model="view" />
              <span>{{ shortLabel(l) }}</span>
            </label>
          </div>
        </template>
      </PostBlockEditor>
      <p v-if="errors?.blocks" class="field-error">{{ errors.blocks[0] }}</p>
    </section>
   </div>

   <!-- ── Publishing & links: a rail beside the content when there is room,
        pinned under the header; a last section below it otherwise. A div,
        not an aside: these are primary inputs, not complementary content,
        and a landmark inside the dialog would say otherwise. ──────── -->
   <div class="pf-rail">
    <section class="pf-section">
      <h3 class="section-title">{{ $t('content.posts.section.publishing') }}</h3>
      <div class="flex flex-col gap-4">
        <div>
          <label class="field-label">{{ $t('content.posts.status') }}</label>
          <div class="pf-status">
            <div class="segment" role="radiogroup" :aria-label="$t('content.posts.status')">
              <label class="segment-option">
                <input type="radio" name="post-status" :checked="!isPublished" @change="setPublished(false)" />
                <span>{{ $t('content.posts.draft') }}</span>
              </label>
              <label class="segment-option">
                <input type="radio" name="post-status" :checked="isPublished" @change="setPublished(true)" />
                <span>{{ $t('content.posts.statusPublished') }}</span>
              </label>
            </div>
            <input
              v-if="isPublished"
              v-model="form.published_at"
              type="datetime-local"
              required
              class="field-input pf-status-date"
              :aria-label="$t('content.posts.publishedOn')"
              :title="$t('content.posts.publishedOn')"
            />
          </div>
          <p class="field-hint">{{ isPublished ? $t('content.posts.publishedOnHint') : $t('content.posts.draftHint') }}</p>
          <p v-if="errors?.published_at" class="field-error">{{ errors.published_at[0] }}</p>
        </div>

        <div>
          <label class="field-label">{{ $t('common.fields.slug') }}</label>
          <!-- Posts are routed per language, so each locale's slug is a public
               URL: a loaded slug stays fixed and nothing auto-fills on edit. -->
          <TranslatedSlugInput
            v-model="form.slug"
            v-model:auto="slugAuto"
            :sources="form.title"
            :editing="!!initial"
            :errors="Object.fromEntries(LOCALES.map(l => [l, errors?.[`slug.${l}`]?.[0]]))"
          />
        </div>

        <EntityRelationsPanel
          :tags="tags"
          :concerts="concerts"
          v-model:tagIds="form.tag_ids"
          v-model:concertIds="form.concert_ids"
          :members="members"
          v-model:memberIds="form.member_ids"
        />

        <div v-if="form.concert_ids.length > 1">
          <label class="field-label">{{ $t('content.posts.eventDateShownAs') }}</label>
          <div class="flex gap-4">
            <label class="pf-radio">
              <input type="radio" value="range" v-model="form.event_date_display" />
              {{ $t('content.posts.dateRange') }}
            </label>
            <label class="pf-radio">
              <input type="radio" value="list" v-model="form.event_date_display" />
              {{ $t('content.posts.dateList') }}
            </label>
          </div>
        </div>
      </div>
    </section>
   </div>
   </div>

    <!-- Pinned to the bottom of the scrolling modal, so the save and what it
         will do are always one glance away however long the post gets. -->
    <div class="pf-footer">
      <p class="pf-footer-status" :class="{ 'pf-footer-status--error': hasErrors }" aria-live="polite">
        {{ hasErrors ? $t('content.posts.checkFields') : (isPublished ? $t('content.posts.footerPublished') : $t('content.posts.footerDraft')) }}
      </p>
      <div class="flex gap-2 shrink-0">
        <button type="button" @click="cancel()" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
        <button type="submit" :disabled="loading || !isDirty" class="btn-primary">
          {{ loading ? $t('common.actions.saving') : (initial ? $t('common.actions.update') : $t('common.actions.create')) }}
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
/* Two named containers: the form decides whether there is room for the rail;
   the main column decides whether its own cover grid still fits, on the width
   it is actually laid out in rather than the form's. */
.post-form {
  display: flex; flex-direction: column; container: post-form / inline-size;
  /* 0.75rem padding ×2 + a 13px/1.4 button at 0.5rem padding ×2 + 1px border. */
  --pf-footer-h: 3.75rem;
}
.pf-main { container: post-main / inline-size; }

/* One column by default: Post, Content, then Publishing & links, each
   separated by a hairline and a step of space. */
.pf-grid { display: grid; grid-template-columns: minmax(0, 1fr); }
.pf-main, .pf-rail { min-width: 0; }

.pf-section + .pf-section,
.pf-rail {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--c-222222);
}

/* With room for it, the settings become a rail beside the content: the
   article keeps the full measure, and status, slug and links stay in view
   while a long post scrolls. Queried on the form's own width, not the
   viewport, so a narrower modal falls back to one column on its own. */
@container post-form (min-width: 52rem) {
  .pf-grid { grid-template-columns: minmax(0, 1fr) 19rem; gap: 2rem; align-items: start; }
  .pf-rail {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
    padding-left: 2rem;
    border-left: 1px solid var(--c-222222);
    /* Fill the row so the hairline runs the full height of the content column. */
    align-self: stretch;
  }
  /* Pinned just under the sticky header, at the header's measured height
     plus the body's top padding. Capped to the viewport and scrollable
     inside, so a rail taller than the screen (three expanded relation
     lists) never traps its own bottom. */
  .pf-rail .pf-section {
    --rail-top: calc(var(--modal-header-h, 3.5rem) + var(--modal-pad-t, 1.25rem));
    position: sticky;
    top: var(--rail-top);
    /* The sticky footer below is this form's own (see .pf-footer), so its
       height is subtracted too or the rail's last rows hide behind it. */
    max-height: calc(100vh - var(--rail-top) - var(--pf-footer-h) - 0.5rem);
    max-height: calc(100dvh - var(--rail-top) - var(--pf-footer-h) - 0.5rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Room for the themed scrollbar without the hairline hugging the inputs. */
    padding-right: 0.25rem;
  }
}

.pf-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 12rem;
  gap: 1rem;
  align-items: start;
}
.pf-cover { min-width: 0; }
@container post-main (max-width: 30rem) {
  .pf-head { grid-template-columns: minmax(0, 1fr); }
}

.pf-status { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
.pf-status-date { width: auto; flex: 0 1 14rem; }

.pf-radio {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: var(--fs-sm); color: var(--c-c0c0c0); cursor: pointer;
}
.pf-radio input { accent-color: var(--c-ffffff); }

.pf-footer {
  position: sticky;
  bottom: -1px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  /* Bleeds to the panel edge by the modal body's own padding variables. */
  margin: 1.5rem calc(-1 * var(--modal-pad-x, 1.5rem)) calc(-1 * var(--modal-pad-b, 1.5rem));
  padding: 0.75rem var(--modal-pad-x, 1.5rem);
  background: var(--c-141414);
  border-top: 1px solid var(--c-252525);
  border-radius: 0 0 0.75rem 0.75rem;
}
.pf-footer-status {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-64748b);
  line-height: 1.4;
  min-width: 0;
}
.pf-footer-status--error { color: var(--c-f87171); }

@media (max-width: 640px) {
  .pf-footer { margin-top: 1.25rem; padding-top: 0.625rem; padding-bottom: 0.625rem; }
}
</style>
