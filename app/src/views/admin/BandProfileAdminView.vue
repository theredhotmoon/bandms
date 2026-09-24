<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import RichEditor from '@/components/admin/RichEditor.vue'
import SocialLinksEditor from '@/components/admin/forms/SocialLinksEditor.vue'
import AboutBioVariantSelect from '@/components/admin/forms/AboutBioVariantSelect.vue'
import { useBandProfile } from '@/composables/useBandProfile'
import { useReleases } from '@/composables/useReleases'
import { useTechRiders } from '@/composables/useTechRiders'
import { adminUrl } from '@/config/admin'
import { useEpkVersions } from '@/composables/useEpkVersions'
import { useEpkVersionHistory } from '@/composables/useEpkVersionHistory'
import EpkVersionHistory from '@/components/admin/EpkVersionHistory.vue'
import { useSocialLinks } from '@/composables/useSocialLinks'
import type { SocialLinkPayload } from '@bandms/rider-core'
import type { BioVariant } from '@/types/bandProfile'
import BandLogoManager from '@/components/admin/BandLogoManager.vue'
import { useDirtyGuard } from '@/composables/useDirtyGuard'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()

const { query, update, syncFb } = useBandProfile()
const { query: releasesQ } = useReleases()
const { list: ridersQ } = useTechRiders()

// Only a rider with a published version can be linked — its page 404s until
// then, and the API rejects anything else. Same rule as the server.
const publishableRiders = computed(() =>
  (ridersQ.data.value ?? []).filter(r => r.published_version_number != null),
)

// A rider deleted in /admin/tech-rider after this form loaded would leave a
// stale id here, and every Save — from any tab — resends the whole form. The
// list refetches on window focus, so drop the id as soon as it is gone.
watch(publishableRiders, (riders) => {
  if (!ridersQ.isSuccess.value || form.epk_tech_rider_id == null) return
  if (!riders.some(r => r.id === form.epk_tech_rider_id)) form.epk_tech_rider_id = null
})

const riderPageUrl = adminUrl('tech-rider')
const { create: createVersion } = useEpkVersions()
const history = useEpkVersionHistory()

const showSnapshotModal = ref(false)
const snapshotReason    = ref('')

async function createSnapshot() {
  try {
    await createVersion.mutateAsync({ release_reason: snapshotReason.value || null })
    toast.success(t('band.profile.epk.created'))
    showSnapshotModal.value = false
    snapshotReason.value = ''
  } catch (e) {
    reportSaveError(e, t('band.profile.epk.createFailed'))
  }
}

const bioTab  = ref<BioVariant>('short')
const bioLang = ref<'en' | 'pl'>('en')

const form = reactive({
  name:          '',
  bio_short_en:  '',
  bio_short_pl:  '',
  bio_medium_en: '',
  bio_medium_pl: '',
  bio_long_en:   '',
  bio_long_pl:   '',
  bio_full_en:   '',
  bio_full_pl:   '',
  about_bio_variant: 'medium' as BioVariant,
  formation_year:      '' as string | number,
  hometown:            '',
  genres:              '',
  comparable_artists:  '',
  booking_email:        '',
  press_email:          '',
  contact_email:        '',
  tech_contact_phone:   '',
  tech_contact_email:   '',
  tech_rider_notes:     '',
  stat_spotify_monthly:     '' as string | number,
  stat_instagram_followers: '' as string | number,
  stat_tiktok_followers:    '' as string | number,
  stat_youtube_subscribers: '' as string | number,
  stat_facebook_followers:  '' as string | number,
  epk_release_id: null as number | null,
  epk_tech_rider_id: null as number | null,
  career_level: 1 as 1 | 2 | 3 | 4,
})

const { isDirty, markClean } = useDirtyGuard(() => form)

const fieldErrors = ref<Record<string, string[]>>({})
const saving = ref(false)
const saved  = ref(false)

const contextPins = reactive({
  epk_logo_id: null as number | null,
  tech_rider_logo_id: null as number | null,
  website_logo_id: null as number | null,
})

