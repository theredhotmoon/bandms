<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import RichEditor from '@/components/admin/RichEditor.vue'
import BandMembersModal from '@/components/admin/BandMembersModal.vue'
import { useBandProfile } from '@/composables/useBandProfile'
import { useReleases } from '@/composables/useReleases'
import { useEpkVersions } from '@/composables/useEpkVersions'
import { ApiValidationError } from '@/api/client'

const { query, update, uploadRider, deleteRider, uploadPlot, deletePlot, syncFb } = useBandProfile()
const { query: releasesQ } = useReleases()
const { create: createVersion } = useEpkVersions()

const showSnapshotModal = ref(false)
const snapshotReason    = ref('')

async function createSnapshot() {
  try {
    await createVersion.mutateAsync({ release_reason: snapshotReason.value || null })
    toast.success('EPK snapshot created — review it on the Dashboard')
    showSnapshotModal.value = false
    snapshotReason.value = ''
  } catch {
    toast.error('Failed to create snapshot')
  }
}

type BioTab = 'short' | 'medium' | 'long' | 'full'
const bioTab = ref<BioTab>('short')

const form = reactive({
  name:       '',
  bio_short:  '',
  bio_medium: '',
  bio_long:   '',
  bio_full:   '',
  formation_year:      '' as string | number,
  hometown:            '',
  genres:              '',
  comparable_artists:  '',
  booking_email:        '',
  press_email:          '',
  tech_contact_phone:   '',
  tech_contact_email:   '',
  tech_rider_notes:     '',
  stat_spotify_monthly:     '' as string | number,
  stat_instagram_followers: '' as string | number,
  stat_tiktok_followers:    '' as string | number,
  stat_youtube_subscribers: '' as string | number,
  stat_facebook_followers:  '' as string | number,
  epk_release_id: null as number | null,
  career_level: 1 as 1 | 2 | 3 | 4,
})

const fieldErrors = ref<Record<string, string[]>>({})
const saving = ref(false)
const saved  = ref(false)

watch(
  () => query.data.value,
  (val) => {
    if (!val) return
    form.name       = val.name       ?? ''
    form.bio_short  = val.bio_short  ?? ''
    form.bio_medium = val.bio_medium ?? ''
    form.bio_long   = val.bio_long   ?? ''
    form.bio_full   = val.bio_full   ?? ''
    form.formation_year     = val.formation_year     ?? ''
    form.hometown           = val.hometown           ?? ''
    form.genres             = val.genres             ?? ''
    form.comparable_artists = val.comparable_artists ?? ''
    form.booking_email        = val.booking_email        ?? ''
    form.press_email          = val.press_email          ?? ''
    form.tech_contact_phone   = val.tech_contact_phone   ?? ''
    form.tech_contact_email   = val.tech_contact_email   ?? ''
    form.tech_rider_notes     = val.tech_rider_notes     ?? ''
    form.stat_spotify_monthly     = val.stat_spotify_monthly     ?? ''
    form.stat_instagram_followers = val.stat_instagram_followers ?? ''
    form.stat_tiktok_followers    = val.stat_tiktok_followers    ?? ''
    form.stat_youtube_subscribers = val.stat_youtube_subscribers ?? ''
    form.stat_facebook_followers  = val.stat_facebook_followers  ?? ''
    form.epk_release_id = val.epk_release_id ?? null
    form.career_level   = (val.career_level ?? 1) as 1 | 2 | 3 | 4
  },
  { immediate: true },
)

