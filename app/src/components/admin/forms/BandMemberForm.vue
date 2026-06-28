<script setup lang="ts">
import { reactive, ref, watch, onUnmounted } from 'vue'
import RichEditor from '@/components/admin/RichEditor.vue'
import SocialLinksEditor from '@/components/admin/forms/SocialLinksEditor.vue'
import type { BandMember, BandMemberPayload } from '@/types/bandMember'
import type { Instrument } from '@/types/instrument'
import type { SocialLinkPayload } from '@/types/socialLink'

const props = defineProps<{
  initial?: BandMember | null
  loading?: boolean
  errors?: Record<string, string[]>
  availableInstruments?: Instrument[]
}>()

const emit = defineEmits<{ submit: [BandMemberPayload]; cancel: [] }>()

const STAGE_PLOT_ICONS: Record<string, string> = {
  drums: '🥁', guitar_amp: '🎸', bass_amp: '🎸', keyboard: '🎹',
  vocalist: '🎤', acoustic_guitar: '🎸', violin: '🎻', brass: '🎺',
  monitor_wedge: '🔊', di_box: '🔌', rack: '📦', custom: '⚙️',
}

const form = reactive({
  first_name: '',
  nickname: '',
  last_name: '',
  role: '',
  photo: '',
  bio: '',
  is_current: true,
  joined_at: '',
  quit_at: '',
  calendar_url: '',
  login_email: '',
  instrument_ids: [] as number[],
  main_instrument_id: null as number | null,
})

// Photo upload state
const photoFile       = ref<File | null>(null)
const photoPreview    = ref('')
const photoInput      = ref<HTMLInputElement | null>(null)
const photoDragActive = ref(false)

function pickPhotoFile(file: File | null) {
  if (!file || !file.type.startsWith('image/')) return
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoFile.value    = file
  photoPreview.value = URL.createObjectURL(file)
}
function onPhotoInputChange(e: Event) {
  pickPhotoFile((e.target as HTMLInputElement).files?.[0] ?? null)
  if (photoInput.value) photoInput.value.value = ''
}
function onPhotoDrop(e: DragEvent) {
  photoDragActive.value = false
  pickPhotoFile(e.dataTransfer?.files?.[0] ?? null)
}
function clearPhoto() {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoFile.value    = null
  photoPreview.value = ''
  form.photo         = ''
}
onUnmounted(() => { if (photoPreview.value) URL.revokeObjectURL(photoPreview.value) })

const socialLinks = ref<SocialLinkPayload[]>([])

watch(
  () => props.initial,
  (val) => {
    form.first_name          = val?.first_name ?? ''
    form.nickname            = val?.nickname ?? ''
    form.last_name           = val?.last_name ?? ''
    form.role                = val?.role ?? ''
    form.photo               = val?.photo ?? ''
    form.bio                 = val?.bio ?? ''
    form.is_current          = val?.is_current ?? true
    form.joined_at           = val?.joined_at ?? ''
    form.quit_at             = val?.quit_at ?? ''
    form.calendar_url        = val?.calendar_url ?? ''
    form.login_email         = val?.login_email ?? ''
    form.instrument_ids      = val?.instruments?.map((i) => i.id) ?? []
    form.main_instrument_id  = val?.main_instrument_id ?? null

    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
    photoFile.value    = null
    photoPreview.value = ''

    socialLinks.value = (val?.social_links ?? []).map((l) => ({ platform: l.platform, url: l.url }))
  },
  { immediate: true },
)

function selectMainInstrument(id: number) {
  form.main_instrument_id = id
  // Auto-add to also-plays list if not already there
  if (!form.instrument_ids.includes(id)) {
    form.instrument_ids.push(id)
  }
}

function toggleAlsoPlays(id: number) {
  const idx = form.instrument_ids.indexOf(id)
  if (idx === -1) {
    form.instrument_ids.push(id)
  } else {
    form.instrument_ids.splice(idx, 1)
    // If the deselected instrument was the main one, clear it
    if (form.main_instrument_id === id) {
      form.main_instrument_id = null
    }
  }
}