watch(
  () => query.data.value,
  (val) => {
    if (!val) return
    form.name          = val.name       ?? ''
    form.bio_short_en  = val.translations?.bio_short?.en  ?? val.bio_short  ?? ''
    form.bio_short_pl  = val.translations?.bio_short?.pl  ?? ''
    form.bio_medium_en = val.translations?.bio_medium?.en ?? val.bio_medium ?? ''
    form.bio_medium_pl = val.translations?.bio_medium?.pl ?? ''
    form.bio_long_en   = val.translations?.bio_long?.en   ?? val.bio_long   ?? ''
    form.bio_long_pl   = val.translations?.bio_long?.pl   ?? ''
    form.bio_full_en   = val.translations?.bio_full?.en   ?? val.bio_full   ?? ''
    form.bio_full_pl   = val.translations?.bio_full?.pl   ?? ''
    form.about_bio_variant  = val.about_bio_variant  ?? 'medium'
    form.formation_year     = val.formation_year     ?? ''
    form.hometown           = val.hometown           ?? ''
    form.genres             = val.genres             ?? ''
    form.comparable_artists = val.comparable_artists ?? ''
    form.booking_email        = val.booking_email        ?? ''
    form.press_email          = val.press_email          ?? ''
    form.contact_email        = val.contact_email        ?? ''
    form.tech_contact_phone   = val.tech_contact_phone   ?? ''
    form.tech_contact_email   = val.tech_contact_email   ?? ''
    form.tech_rider_notes     = val.tech_rider_notes     ?? ''
    form.stat_spotify_monthly     = val.stat_spotify_monthly     ?? ''
    form.stat_instagram_followers = val.stat_instagram_followers ?? ''
    form.stat_tiktok_followers    = val.stat_tiktok_followers    ?? ''
    form.stat_youtube_subscribers = val.stat_youtube_subscribers ?? ''
    form.stat_facebook_followers  = val.stat_facebook_followers  ?? ''
    form.epk_release_id = val.epk_release_id ?? null
    form.epk_tech_rider_id = val.epk_tech_rider_id ?? null
    form.career_level   = (val.career_level ?? 1) as 1 | 2 | 3 | 4
    contextPins.epk_logo_id        = val.epk_logo_id        ?? null
    contextPins.tech_rider_logo_id = val.tech_rider_logo_id ?? null
    contextPins.website_logo_id    = val.website_logo_id    ?? null
    markClean()
  },
  { immediate: true },
)

const shortChars     = computed(() => (bioLang.value === 'en' ? form.bio_short_en : form.bio_short_pl).length)
const shortOverLimit = computed(() => shortChars.value > 280)
const bioTabHasError = (tab: BioVariant) => !!(fieldErrors.value[`bio_${tab}`])

function numOrNull(v: string | number): number | null {
  const n = Number(v)
  return v === '' || v === null || isNaN(n) ? null : n
}

async function saveProfile() {
  fieldErrors.value = {}
  saving.value = true
  try {
    await update.mutateAsync({
      name:       form.name || undefined,
      bio_short:  (form.bio_short_en || form.bio_short_pl)
        ? { en: form.bio_short_en || undefined, pl: form.bio_short_pl || undefined } : null,
      bio_medium: (form.bio_medium_en || form.bio_medium_pl)
        ? { en: form.bio_medium_en || undefined, pl: form.bio_medium_pl || undefined } : null,
      bio_long:   (form.bio_long_en || form.bio_long_pl)
        ? { en: form.bio_long_en || undefined, pl: form.bio_long_pl || undefined } : null,
      bio_full:   (form.bio_full_en || form.bio_full_pl)
        ? { en: form.bio_full_en || undefined, pl: form.bio_full_pl || undefined } : null,
      about_bio_variant: form.about_bio_variant,
      formation_year:      numOrNull(form.formation_year),
      hometown:            form.hometown            || null,
      genres:              form.genres              || null,
      comparable_artists:  form.comparable_artists  || null,
      booking_email:         form.booking_email         || null,
      press_email:           form.press_email           || null,
      contact_email:         form.contact_email         || null,
      tech_contact_phone:    form.tech_contact_phone    || null,
      tech_contact_email:    form.tech_contact_email    || null,
      tech_rider_notes:      form.tech_rider_notes      || null,
      stat_spotify_monthly:     numOrNull(form.stat_spotify_monthly),
      stat_instagram_followers: numOrNull(form.stat_instagram_followers),
      stat_tiktok_followers:    numOrNull(form.stat_tiktok_followers),
      stat_youtube_subscribers: numOrNull(form.stat_youtube_subscribers),
      stat_facebook_followers:  numOrNull(form.stat_facebook_followers),
      epk_release_id: form.epk_release_id,
      epk_tech_rider_id: form.epk_tech_rider_id,
      career_level:   form.career_level,
    })
    saved.value = true
    markClean()
    setTimeout(() => { saved.value = false }, 2000)
    toast.success(t('band.profile.saved'))
  } catch (e) {
    reportSaveError(e, t('band.profile.saveFailed'), fieldErrors)
  } finally {
    saving.value = false
  }
}