const shortChars     = computed(() => form.bio_short.toString().length)
const shortOverLimit = computed(() => shortChars.value > 280)
const bioTabHasError = (tab: BioTab) => !!(fieldErrors.value[`bio_${tab}`])

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
      bio_short:  form.bio_short  || null,
      bio_medium: form.bio_medium || null,
      bio_long:   form.bio_long   || null,
      bio_full:   form.bio_full   || null,
      formation_year:      numOrNull(form.formation_year),
      hometown:            form.hometown            || null,
      genres:              form.genres              || null,
      comparable_artists:  form.comparable_artists  || null,
      booking_email:         form.booking_email         || null,
      press_email:           form.press_email           || null,
      tech_contact_phone:    form.tech_contact_phone    || null,
      tech_contact_email:    form.tech_contact_email    || null,
      tech_rider_notes:      form.tech_rider_notes      || null,
      stat_spotify_monthly:     numOrNull(form.stat_spotify_monthly),
      stat_instagram_followers: numOrNull(form.stat_instagram_followers),
      stat_tiktok_followers:    numOrNull(form.stat_tiktok_followers),
      stat_youtube_subscribers: numOrNull(form.stat_youtube_subscribers),
      stat_facebook_followers:  numOrNull(form.stat_facebook_followers),
      epk_release_id: form.epk_release_id,
      career_level:   form.career_level,
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
    toast.success('Profile saved')
  } catch (e) {
    if (e instanceof ApiValidationError) fieldErrors.value = e.errors
    else toast.error('Failed to save')
  } finally {
    saving.value = false
  }
}

async function doSyncFb() {
  try {
    const result = await syncFb.mutateAsync()
    toast.success(`${result.likes.toLocaleString()} Facebook likes synced`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to sync Facebook likes')
  }
}

const riderInput = ref<HTMLInputElement | null>(null)
const plotInput  = ref<HTMLInputElement | null>(null)

async function handleRiderUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await uploadRider.mutateAsync(file)
    toast.success('Tech rider uploaded')
  } catch { toast.error('Upload failed') }
  if (riderInput.value) riderInput.value.value = ''
}

async function handlePlotUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await uploadPlot.mutateAsync(file)
    toast.success('Stage plot uploaded')
  } catch { toast.error('Upload failed') }
  if (plotInput.value) plotInput.value.value = ''
}

async function removeRider() {
  try { await deleteRider.mutateAsync(); toast.success('Tech rider removed') }
  catch { toast.error('Failed to remove') }
}

async function removePlot() {
  try { await deletePlot.mutateAsync(); toast.success('Stage plot removed') }
  catch { toast.error('Failed to remove') }
}

const showMembers = ref(false)

type Section = 'bio' | 'career' | 'contacts' | 'stats' | 'epk'
const section = ref<Section>('bio')
</script>