function submit() {
  emit('submit', {
    first_name:          form.first_name,
    nickname:            form.nickname || null,
    last_name:           form.last_name,
    role:                form.role || null,
    photo:               photoFile.value ? null : (form.photo || null),
    photo_file:          photoFile.value,
    bio:                 form.bio || null,
    is_current:          form.is_current,
    joined_at:           form.joined_at || null,
    quit_at:             form.is_current ? null : (form.quit_at || null),
    calendar_url:        form.calendar_url || null,
    login_email:         form.login_email,
    instrument_ids:      form.instrument_ids,
    main_instrument_id:  form.main_instrument_id,
    social_links:        socialLinks.value,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">

    <div class="form-cols">

      <!-- ── Left panel (80%) ─────────────────────────────────── -->
      <div class="form-col-main">

        <!-- Name row: first · nickname · last -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="field-label">First name <span style="color:#f87171;">*</span></label>
            <input v-model="form.first_name" required class="field-input" placeholder="Jane" />
            <p v-if="errors?.first_name" class="field-error">{{ errors.first_name[0] }}</p>
          </div>
          <div>
            <label class="field-label">Nickname <span class="hint">(optional)</span></label>
            <input v-model="form.nickname" class="field-input" placeholder="JJ" />
            <p v-if="errors?.nickname" class="field-error">{{ errors.nickname[0] }}</p>
          </div>
          <div>
            <label class="field-label">Last name <span style="color:#f87171;">*</span></label>
            <input v-model="form.last_name" required class="field-input" placeholder="Smith" />
            <p v-if="errors?.last_name" class="field-error">{{ errors.last_name[0] }}</p>
          </div>
        </div>

        <!-- Role + Google Calendar in one row -->
      <div class="grid grid-cols-3 gap-3">
          <div>
              <label class="field-label">Email address <span style="color:#f87171;">*</span></label>
              <input v-model="form.login_email" type="email" required class="field-input" placeholder="member@example.com" />
              <p v-if="errors?.login_email" class="field-error">{{ errors.login_email[0] }}</p>
          </div>
          <div>
            <label class="field-label">Google Calendar link <span class="hint">(optional)</span></label>
            <input v-model="form.calendar_url" class="field-input" placeholder="https://calendar.google.com/…" />
            <p v-if="errors?.calendar_url" class="field-error">{{ errors.calendar_url[0] }}</p>
          </div>
          <div>
              <label class="field-label">Role</label>
              <input v-model="form.role" class="field-input" placeholder="Vocalist, Guitarist…" />
              <p v-if="errors?.role" class="field-error">{{ errors.role[0] }}</p>
          </div>
        </div>

        <div>
          <label class="field-label">Bio</label>
          <RichEditor v-model="form.bio" placeholder="Short biography…" />
          <p v-if="errors?.bio" class="field-error">{{ errors.bio[0] }}</p>
        </div>

        <SocialLinksEditor v-model="socialLinks" />

      </div>

      <!-- ── Right panel (20%) ────────────────────────────────── -->
      <div class="form-col-aside">

        <!-- Photo -->
        <div>
          <label class="field-label">Photo</label>
          <div class="aside-avatar-wrap">
            <img
              v-if="photoPreview || form.photo"
              :src="photoPreview || form.photo"
              alt="Avatar preview"
              class="aside-avatar-img"
            />
            <div v-else class="aside-avatar-placeholder">
              {{ form.first_name ? form.first_name[0] : '?' }}{{ form.last_name ? form.last_name[0] : '' }}
            </div>
          </div>
          <div
            class="aside-drop"
            :class="{ 'aside-drop--active': photoDragActive, 'aside-drop--has': !!(photoPreview || form.photo) }"
            @dragover.prevent="photoDragActive = true"
            @dragleave="photoDragActive = false"
            @drop.prevent="onPhotoDrop"
            @click="photoInput?.click()"
          >
            <span class="aside-drop-label">{{ photoPreview || form.photo ? 'Replace' : 'Upload photo' }}</span>
            <span class="aside-drop-hint">JPG · PNG · WebP</span>
            <input ref="photoInput" type="file" accept="image/*" style="display:none" @change="onPhotoInputChange" />
          </div>
          <button
            v-if="photoPreview || form.photo"
            type="button"
            class="aside-clear"
            @click.stop="clearPhoto"
          >✕ Remove photo</button>
          <p v-if="errors?.photo" class="field-error">{{ errors.photo[0] }}</p>
        </div>

        <!-- Status -->
        <div>
          <label class="field-label">Status</label>
          <label class="toggle-label">
            <button
              type="button"
              class="toggle"
              :class="{ 'toggle--on': form.is_current }"
              @click="form.is_current = !form.is_current"
              :aria-pressed="form.is_current"
            >
              <span class="toggle-thumb" />
            </button>
            <span class="text-sm" :style="form.is_current ? 'color:#e0e0e0;' : 'color:#94a3b8;'">
              {{ form.is_current ? 'Current' : 'Ex-member' }}
            </span>
          </label>
        </div>

        <!-- Joined / Quit -->
        <div>
          <label class="field-label">Joined band at</label>
          <input v-model="form.joined_at" type="date" class="field-input" />
          <p v-if="errors?.joined_at" class="field-error">{{ errors.joined_at[0] }}</p>
        </div>

        <div>
          <label class="field-label" :style="form.is_current ? 'opacity:0.35;' : ''">Quit band at</label>
          <input v-model="form.quit_at" type="date" class="field-input" :disabled="form.is_current" />
          <p v-if="errors?.quit_at" class="field-error">{{ errors.quit_at[0] }}</p>
        </div>

        <!-- Instruments -->
        <div v-if="availableInstruments?.length">

          <!-- Main instrument (single-select radio cards) -->
          <div class="member-links-heading">Main instrument</div>
          <p class="instruments-hint">Used as icon on the stage plot &amp; tech rider.</p>
          <div class="instruments-grid">
            <button
              v-for="inst in availableInstruments"
              :key="inst.id"
              type="button"
              class="main-inst-card"
              :class="{ 'main-inst-card--on': form.main_instrument_id === inst.id }"
              @click="selectMainInstrument(inst.id)"
            >
              <span v-if="inst.stage_plot_type && STAGE_PLOT_ICONS[inst.stage_plot_type]" class="main-inst-emoji">
                {{ STAGE_PLOT_ICONS[inst.stage_plot_type] }}
              </span>
              <span class="main-inst-name">{{ inst.name }}</span>
            </button>
          </div>

          <!-- Also plays (multi-select checkboxes) -->
          <div class="member-links-heading" style="margin-top:0.75rem;">Also plays</div>
          <p class="instruments-hint">Optional. All instruments this member can cover.</p>
          <div class="instruments-grid">
            <label
              v-for="inst in availableInstruments"
              :key="inst.id"
              class="instrument-check"
              :class="{ 'instrument-check--on': form.instrument_ids.includes(inst.id) }"
            >
              <input
                type="checkbox"
                :checked="form.instrument_ids.includes(inst.id)"
                class="sr-only"
                @change="toggleAlsoPlays(inst.id)"
              />
              {{ inst.name }}
            </label>
          </div>

        </div>

      </div>
    </div>

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update member' : 'Add member') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
/* ── Two-column split ───────────────────────────────────────── */
.form-cols {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}
.form-col-main {
  flex: 4;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}
.form-col-aside {
  flex: 1;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 9rem;
}

.instruments-grid { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.instruments-hint {
  font-size: 0.65rem; color: #475569; margin-bottom: 0.375rem; margin-top: -0.25rem;
}

/* ── Main instrument cards ──────────────────────────────────── */
.main-inst-card {
  display: inline-flex; flex-direction: column; align-items: center;
  gap: 0.2rem; padding: 0.375rem 0.5rem; border-radius: 0.5rem;
  font-size: 0.7rem; font-weight: 500; cursor: pointer;
  border: 1.5px solid #2a2a2a; color: #64748b;
  background: transparent; user-select: none;
  transition: border-color 100ms, color 100ms, background 100ms;
  line-height: 1.2;
}
.main-inst-card:hover { border-color: #555555; color: #94a3b8; }
.main-inst-card--on {
  border-color: #888888; color: #ffffff;
  background: #2a2a2a;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.15);
}
.main-inst-emoji { font-size: 1rem; line-height: 1; }
.main-inst-name  { font-size: 0.68rem; }

/* ── Also-plays checkboxes ──────────────────────────────────── */
.instrument-check {
  display: inline-flex; align-items: center;
  padding: 0.25rem 0.625rem; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 500; cursor: pointer;
  border: 1px solid #2a2a2a; color: #64748b;
  background: transparent; user-select: none;
  transition: border-color 100ms, color 100ms, background 100ms;
}
.instrument-check:hover { border-color: #555555; color: #94a3b8; }
.instrument-check--on { border-color: #888888; color: #ffffff; background: #2a2a2a; }

/* ── Status toggle ──────────────────────────────────────────── */
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle {
  position: relative; width: 2.5rem; height: 1.375rem;
  border-radius: 9999px; border: none; cursor: pointer;
  background: #2a2a2a; transition: background 200ms;
}
.toggle--on { background: #2a2a2a; }
.toggle-thumb {
  position: absolute; top: 0.1875rem; left: 0.1875rem;
  width: 1rem; height: 1rem; border-radius: 9999px;
  background: #475569; transition: transform 200ms, background 200ms;
}
.toggle--on .toggle-thumb { transform: translateX(1.125rem); background: #e0e0e0; }

/* ── Aside photo widget ─────────────────────────────────────── */
.aside-avatar-wrap {
  width: 8rem; height: 8rem; border-radius: 9999px;
  overflow: hidden; margin: 0 auto 0.75rem;
}
.aside-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.aside-avatar-placeholder {
  width: 100%; height: 100%;
  background: #2a2a2a; color: #c0c0c0;
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; font-weight: 700;
}
.aside-drop {
  border: 1.5px dashed #2a2a2a; border-radius: 0.5rem;
  padding: 0.5rem 0.625rem; cursor: pointer; text-align: center;
  display: flex; flex-direction: column; gap: 0.1rem;
  transition: border-color 120ms, background 120ms;
}
.aside-drop:hover, .aside-drop--active { border-color: #888888; background: #1a1a1a; }
.aside-drop--has { border-style: solid; border-color: #2a2a2a; }
.aside-drop-label { font-size: 0.75rem; font-weight: 600; color: #d0d0d0; }
.aside-drop-hint  { font-size: 0.65rem; color: #475569; }
.aside-clear {
  display: block; width: 100%; margin-top: 0.375rem;
  background: none; border: none; cursor: pointer;
  font-size: 0.7rem; color: #f87171; text-align: center;
  padding: 0.25rem; border-radius: 0.25rem;
  transition: background 100ms;
}
.aside-clear:hover { background: #7f1d1d22; }
</style>