async function saveContextPins() {
  try {
    await update.mutateAsync(contextPins)
    toast.success(t('band.profile.logoSaved'))
  } catch (e) {
    reportSaveError(e, t('band.profile.logoSaveFailed'))
  }
}

async function doSyncFb() {
  try {
    const result = await syncFb.mutateAsync()
    toast.success(t('band.profile.stats.fbSynced', { likes: result.likes.toLocaleString() }))
  } catch (e) {
    reportSaveError(e, t('band.profile.stats.fbSyncFailed'))
  }
}

type Section = 'bio' | 'career' | 'social' | 'contacts' | 'stats' | 'epk' | 'logo'
const section = ref<Section>('bio')

// ── Social links ──────────────────────────────────────────────────────────────
const { query: linksQuery, sync: linksSync } = useSocialLinks()

const profileLinks = ref<SocialLinkPayload[]>([])
const savingLinks  = ref(false)

watch(
  () => linksQuery.data.value,
  (val) => {
    profileLinks.value = (val ?? []).map((l) => ({ platform: l.platform, url: l.url }))
  },
  { immediate: true },
)

async function saveSocialLinks() {
  savingLinks.value = true
  try {
    await linksSync.mutateAsync(profileLinks.value)
    toast.success(t('band.profile.social.saved'))
  } catch (e) {
    reportSaveError(e, t('band.profile.social.saveFailed'))
  } finally {
    savingLinks.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8 max-w-3xl">
      <div class="mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">{{ $t('band.profile.title') }}</h1>
        <p class="text-xs mt-0.5" style="color:#475569;">{{ $t('band.profile.subtitle') }}</p>
      </div>

      <div v-if="query.isPending.value" class="py-16 text-center text-sm" style="color:#475569;">{{ $t('common.state.loading') }}</div>
      <div v-else-if="query.isError.value" class="py-16 text-center text-sm" style="color:#f87171;">{{ $t('band.profile.loadFailed') }}</div>

      <template v-else>
        <div class="section-tabs mb-6" role="tablist">
          <button
            v-for="s in (['bio','career','social','contacts','stats','epk'] as Section[])"
            :key="s"
            type="button"
            role="tab"
            class="section-tab"
            :class="{ active: section === s }"
            :aria-selected="section === s"
            @click="section = s"
          >
            {{ $t(`band.profile.tabs.${s}`) }}
          </button>
          <button key="logo" type="button" role="tab" class="section-tab" :class="{ active: section === 'logo' }" :aria-selected="section === 'logo'" @click="section = 'logo'">
            {{ $t('band.profile.tabs.logo') }}
          </button>
        </div>

        <form @submit.prevent="saveProfile" class="flex flex-col gap-5">

          <!-- ── BIO ─────────────────────────────────────────── -->
          <template v-if="section === 'bio'">
            <div>
              <label class="field-label">{{ $t('band.profile.bio.name') }} <span class="field-req">*</span></label>
              <input v-model="form.name" required class="field-input" :placeholder="$t('band.profile.bio.namePlaceholder')" />
              <p v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name[0] }}</p>
            </div>

            <div>
              <label class="field-label">{{ $t('band.profile.bio.label') }}</label>
              <div class="bio-tabs-row">
                <div class="bio-tabs">
                  <button
                    v-for="tab in (['short','medium','long','full'] as BioVariant[])"
                    :key="tab"
                    type="button"
                    class="bio-tab"
                    :class="{ active: bioTab === tab, 'has-error': bioTabHasError(tab) }"
                    @click="bioTab = tab"
                  >
                    {{ $t(`band.profile.bio.variants.${tab}`) }}
                  </button>
                </div>
                <div class="bio-lang-switcher">
                  <button type="button" class="bio-lang-btn" :class="{ active: bioLang === 'en' }" @click="bioLang = 'en'">EN</button> <!-- i18n-ignore: locale code -->
                  <button type="button" class="bio-lang-btn bio-lang-btn--pl" :class="{ active: bioLang === 'pl' }" @click="bioLang = 'pl'">PL</button> <!-- i18n-ignore: locale code -->
                </div>
              </div>

              <AboutBioVariantSelect v-model="form.about_bio_variant" />

              <div v-show="bioTab === 'short'" class="bio-panel">
                <div class="bio-hint">{{ $t('band.profile.bio.shortHint') }}</div>
                <div class="char-wrap">
                  <textarea v-show="bioLang === 'en'" v-model="form.bio_short_en" class="field-input bio-plain" rows="2"
                    :placeholder="$t('band.profile.bio.shortPlaceholderEn')" maxlength="300" />
                  <textarea v-show="bioLang === 'pl'" v-model="form.bio_short_pl" class="field-input bio-plain" rows="2"
                    :placeholder="$t('band.profile.bio.shortPlaceholderPl')" maxlength="300" />
                  <span class="char-count" :class="{ warn: shortChars > 240, over: shortOverLimit }">
                    {{ shortChars }}&thinsp;/&thinsp;280 <!-- i18n-ignore: digits and thin-space markup -->
                  </span>
                </div>
                <p v-if="fieldErrors.bio_short" class="field-error">{{ fieldErrors.bio_short[0] }}</p>
              </div>

              <div v-show="bioTab === 'medium'" class="bio-panel">
                <div class="bio-hint">{{ $t('band.profile.bio.mediumHint') }}</div>
                <textarea v-show="bioLang === 'en'" v-model="form.bio_medium_en" class="field-input bio-plain" rows="3"
                  :placeholder="$t('band.profile.bio.mediumPlaceholderEn')" />
                <textarea v-show="bioLang === 'pl'" v-model="form.bio_medium_pl" class="field-input bio-plain" rows="3"
                  :placeholder="$t('band.profile.bio.mediumPlaceholderPl')" />
                <p v-if="fieldErrors.bio_medium" class="field-error">{{ fieldErrors.bio_medium[0] }}</p>
              </div>

              <div v-show="bioTab === 'long'" class="bio-panel">
                <div class="bio-hint">{{ $t('band.profile.bio.longHint') }}</div>
                <RichEditor v-show="bioLang === 'en'" v-model="form.bio_long_en" :placeholder="$t('band.profile.bio.longPlaceholderEn')" />
                <RichEditor v-show="bioLang === 'pl'" v-model="form.bio_long_pl" :placeholder="$t('band.profile.bio.longPlaceholderPl')" />
                <p v-if="fieldErrors.bio_long" class="field-error">{{ fieldErrors.bio_long[0] }}</p>
              </div>

              <div v-show="bioTab === 'full'" class="bio-panel">
                <div class="bio-hint">{{ $t('band.profile.bio.fullHint') }}</div>
                <RichEditor v-show="bioLang === 'en'" v-model="form.bio_full_en" :placeholder="$t('band.profile.bio.fullPlaceholderEn')" />
                <RichEditor v-show="bioLang === 'pl'" v-model="form.bio_full_pl" :placeholder="$t('band.profile.bio.fullPlaceholderPl')" />
                <p v-if="fieldErrors.bio_full" class="field-error">{{ fieldErrors.bio_full[0] }}</p>
              </div>
            </div>
          </template>

          <!-- ── CAREER ──────────────────────────────────────── -->
          <template v-if="section === 'career'">
            <div class="section-hint">{{ $t('band.profile.careerTab.hint') }}</div>

            <div>
              <label class="field-label">{{ $t('band.profile.careerTab.level') }}</label>
              <p class="field-hint" style="margin-bottom:0.625rem;">{{ $t('band.profile.careerTab.levelHint') }}</p>
              <div class="career-level-grid">
                <button
                  v-for="lvl in ([
                    { value: 1, emoji: '🎸' },
                    { value: 2, emoji: '🌿' },
                    { value: 3, emoji: '🏆' },
                    { value: 4, emoji: '⚙️' },
                  ] as const)"
                  :key="lvl.value"
                  type="button"
                  class="career-level-card"
                  :class="{ 'career-level-card--active': form.career_level === lvl.value }"
                  @click="form.career_level = lvl.value"
                >
                  <span class="career-level-emoji">{{ lvl.emoji }}</span>
                  <span class="career-level-name">{{ $t(`band.career.levels.l${lvl.value}.name`) }}</span>
                  <span class="career-level-sub">{{ $t(`band.career.levels.l${lvl.value}.sub`) }}</span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">{{ $t('band.profile.careerTab.formationYear') }}</label>
                <input v-model="form.formation_year" type="number" min="1900" max="2100" class="field-input" :placeholder="$t('band.profile.careerTab.formationYearPlaceholder')" />
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.careerTab.hometown') }}</label>
                <input v-model="form.hometown" class="field-input" :placeholder="$t('band.profile.careerTab.hometownPlaceholder')" />
              </div>
              <div class="col-span-2">
                <label class="field-label">{{ $t('band.profile.careerTab.genres') }}</label>
                <input v-model="form.genres" class="field-input" :placeholder="$t('band.profile.careerTab.genresPlaceholder')" />
                <p class="field-hint">{{ $t('band.profile.careerTab.genresHint') }}</p>
              </div>
              <div class="col-span-2">
                <label class="field-label">{{ $t('band.profile.careerTab.comparable') }}</label>
                <input v-model="form.comparable_artists" class="field-input" :placeholder="$t('band.profile.careerTab.comparablePlaceholder')" />
                <p class="field-hint">{{ $t('band.profile.careerTab.comparableHint') }}</p>
              </div>
            </div>
          </template>

          <!-- ── SOCIAL LINKS ──────────────────────────────────── -->
          <template v-if="section === 'social'">
            <div class="section-hint">{{ $t('band.profile.social.hint') }}</div>
            <div v-if="linksQuery.isPending.value" class="py-4 text-center text-xs" style="color:#475569;">{{ $t('common.state.loading') }}</div>
            <template v-else>
              <SocialLinksEditor v-model="profileLinks" />
              <div class="flex justify-end pt-2">
                <button type="button" :disabled="savingLinks" class="btn-save" @click="saveSocialLinks">
                  {{ savingLinks ? $t('common.actions.saving') : $t('band.profile.social.save') }}
                </button>
              </div>
            </template>
          </template>

          <!-- ── CONTACTS ────────────────────────────────────── -->
          <template v-if="section === 'contacts'">
            <div class="section-hint">{{ $t('band.profile.contacts.hint') }}</div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">{{ $t('band.profile.contacts.booking') }}</label>
                <input v-model="form.booking_email" type="email" class="field-input" :placeholder="$t('band.profile.contacts.bookingPlaceholder')" />
                <p class="field-hint">{{ $t('band.profile.contacts.bookingHint') }}</p>
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.contacts.press') }}</label>
                <input v-model="form.press_email" type="email" class="field-input" :placeholder="$t('band.profile.contacts.pressPlaceholder')" />
                <p class="field-hint">{{ $t('band.profile.contacts.pressHint') }}</p>
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.contacts.general') }}</label>
                <input v-model="form.contact_email" type="email" class="field-input" :placeholder="$t('band.profile.contacts.generalPlaceholder')" />
                <p class="field-hint">{{ $t('band.profile.contacts.generalHint') }}</p>
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.contacts.techEmail') }}</label>
                <input v-model="form.tech_contact_email" type="email" class="field-input" :placeholder="$t('band.profile.contacts.techEmailPlaceholder')" />
                <p class="field-hint">{{ $t('band.profile.contacts.techEmailHint') }}</p>
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.contacts.techPhone') }}</label>
                <input v-model="form.tech_contact_phone" type="tel" class="field-input" placeholder="+48 600 000 000" /> <!-- i18n-ignore: a phone-number shape, not prose -->
                <p class="field-hint">{{ $t('band.profile.contacts.techPhoneHint') }}</p>
              </div>
              <div class="col-span-2">
                <label class="field-label">{{ $t('band.profile.contacts.engineer') }} <span style="color:#475569;font-weight:400">{{ $t('band.profile.contacts.engineerSuffix') }}</span></label>
                <textarea v-model="form.tech_rider_notes" class="field-input" rows="4"
                  :placeholder="$t('band.profile.contacts.engineerPlaceholder')" />
                <p class="field-hint">{{ $t('band.profile.contacts.engineerHint') }}</p>
              </div>
            </div>
          </template>

          <!-- ── STATS ───────────────────────────────────────── -->
          <template v-if="section === 'stats'">
            <div class="section-hint">{{ $t('band.profile.stats.hint') }}</div>

            <!-- Facebook likes live sync -->
            <div class="fb-sync-row">
              <div class="fb-sync-left">
                <span class="fb-sync-label">{{ $t('band.profile.stats.fbLikes') }}</span>
                <span v-if="query.data.value?.facebook_likes != null" class="fb-sync-count">
                  {{ query.data.value.facebook_likes.toLocaleString() }}
                </span>
                <span v-else class="fb-sync-none">{{ $t('band.profile.stats.fbNotSynced') }}</span>
                <span v-if="query.data.value?.facebook_likes_synced_at" class="fb-sync-ts">
                  {{ $t('band.profile.stats.fbSyncedAt', { at: new Date(query.data.value.facebook_likes_synced_at).toLocaleString() }) }}
                </span>
              </div>
              <button
                type="button"
                class="btn-fb-sync"
                :disabled="syncFb.isPending.value"
                @click="doSyncFb"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                  <path d="M23 4v6h-6M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0020.49 15"/>
                </svg>
                {{ syncFb.isPending.value ? $t('band.profile.stats.fbSyncing') : $t('band.profile.stats.fbSync') }}
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">{{ $t('band.profile.stats.spotify') }}</label>
                <input v-model="form.stat_spotify_monthly" type="number" min="0" class="field-input" :placeholder="$t('band.profile.stats.spotifyPlaceholder')" />
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.stats.instagram') }}</label>
                <input v-model="form.stat_instagram_followers" type="number" min="0" class="field-input" :placeholder="$t('band.profile.stats.instagramPlaceholder')" />
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.stats.tiktok') }}</label>
                <input v-model="form.stat_tiktok_followers" type="number" min="0" class="field-input" :placeholder="$t('band.profile.stats.tiktokPlaceholder')" />
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.stats.youtube') }}</label>
                <input v-model="form.stat_youtube_subscribers" type="number" min="0" class="field-input" :placeholder="$t('band.profile.stats.youtubePlaceholder')" />
              </div>
              <div>
                <label class="field-label">{{ $t('band.profile.stats.facebook') }}</label>
                <input v-model="form.stat_facebook_followers" type="number" min="0" class="field-input" :placeholder="$t('band.profile.stats.facebookPlaceholder')" />
              </div>
            </div>
          </template>

          <!-- ── EPK SETTINGS ────────────────────────────────── -->
          <template v-if="section === 'epk'">
            <i18n-t keypath="band.profile.epk.hint" tag="div" class="section-hint" scope="global">
              <template #code><code style="color:#9ca3af;">/epk</code></template> <!-- i18n-ignore: route path -->
            </i18n-t>
            <div class="grid grid-cols-2 gap-3">
              <div class="col-span-2">
                <label class="field-label">{{ $t('band.profile.epk.featuredRelease') }}</label>
                <select v-model="form.epk_release_id" class="field-input">
                  <option :value="null">{{ $t('band.profile.epk.none') }}</option>
                  <option v-for="r in (releasesQ.data.value ?? [])" :key="r.id" :value="r.id">
                    {{ r.title }} ({{ r.type }}, {{ r.release_date?.slice(0,4) ?? $t('band.profile.epk.noDate') }})
                  </option>
                </select>
                <p class="field-hint">{{ $t('band.profile.epk.featuredHint') }}</p>
              </div>
            </div>

            <div>
              <label class="field-label" for="epk-tech-rider">{{ $t('band.profile.epk.techRider') }}</label>
              <select id="epk-tech-rider" v-model="form.epk_tech_rider_id" class="field-input" data-testid="epk-tech-rider">
                <option :value="null">{{ $t('band.profile.epk.none') }}</option>
                <option v-for="r in publishableRiders" :key="r.id" :value="r.id">
                  {{ r.name }} (v{{ r.published_version_number }})
                </option>
              </select>
              <p v-if="fieldErrors.epk_tech_rider_id" class="field-error">{{ fieldErrors.epk_tech_rider_id[0] }}</p>
              <p class="field-hint">
                {{ $t('band.profile.epk.riderHint') }}
                <RouterLink :to="riderPageUrl" class="field-hint-link">{{ $t('band.profile.epk.manageRiders') }}</RouterLink>
              </p>
            </div>

            <div class="epk-snapshot-section">
              <div>
                <div class="field-label mb-0.5">{{ $t('band.profile.epk.snapshotTitle') }}</div>
                <i18n-t keypath="band.profile.epk.snapshotHint" tag="p" class="field-hint" scope="global">
                  <template #code><code style="color:#9ca3af;">/epk</code></template> <!-- i18n-ignore: route path -->
                </i18n-t>
              </div>
              <div class="epk-snapshot-actions">
                <button type="button" @click="history.open.value = true" class="btn-history">
                  {{ $t('band.profile.epk.versionHistory') }}
                </button>
                <button type="button" @click="showSnapshotModal = true" class="btn-snapshot">
                  {{ $t('band.profile.epk.createSnapshot') }}
                </button>
              </div>
            </div>
          </template>

          <div v-if="section !== 'social' && section !== 'logo'" class="flex justify-end pt-1">
            <button type="submit" :disabled="saving || !isDirty" class="btn-save" :class="{ 'btn-save--ok': saved }">
              {{ saved ? $t('band.profile.savedBadge') : saving ? $t('common.actions.saving') : $t('band.profile.save') }}
            </button>
          </div>

        </form>

        <template v-if="section === 'logo'">
          <BandLogoManager
            :epk-logo-id="contextPins.epk_logo_id"
            :tech-rider-logo-id="contextPins.tech_rider_logo_id"
            :website-logo-id="contextPins.website_logo_id"
            @update:context-pins="async (pins) => { Object.assign(contextPins, pins); await saveContextPins() }"
          />
        </template>
      </template>
    </div>

    <EpkVersionHistory
      :open="history.open.value"
      :versions="history.versions.value"
      :loading="history.loading.value"
        :error="history.error.value"
      :publishing="history.publishing.value"
      :deleting="history.deleting.value"
      @close="history.open.value = false"
      @make-live="history.makeLive"
      @remove="history.remove"
    />

    <AdminModal :open="showSnapshotModal" :title="$t('band.profile.epk.modalTitle')" max-width="36rem" @close="showSnapshotModal = false">
      <form @submit.prevent="createSnapshot" class="flex flex-col gap-4">
        <div class="section-hint">
          {{ $t('band.profile.epk.modalHint') }}
        </div>
        <div>
          <label class="field-label">{{ $t('band.profile.epk.reason') }}</label>
          <textarea v-model="snapshotReason" class="field-input" rows="3" :placeholder="$t('band.profile.epk.reasonPlaceholder')" />
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" @click="showSnapshotModal = false" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" :disabled="createVersion.isPending.value" class="btn-primary">
            {{ createVersion.isPending.value ? $t('band.profile.epk.creating') : $t('band.profile.epk.create') }}
          </button>
        </div>
      </form>
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.section-tabs {
  display: flex; gap: 0.25rem; border-bottom: 1px solid #222222; padding-bottom: 0;
}
.section-tab {
  padding: 0.35rem 1rem; font-size: 0.8rem; font-weight: 500; color: #64748b;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: color 120ms, border-color 120ms; margin-bottom: -1px;
}
.section-tab:hover { color: #94a3b8; }
.section-tab.active { color: #d0d0d0; border-bottom-color: #888888; }

.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a;
  border-radius: 0.375rem;
}

.bio-tabs-row {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #222222;
}
.bio-tabs {
  display: flex; gap: 0.25rem; padding-bottom: 0;
}
.bio-tab {
  padding: 0.35rem 0.85rem; font-size: 0.75rem; font-weight: 500;
  color: #64748b; background: transparent; border: none;
  border-bottom: 2px solid transparent; cursor: pointer;
  transition: color 120ms, border-color 120ms; margin-bottom: -1px;
}
.bio-tab:hover { color: #94a3b8; }
.bio-tab.active { color: #d0d0d0; border-bottom-color: #888888; }
.bio-tab.has-error { color: #f87171; }
.bio-tab.has-error.active { border-bottom-color: #f87171; }
.bio-lang-switcher { display: flex; gap: 0.25rem; padding-bottom: 0.25rem; }
.bio-lang-btn {
  padding: 0.2rem 0.625rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.05em; cursor: pointer; border: 1px solid #2a2a2a;
  background: transparent; color: #475569;
  transition: background 100ms, border-color 100ms, color 100ms;
}
.bio-lang-btn:hover { background: #1a1a1a; color: #64748b; }
.bio-lang-btn.active { background: #1e3a5f; border-color: #1e4a7a; color: #60a5fa; }
.bio-lang-btn--pl.active { background: #3f1010; border-color: #5a1a1a; color: #f87171; }

.bio-panel { padding-top: 0.25rem; }
.bio-hint { font-size: 0.7rem; color: #475569; margin-bottom: 0.5rem; line-height: 1.4; }
.bio-plain { resize: vertical; }

.char-wrap { position: relative; }
.char-count {
  position: absolute; bottom: 0.5rem; right: 0.6rem;
  font-size: 0.7rem; color: #475569; pointer-events: none; font-variant-numeric: tabular-nums;
}
.char-count.warn { color: #f59e0b; }
.char-count.over { color: #f87171; }

.field-hint-link { color: #9ca3af; text-decoration: underline; margin-left: 0.25rem; }
.field-hint-link:hover { color: #d0d0d0; }

.epk-snapshot-section {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
  padding: 0.875rem 1rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.5rem;
}
.btn-snapshot {
  padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; background: #2a2a2a; border: 1px solid #444444; color: #d0d0d0;
  white-space: nowrap; transition: background 100ms;
}
.btn-snapshot:hover { background: #333333; }
.epk-snapshot-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.btn-history {
  padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #333333; color: #9ca3af;
  white-space: nowrap; transition: background 100ms;
}
.btn-history:hover { background: #1f1f1f; color: #d0d0d0; }

.btn-save {
  padding: 0.5rem 1.5rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
  transition: background 150ms, box-shadow 150ms; min-width: 8rem;
}
.btn-save:hover:not(:disabled) { background: #ffffff; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.15); }
.btn-save:disabled { opacity: 0.6; cursor: default; }
.btn-save--ok { background: #e8e8e8 !important; }

.career-level-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;
}
@media (max-width: 640px) {
  .career-level-grid { grid-template-columns: repeat(2, 1fr); }
}
.career-level-card {
  display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
  padding: 0.75rem 0.5rem; border-radius: 0.5rem; cursor: pointer;
  background: #141414; border: 1px solid #2a2a2a;
  transition: background 120ms, border-color 120ms;
}
.career-level-card:hover { background: #1a1a1a; border-color: #444444; }
.career-level-card--active { background: #1f1f1f; border-color: #888888; box-shadow: 0 0 0 1px #888888; }
.career-level-emoji { font-size: 1.35rem; line-height: 1; }
.career-level-name  { font-size: 0.78rem; font-weight: 700; color: #e2e8f0; }
.career-level-sub   { font-size: 0.65rem; color: #475569; text-align: center; }
.career-level-card--active .career-level-name { color: #d0d0d0; }
.career-level-card--active .career-level-sub  { color: #888888; }

.fb-sync-row {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.75rem 1rem; background: #111111; border: 1px solid #222222;
  border-radius: 0.5rem;
}
.fb-sync-left { display: flex; align-items: baseline; gap: 0.4rem; flex-wrap: wrap; }
.fb-sync-label { font-size: 0.75rem; font-weight: 600; color: #7c8fa6; }
.fb-sync-count { font-size: 1rem; font-weight: 700; color: #38bdf8; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.fb-sync-none  { font-size: 0.75rem; color: #334155; }
.fb-sync-ts    { font-size: 0.65rem; color: #334155; }
.btn-fb-sync {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.75rem; border-radius: 0.4rem; font-size: 0.78rem; font-weight: 500;
  background: #111111; color: #38bdf8; border: 1px solid #222222; cursor: pointer;
  transition: background 120ms; white-space: nowrap;
}
.btn-fb-sync:hover:not(:disabled) { background: #0f2540; }
.btn-fb-sync:disabled { opacity: 0.5; cursor: not-allowed; }

</style>