<template>
  <AdminLayout>
    <div class="p-8 max-w-3xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Band Profile</h1>
          <p class="text-xs mt-0.5" style="color:#475569;">Bio, career info, contacts, stats, and EPK settings.</p>
        </div>
        <button @click="showMembers = true" class="btn-members">
          Social Links
        </button>
      </div>

      <div v-if="query.isPending.value" class="py-16 text-center text-sm" style="color:#475569;">Loading…</div>
      <div v-else-if="query.isError.value" class="py-16 text-center text-sm" style="color:#f87171;">Failed to load profile.</div>

      <template v-else>
        <div class="section-tabs mb-6">
          <button
            v-for="s in (['bio','career','contacts','stats','epk'] as Section[])"
            :key="s"
            type="button"
            class="section-tab"
            :class="{ active: section === s }"
            @click="section = s"
          >
            {{ s === 'bio' ? 'Bio' : s === 'career' ? 'Career' : s === 'contacts' ? 'Contacts' : s === 'stats' ? 'Stats' : 'EPK' }}
          </button>
        </div>

        <form @submit.prevent="saveProfile" class="flex flex-col gap-5">

          <!-- ── BIO ─────────────────────────────────────────── -->
          <template v-if="section === 'bio'">
            <div>
              <label class="field-label">Band name <span class="field-req">*</span></label>
              <input v-model="form.name" required class="field-input" placeholder="Your band name" />
              <p v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name[0] }}</p>
            </div>

            <div>
              <label class="field-label">Bio</label>
              <div class="bio-tabs">
                <button
                  v-for="tab in (['short','medium','long','full'] as BioTab[])"
                  :key="tab"
                  type="button"
                  class="bio-tab"
                  :class="{ active: bioTab === tab, 'has-error': bioTabHasError(tab) }"
                  @click="bioTab = tab"
                >
                  {{ tab === 'short' ? 'One-liner' : tab === 'medium' ? 'Short' : tab === 'long' ? 'Long' : 'Full' }}
                </button>
              </div>

              <div v-show="bioTab === 'short'" class="bio-panel">
                <div class="bio-hint">Festival lineups, social media bios, radio intros — 1 sentence, ≤280 chars.</div>
                <div class="char-wrap">
                  <textarea v-model="form.bio_short" class="field-input bio-plain" rows="2"
                    placeholder="A single punchy sentence that captures your sound…" maxlength="300" />
                  <span class="char-count" :class="{ warn: shortChars > 240, over: shortOverLimit }">
                    {{ shortChars }}&thinsp;/&thinsp;280
                  </span>
                </div>
                <p v-if="fieldErrors.bio_short" class="field-error">{{ fieldErrors.bio_short[0] }}</p>
              </div>

              <div v-show="bioTab === 'medium'" class="bio-panel">
                <div class="bio-hint">Event listings, concert programs, booking emails — 2–3 sentences.</div>
                <textarea v-model="form.bio_medium" class="field-input bio-plain" rows="3"
                  placeholder="2–3 sentences covering where you're from, your sound, and a key highlight…" />
                <p v-if="fieldErrors.bio_medium" class="field-error">{{ fieldErrors.bio_medium[0] }}</p>
              </div>

              <div v-show="bioTab === 'long'" class="bio-panel">
                <div class="bio-hint">EPK documents, label/booking agency profiles, magazine features — 2–3 paragraphs.</div>
                <RichEditor v-model="form.bio_long" placeholder="Craft the story across 2–3 paragraphs…" />
                <p v-if="fieldErrors.bio_long" class="field-error">{{ fieldErrors.bio_long[0] }}</p>
              </div>

              <div v-show="bioTab === 'full'" class="bio-panel">
                <div class="bio-hint">Website About page, grant applications, full press kit — no length limit.</div>
                <RichEditor v-model="form.bio_full" placeholder="Write the full press biography…" />
                <p v-if="fieldErrors.bio_full" class="field-error">{{ fieldErrors.bio_full[0] }}</p>
              </div>
            </div>
          </template>

          <!-- ── CAREER ──────────────────────────────────────── -->
          <template v-if="section === 'career'">
            <div class="section-hint">Used on your EPK, booking profile, and industry pitches.</div>

            <div>
              <label class="field-label">Band level</label>
              <p class="field-hint" style="margin-bottom:0.625rem;">Sets which career checklist is shown on the dashboard and signals your current stage to the promotion tutor.</p>
              <div class="career-level-grid">
                <button
                  v-for="lvl in ([
                    { value: 1, emoji: '🎸', name: 'Garage Band',  sub: 'Just starting out' },
                    { value: 2, emoji: '🌿', name: 'Local Band',   sub: 'Building an audience' },
                    { value: 3, emoji: '🏆', name: 'Pro Band',     sub: 'Industry presence' },
                    { value: 4, emoji: '⚙️', name: 'Custom',       sub: 'Define your own goals' },
                  ] as const)"
                  :key="lvl.value"
                  type="button"
                  class="career-level-card"
                  :class="{ 'career-level-card--active': form.career_level === lvl.value }"
                  @click="form.career_level = lvl.value"
                >
                  <span class="career-level-emoji">{{ lvl.emoji }}</span>
                  <span class="career-level-name">{{ lvl.name }}</span>
                  <span class="career-level-sub">{{ lvl.sub }}</span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">Formation year</label>
                <input v-model="form.formation_year" type="number" min="1900" max="2100" class="field-input" placeholder="e.g. 2018" />
              </div>
              <div>
                <label class="field-label">Hometown / Base</label>
                <input v-model="form.hometown" class="field-input" placeholder="e.g. London, UK" />
              </div>
              <div class="col-span-2">
                <label class="field-label">Genres</label>
                <input v-model="form.genres" class="field-input" placeholder="e.g. Ska, Punk, Reggae" />
                <p class="field-hint">Comma-separated — shown as badges on your EPK.</p>
              </div>
              <div class="col-span-2">
                <label class="field-label">For fans of…</label>
                <input v-model="form.comparable_artists" class="field-input" placeholder="e.g. Rancid, The Specials, Madness" />
                <p class="field-hint">Comparable artists — helps booking agents and curators place you.</p>
              </div>
            </div>
          </template>

          <!-- ── CONTACTS ────────────────────────────────────── -->
          <template v-if="section === 'contacts'">
            <div class="section-hint">Shown publicly on your EPK — use role-specific addresses, not personal ones.</div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">Booking email</label>
                <input v-model="form.booking_email" type="email" class="field-input" placeholder="booking@yourband.com" />
                <p class="field-hint">For venue managers, festival bookers, agents.</p>
              </div>
              <div>
                <label class="field-label">Press / PR email</label>
                <input v-model="form.press_email" type="email" class="field-input" placeholder="press@yourband.com" />
                <p class="field-hint">For journalists, bloggers, playlist curators.</p>
              </div>
              <div>
                <label class="field-label">Tech contact email</label>
                <input v-model="form.tech_contact_email" type="email" class="field-input" placeholder="tech@yourband.com" />
                <p class="field-hint">For venue sound engineers — appears in the tech rider header.</p>
              </div>
              <div>
                <label class="field-label">Tech contact phone</label>
                <input v-model="form.tech_contact_phone" type="tel" class="field-input" placeholder="+48 600 000 000" />
                <p class="field-hint">Direct line for the stage/tour manager on show day.</p>
              </div>
              <div class="col-span-2">
                <label class="field-label">Sound engineer description <span style="color:#475569;font-weight:400">(for tech rider cover)</span></label>
                <textarea v-model="form.tech_rider_notes" class="field-input" rows="4"
                  placeholder="Brief description for the sound engineer — e.g. 'We are a 5-piece ska-punk band. Our show is fast-paced and loud. The most important elements are a punchy kick drum and a tight low-end mix. The bassist uses a Sansamp DI — please ensure gain staging is set appropriately.'" />
                <p class="field-hint">Appears in the cover section of every tech rider you generate. Describe your sound, stage energy, and any key technical considerations.</p>
              </div>
            </div>
          </template>

          <!-- ── STATS ───────────────────────────────────────── -->
          <template v-if="section === 'stats'">
            <div class="section-hint">Enter your current numbers manually — these appear on your EPK as social proof. Update them periodically.</div>

            <!-- Facebook likes live sync -->
            <div class="fb-sync-row">
              <div class="fb-sync-left">
                <span class="fb-sync-label">Facebook page likes</span>
                <span v-if="query.data.value?.facebook_likes != null" class="fb-sync-count">
                  {{ query.data.value.facebook_likes.toLocaleString() }}
                </span>
                <span v-else class="fb-sync-none">not synced yet</span>
                <span v-if="query.data.value?.facebook_likes_synced_at" class="fb-sync-ts">
                  · synced {{ new Date(query.data.value.facebook_likes_synced_at).toLocaleString() }}
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
                {{ syncFb.isPending.value ? 'Syncing…' : 'Sync from Facebook' }}
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">Spotify monthly listeners</label>
                <input v-model="form.stat_spotify_monthly" type="number" min="0" class="field-input" placeholder="e.g. 50000" />
              </div>
              <div>
                <label class="field-label">Instagram followers</label>
                <input v-model="form.stat_instagram_followers" type="number" min="0" class="field-input" placeholder="e.g. 12000" />
              </div>
              <div>
                <label class="field-label">TikTok followers</label>
                <input v-model="form.stat_tiktok_followers" type="number" min="0" class="field-input" placeholder="e.g. 8000" />
              </div>
              <div>
                <label class="field-label">YouTube subscribers</label>
                <input v-model="form.stat_youtube_subscribers" type="number" min="0" class="field-input" placeholder="e.g. 5000" />
              </div>
              <div>
                <label class="field-label">Facebook followers (manual)</label>
                <input v-model="form.stat_facebook_followers" type="number" min="0" class="field-input" placeholder="e.g. 3000" />
              </div>
            </div>
          </template>

          <!-- ── EPK SETTINGS ────────────────────────────────── -->
          <template v-if="section === 'epk'">
            <div class="section-hint">
              Choose which content appears on your public EPK page at <code style="color:#818cf8;">/epk</code>. Mark individual photos as EPK press shots in the Photos section. Featured press articles are toggled individually in the Press section.
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="col-span-2">
                <label class="field-label">Featured release</label>
                <select v-model="form.epk_release_id" class="field-input">
                  <option :value="null">— None —</option>
                  <option v-for="r in (releasesQ.data.value ?? [])" :key="r.id" :value="r.id">
                    {{ r.title }} ({{ r.type }}, {{ r.release_date?.slice(0,4) ?? 'no date' }})
                  </option>
                </select>
                <p class="field-hint">This release's player and streaming links appear on the EPK.</p>
              </div>
            </div>

            <div class="epk-snapshot-section">
              <div>
                <div class="field-label mb-0.5">EPK Snapshot</div>
                <p class="field-hint">Create a snapshot of the current EPK content. Once accepted on the Dashboard, it becomes the live version served at <code style="color:#818cf8;">/epk</code>.</p>
              </div>
              <button type="button" @click="showSnapshotModal = true" class="btn-snapshot">
                Create EPK snapshot
              </button>
            </div>

            <div>
              <label class="field-label">Tech rider (PDF)</label>
              <div v-if="query.data.value?.tech_rider_url" class="file-row">
                <a :href="query.data.value.tech_rider_url" target="_blank" class="file-link">View current tech rider →</a>
                <button type="button" class="btn-remove-file" :disabled="deleteRider.isPending.value" @click="removeRider">Remove</button>
              </div>
              <div v-else class="file-upload-row">
                <input ref="riderInput" type="file" accept=".pdf" style="display:none" @change="handleRiderUpload" />
                <button type="button" class="btn-upload-file" :disabled="uploadRider.isPending.value" @click="riderInput?.click()">
                  {{ uploadRider.isPending.value ? 'Uploading…' : 'Upload PDF' }}
                </button>
                <span class="file-hint">Max 10 MB</span>
              </div>
            </div>

            <div>
              <label class="field-label">Stage plot (image)</label>
              <div v-if="query.data.value?.stage_plot_url" class="file-row">
                <img :src="query.data.value.stage_plot_url" class="stage-thumb" alt="Stage plot" />
                <button type="button" class="btn-remove-file" :disabled="deletePlot.isPending.value" @click="removePlot">Remove</button>
              </div>
              <div v-else class="file-upload-row">
                <input ref="plotInput" type="file" accept="image/*" style="display:none" @change="handlePlotUpload" />
                <button type="button" class="btn-upload-file" :disabled="uploadPlot.isPending.value" @click="plotInput?.click()">
                  {{ uploadPlot.isPending.value ? 'Uploading…' : 'Upload image' }}
                </button>
                <span class="file-hint">PNG, JPG — max 4 MB</span>
              </div>
            </div>
          </template>

          <div class="flex justify-end pt-1">
            <button type="submit" :disabled="saving" class="btn-save" :class="{ 'btn-save--ok': saved }">
              {{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save profile' }}
            </button>
          </div>

        </form>
      </template>
    </div>

    <AdminModal :open="showMembers" title="Social Links" max-width="40rem" @close="showMembers = false">
      <BandMembersModal @close="showMembers = false" />
    </AdminModal>

    <AdminModal :open="showSnapshotModal" title="Create EPK Snapshot" max-width="36rem" @close="showSnapshotModal = false">
      <form @submit.prevent="createSnapshot" class="flex flex-col gap-4">
        <div class="section-hint">
          This captures the current state of your EPK (bio, photos, release, press articles, concerts) as a versioned snapshot. Review and publish it from the Dashboard.
        </div>
        <div>
          <label class="field-label">Reason / notes (optional)</label>
          <textarea v-model="snapshotReason" class="field-input" rows="3" placeholder="e.g. Updated bio and new album photos added…" />
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" @click="showSnapshotModal = false" class="btn-ghost">Cancel</button>
          <button type="submit" :disabled="createVersion.isPending.value" class="btn-primary">
            {{ createVersion.isPending.value ? 'Creating…' : 'Create snapshot' }}
          </button>
        </div>
      </form>
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.btn-members {
  padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #252350; color: #818cf8;
  transition: background 120ms, border-color 120ms;
}
.btn-members:hover { background: #1e1b4b; border-color: #4338ca; }

.section-tabs {
  display: flex; gap: 0.25rem; border-bottom: 1px solid #1a1a3a; padding-bottom: 0;
}
.section-tab {
  padding: 0.35rem 1rem; font-size: 0.8rem; font-weight: 500; color: #64748b;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: color 120ms, border-color 120ms; margin-bottom: -1px;
}
.section-tab:hover { color: #94a3b8; }
.section-tab.active { color: #a5b4fc; border-bottom-color: #6366f1; }

.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #0e0e26; border: 1px solid #1e2040;
  border-radius: 0.375rem;
}

.bio-tabs {
  display: flex; gap: 0.25rem; margin-bottom: 0.5rem;
  border-bottom: 1px solid #1a1a3a; padding-bottom: 0;
}
.bio-tab {
  padding: 0.35rem 0.85rem; font-size: 0.75rem; font-weight: 500;
  color: #64748b; background: transparent; border: none;
  border-bottom: 2px solid transparent; cursor: pointer;
  transition: color 120ms, border-color 120ms; margin-bottom: -1px;
}
.bio-tab:hover { color: #94a3b8; }
.bio-tab.active { color: #a5b4fc; border-bottom-color: #6366f1; }
.bio-tab.has-error { color: #f87171; }
.bio-tab.has-error.active { border-bottom-color: #f87171; }
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

.file-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.375rem; }
.file-link { font-size: 0.8rem; color: #818cf8; text-decoration: none; transition: color 120ms; }
.file-link:hover { color: #a5b4fc; }

.btn-remove-file {
  padding: 0.25rem 0.625rem; border-radius: 0.3rem; font-size: 0.75rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #7f1d1d; color: #f87171;
  transition: background 120ms;
}
.btn-remove-file:hover:not(:disabled) { background: #450a0a; }
.btn-remove-file:disabled { opacity: 0.4; cursor: default; }

.file-upload-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.375rem; }
.btn-upload-file {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #1e1b4b; border: 1px solid #312e81; color: #a5b4fc;
  transition: background 100ms;
}
.btn-upload-file:hover:not(:disabled) { background: #252370; }
.btn-upload-file:disabled { opacity: 0.4; cursor: default; }
.file-hint { font-size: 0.7rem; color: #475569; }

.epk-snapshot-section {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
  padding: 0.875rem 1rem; background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.5rem;
}
.btn-snapshot {
  padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; background: #1e1b4b; border: 1px solid #312e81; color: #a5b4fc;
  white-space: nowrap; transition: background 100ms;
}
.btn-snapshot:hover { background: #252370; }

.stage-thumb {
  width: 10rem; border-radius: 0.375rem; border: 1px solid #1e2040;
  object-fit: contain; background: #0e0e26;
}

.btn-save {
  padding: 0.5rem 1.5rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  transition: background 150ms, box-shadow 150ms; min-width: 8rem;
}
.btn-save:hover:not(:disabled) { background: #4f46e5; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25); }
.btn-save:disabled { opacity: 0.6; cursor: default; }
.btn-save--ok { background: #4338ca !important; }

.career-level-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;
}
@media (max-width: 640px) {
  .career-level-grid { grid-template-columns: repeat(2, 1fr); }
}
.career-level-card {
  display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
  padding: 0.75rem 0.5rem; border-radius: 0.5rem; cursor: pointer;
  background: #0e0e26; border: 1px solid #1e2040;
  transition: background 120ms, border-color 120ms;
}
.career-level-card:hover { background: #13133a; border-color: #312e81; }
.career-level-card--active { background: #161650; border-color: #6366f1; box-shadow: 0 0 0 1px #6366f1; }
.career-level-emoji { font-size: 1.35rem; line-height: 1; }
.career-level-name  { font-size: 0.78rem; font-weight: 700; color: #e2e8f0; }
.career-level-sub   { font-size: 0.65rem; color: #475569; text-align: center; }
.career-level-card--active .career-level-name { color: #a5b4fc; }
.career-level-card--active .career-level-sub  { color: #6366f1; }

.fb-sync-row {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.75rem 1rem; background: #0d1a2d; border: 1px solid #1e3a5f;
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
  background: #0d1a2d; color: #38bdf8; border: 1px solid #1e3a5f; cursor: pointer;
  transition: background 120ms; white-space: nowrap;
}
.btn-fb-sync:hover:not(:disabled) { background: #0f2540; }
.btn-fb-sync:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
