<script setup lang="ts">
import { reactive, ref, watch, onUnmounted } from 'vue'
import RichEditor from '@/components/admin/RichEditor.vue'
import type { BandMember, BandMemberPayload } from '@/types/bandMember'
import type { Instrument } from '@/types/instrument'
import { SOCIAL_PLATFORMS } from '@/types/socialLink'
import type { SocialPlatform } from '@/types/socialLink'

const props = defineProps<{
  initial?: BandMember | null
  loading?: boolean
  errors?: Record<string, string[]>
  availableInstruments?: Instrument[]
}>()

const emit = defineEmits<{ submit: [BandMemberPayload]; cancel: [] }>()

const form = reactive({
  first_name: '',
  last_name: '',
  role: '',
  photo: '',         // existing URL from backend
  bio: '',
  is_current: true,
  joined_at: '',
  quit_at: '',
  calendar_url: '',
  login_email: '',
  can_login: false,
  instrument_ids: [] as number[],
})

// Photo upload state
const photoFile    = ref<File | null>(null)
const photoPreview = ref('')          // Object URL for picked file
const photoInput   = ref<HTMLInputElement | null>(null)
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

onUnmounted(() => {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
})

const linkUrls = reactive<Record<SocialPlatform, string>>({
  spotify: '', instagram: '', facebook: '', youtube: '',
  tiktok: '', bandcamp: '', soundcloud: '', twitter: '', website: '',
})

watch(
  () => props.initial,
  (val) => {
    form.first_name     = val?.first_name ?? ''
    form.last_name      = val?.last_name ?? ''
    form.role           = val?.role ?? ''
    form.photo          = val?.photo ?? ''
    form.bio            = val?.bio ?? ''
    form.is_current     = val?.is_current ?? true
    form.joined_at      = val?.joined_at ?? ''
    form.quit_at        = val?.quit_at ?? ''
    form.calendar_url   = val?.calendar_url ?? ''
    form.login_email    = val?.login_email ?? ''
    form.can_login      = val?.can_login ?? false
    form.instrument_ids = val?.instruments?.map((i) => i.id) ?? []

    // Reset any pending photo pick
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
    photoFile.value    = null
    photoPreview.value = ''

    for (const p of SOCIAL_PLATFORMS) linkUrls[p.key] = ''
    for (const l of val?.social_links ?? []) linkUrls[l.platform] = l.url
  },
  { immediate: true },
)

function submit() {
  emit('submit', {
    first_name:     form.first_name,
    last_name:      form.last_name,
    role:           form.role || null,
    photo:          photoFile.value ? null : (form.photo || null),
    photo_file:     photoFile.value,
    bio:            form.bio || null,
    is_current:     form.is_current,
    joined_at:      form.joined_at || null,
    quit_at:        form.is_current ? null : (form.quit_at || null),
    calendar_url:   form.calendar_url || null,
    login_email:    form.login_email || null,
    can_login:      form.can_login,
    instrument_ids: form.instrument_ids,
    social_links:   SOCIAL_PLATFORMS
      .filter((p) => linkUrls[p.key].trim())
      .map((p) => ({ platform: p.key, url: linkUrls[p.key].trim() })),
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="field-label">First name <span style="color:#f87171;">*</span></label>
        <input v-model="form.first_name" required class="field-input" placeholder="Jane" />
        <p v-if="errors?.first_name" class="field-error">{{ errors.first_name[0] }}</p>
      </div>
      <div>
        <label class="field-label">Last name <span style="color:#f87171;">*</span></label>
        <input v-model="form.last_name" required class="field-input" placeholder="Smith" />
        <p v-if="errors?.last_name" class="field-error">{{ errors.last_name[0] }}</p>
      </div>
    </div>

    <div>
      <label class="field-label">Role</label>
      <input v-model="form.role" class="field-input" placeholder="Vocalist, Guitarist…" />
      <p v-if="errors?.role" class="field-error">{{ errors.role[0] }}</p>
    </div>

    <!-- Instruments -->
    <div v-if="availableInstruments?.length">
      <div class="member-links-heading">Instruments</div>
      <div class="instruments-grid">
        <label
          v-for="inst in availableInstruments"
          :key="inst.id"
          class="instrument-check"
          :class="{ 'instrument-check--on': form.instrument_ids.includes(inst.id) }"
        >
          <input
            type="checkbox"
            :value="inst.id"
            v-model="form.instrument_ids"
            class="sr-only"
          />
          {{ inst.name }}
        </label>
      </div>
    </div>

    <!-- Photo upload -->
    <div>
      <label class="field-label">Photo</label>
      <div class="photo-upload-row">
        <!-- Current / preview avatar -->
        <div class="photo-avatar">
          <img
            v-if="photoPreview || form.photo"
            :src="photoPreview || form.photo"
            alt="Avatar preview"
            class="photo-avatar-img"
          />
          <div v-else class="photo-avatar-placeholder">
            {{ form.first_name ? form.first_name[0] : '?' }}{{ form.last_name ? form.last_name[0] : '' }}
          </div>
        </div>
        <!-- Drop zone -->
        <div
          class="photo-drop"
          :class="{ 'photo-drop--active': photoDragActive, 'photo-drop--has': !!(photoPreview || form.photo) }"
          @dragover.prevent="photoDragActive = true"
          @dragleave="photoDragActive = false"
          @drop.prevent="onPhotoDrop"
          @click="photoInput?.click()"
        >
          <span class="photo-drop-icon">{{ photoPreview || form.photo ? '🔄' : '⬆' }}</span>
          <span class="photo-drop-label">{{ photoPreview || form.photo ? 'Replace photo' : 'Upload photo' }}</span>
          <span class="photo-drop-hint">JPG, PNG, WebP · max 4 MB</span>
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            style="display:none"
            @change="onPhotoInputChange"
          />
        </div>
        <!-- Clear button -->
        <button
          v-if="photoPreview || form.photo"
          type="button"
          class="photo-clear"
          title="Remove photo"
          @click.stop="clearPhoto"
        >✕</button>
      </div>
      <p v-if="errors?.photo" class="field-error">{{ errors.photo[0] }}</p>
    </div>

    <div>
      <label class="field-label">Bio</label>
      <RichEditor v-model="form.bio" placeholder="Short biography…" />
      <p v-if="errors?.bio" class="field-error">{{ errors.bio[0] }}</p>
    </div>

    <!-- Status -->
    <div class="status-row">
      <span class="field-label mb-0">Status</span>
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
        <span class="text-sm" :style="form.is_current ? 'color:#818cf8;' : 'color:#94a3b8;'">
          {{ form.is_current ? 'Current member' : 'Ex-member' }}
        </span>
      </label>
    </div>

    <div class="grid grid-cols-2 gap-3">
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
    </div>

    <!-- Google Calendar -->
    <div>
      <label class="field-label">Google Calendar link <span class="hint">(optional)</span></label>
      <input v-model="form.calendar_url" class="field-input" placeholder="https://calendar.google.com/…" />
      <p v-if="errors?.calendar_url" class="field-error">{{ errors.calendar_url[0] }}</p>
    </div>

    <!-- System access -->
    <div class="login-section">
      <div class="member-links-heading">System access</div>
      <div class="status-row">
        <span class="field-label mb-0">Can log in to CMS</span>
        <label class="toggle-label">
          <button
            type="button"
            class="toggle"
            :class="{ 'toggle--on': form.can_login }"
            @click="form.can_login = !form.can_login"
            :aria-pressed="form.can_login"
          >
            <span class="toggle-thumb" />
          </button>
          <span class="text-sm" :style="form.can_login ? 'color:#818cf8;' : 'color:#94a3b8;'">
            {{ form.can_login ? 'Enabled' : 'Disabled' }}
          </span>
        </label>
      </div>
      <div v-if="form.can_login">
        <label class="field-label">Login email</label>
        <input v-model="form.login_email" type="email" class="field-input" placeholder="member@example.com" />
        <p class="field-hint">This email is used to link the member's band profile to their user account.</p>
        <p v-if="errors?.login_email" class="field-error">{{ errors.login_email[0] }}</p>
      </div>
    </div>

    <!-- Social links -->
    <div>
      <div class="member-links-heading">Social links</div>
      <div class="flex flex-col gap-2">
        <div v-for="p in SOCIAL_PLATFORMS" :key="p.key" class="platform-row">
          <span class="platform-dot" :style="`background:${p.color};`" />
          <span class="platform-name">{{ p.label }}</span>
          <input
            v-model="linkUrls[p.key]"
            class="field-input flex-1"
            :placeholder="`${p.label} URL…`"
          />
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
.member-links-heading {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: #a5b4fc; margin-bottom: 0.5rem;
}
.platform-row { display: flex; align-items: center; gap: 0.625rem; }
.platform-dot { width: 0.5rem; height: 0.5rem; border-radius: 9999px; flex-shrink: 0; }
.platform-name {
  font-size: 0.75rem; font-weight: 500; color: #94a3b8;
  width: 7rem; flex-shrink: 0;
}
.instruments-grid {
  display: flex; flex-wrap: wrap; gap: 0.375rem;
}
.instrument-check {
  display: inline-flex; align-items: center;
  padding: 0.25rem 0.625rem; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 500; cursor: pointer;
  border: 1px solid #1e2040; color: #64748b;
  background: transparent; user-select: none;
  transition: border-color 100ms, color 100ms, background 100ms;
}
.instrument-check:hover { border-color: #3730a3; color: #94a3b8; }
.instrument-check--on {
  border-color: #4338ca; color: #a5b4fc; background: #1e1b4b;
}
.status-row {
  display: flex; align-items: center; gap: 0.875rem;
}
.toggle-label {
  display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
}
.toggle {
  position: relative; width: 2.5rem; height: 1.375rem;
  border-radius: 9999px; border: none; cursor: pointer;
  background: #1e293b; transition: background 200ms;
}
.toggle--on { background: #1e1b4b; }
.toggle-thumb {
  position: absolute; top: 0.1875rem; left: 0.1875rem;
  width: 1rem; height: 1rem; border-radius: 9999px;
  background: #475569; transition: transform 200ms, background 200ms;
}
.toggle--on .toggle-thumb {
  transform: translateX(1.125rem); background: #818cf8;
}
.login-section {
  display: flex; flex-direction: column; gap: 0.75rem;
  padding: 0.875rem; border-radius: 0.5rem;
  border: 1px solid #1e2040; background: #0a0a1e;
}

/* ── Photo upload ─────────────────────────────── */
.photo-upload-row {
  display: flex; align-items: center; gap: 0.75rem;
}
.photo-avatar {
  flex-shrink: 0; width: 4rem; height: 4rem;
  border-radius: 9999px; overflow: hidden;
}
.photo-avatar-img {
  width: 100%; height: 100%; object-fit: cover;
}
.photo-avatar-placeholder {
  width: 100%; height: 100%;
  background: #1e1b4b; color: #818cf8;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700; letter-spacing: .02em;
}
.photo-drop {
  flex: 1; border: 1.5px dashed #1e2040; border-radius: 0.5rem;
  padding: 0.625rem 0.875rem; cursor: pointer;
  display: flex; flex-direction: column; gap: 0.1rem;
  transition: border-color 120ms, background 120ms;
}
.photo-drop:hover, .photo-drop--active {
  border-color: #6366f1; background: #12103a;
}
.photo-drop--has { border-style: solid; border-color: #1e2040; }
.photo-drop-icon  { font-size: 1rem; line-height: 1; }
.photo-drop-label { font-size: 0.8rem; font-weight: 600; color: #c4b5fd; }
.photo-drop-hint  { font-size: 0.68rem; color: #475569; }
.photo-clear {
  flex-shrink: 0; width: 1.75rem; height: 1.75rem;
  border-radius: 9999px; border: 1px solid #450a0a;
  background: transparent; color: #f87171; cursor: pointer;
  font-size: 0.7rem; display: flex; align-items: center; justify-content: center;
  transition: background 100ms;
}
.photo-clear:hover { background: #7f1d1d22; }
</style>
