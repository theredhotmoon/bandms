<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useBandLogos } from '@/composables/useBandLogos'
import type { BandLogo, BandLogoPayload, LogoVariant, LogoBackground } from '@/types/bandLogo'
import { LOGO_VARIANT_LABELS, LOGO_BACKGROUND_LABELS } from '@/types/bandLogo'

// ── Props / emits ─────────────────────────────────────────────────────────────

interface Props {
  epkLogoId: number | null
  techRiderLogoId: number | null
  websiteLogoId: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:context-pins': [{ epk_logo_id: number | null; tech_rider_logo_id: number | null; website_logo_id: number | null }]
}>()

// ── Composable ────────────────────────────────────────────────────────────────

const { list, upload, update, setDefault, remove } = useBandLogos()

// ── Upload form ───────────────────────────────────────────────────────────────

const dropActive     = ref(false)
const fileInput      = ref<HTMLInputElement | null>(null)
const pendingFile    = ref<File | null>(null)
const pendingPreview = ref<string | null>(null)

const uploadForm = reactive({
  label:         '',
  variant:       'full' as LogoVariant,
  background:    'any'  as LogoBackground,
  version_label: '',
})

const MAX_BYTES = 4 * 1024 * 1024   // 4 MB
const ALLOWED   = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

function pickFile(file: File) {
  if (!ALLOWED.includes(file.type)) {
    toast.error('Unsupported file type. Use PNG, JPG, WebP, or SVG.')
    return
  }
  if (file.size > MAX_BYTES) {
    toast.error('File exceeds 4 MB limit.')
    return
  }
  pendingFile.value = file
  // Generate preview (SVGs can be previewed via object URL)
  pendingPreview.value = URL.createObjectURL(file)
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) pickFile(file)
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e: DragEvent) {
  dropActive.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) pickFile(file)
}

function cancelPending() {
  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value)
  pendingFile.value    = null
  pendingPreview.value = null
  uploadForm.label         = ''
  uploadForm.variant        = 'full'
  uploadForm.background     = 'any'
  uploadForm.version_label  = ''
}

async function doUpload() {
  if (!pendingFile.value) return
  try {
    await upload.mutateAsync({
      file: pendingFile.value,
      meta: {
        label:         uploadForm.label         || null,
        variant:       uploadForm.variant,
        background:    uploadForm.background,
        version_label: uploadForm.version_label || null,
      },
    })
    toast.success('Logo uploaded')
    cancelPending()
  } catch {
    toast.error('Upload failed')
  }
}

// ── Edit form (inline, per card) ──────────────────────────────────────────────

const editingId   = ref<number | null>(null)
const editForm    = reactive<BandLogoPayload>({
  label:         null,
  variant:       'full',
  background:    'any',
  version_label: null,
  notes:         null,
})

function openEdit(logo: BandLogo) {
  editingId.value        = logo.id
  editForm.label         = logo.label
  editForm.variant       = logo.variant
  editForm.background    = logo.background
  editForm.version_label = logo.version_label
  editForm.notes         = logo.notes
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: number) {
  try {
    await update.mutateAsync({ id, payload: { ...editForm } })
    toast.success('Logo updated')
    editingId.value = null
  } catch {
    toast.error('Failed to save changes')
  }
}

// ── Set default ───────────────────────────────────────────────────────────────

async function doSetDefault(id: number) {
  try {
    await setDefault.mutateAsync(id)
    toast.success('Default logo updated')
  } catch {
    toast.error('Failed to set default')
  }
}

// ── Toggle deprecated ─────────────────────────────────────────────────────────

async function toggleDeprecated(logo: BandLogo) {
  try {
    await update.mutateAsync({ id: logo.id, payload: { is_deprecated: !logo.is_deprecated } })
    toast.success(logo.is_deprecated ? 'Logo restored' : 'Logo marked as deprecated')
  } catch {
    toast.error('Failed to update status')
  }
}

// ── Delete with confirm ───────────────────────────────────────────────────────

const confirmDeleteId = ref<number | null>(null)

function askDelete(id: number) {
  confirmDeleteId.value = id
}

function cancelDelete() {
  confirmDeleteId.value = null
}

async function doDelete(id: number) {
  try {
    await remove.mutateAsync(id)
    toast.success('Logo deleted')
    confirmDeleteId.value = null
  } catch {
    toast.error('Failed to delete logo')
  }
}

// ── Context pins ──────────────────────────────────────────────────────────────

const pins = reactive({
  epk_logo_id:        props.epkLogoId        as number | null,
  tech_rider_logo_id: props.techRiderLogoId  as number | null,
  website_logo_id:    props.websiteLogoId    as number | null,
})

const savingPins = ref(false)

async function savePins() {
  savingPins.value = true
  try {
    emit('update:context-pins', { ...pins })
  } finally {
    savingPins.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeLogos = computed(() =>
  (list.data.value ?? []).filter((l) => !l.is_deprecated)
)

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDims(logo: BandLogo): string {
  if (logo.is_vector) return 'Vector'
  if (logo.width && logo.height) return `${logo.width} × ${logo.height} px`
  return '—'
}

function isAnyUpdatePending(id: number): boolean {
  return update.isPending.value && (update.variables.value as { id: number } | undefined)?.id === id
}
</script>

<template>
  <div class="blm">

    <!-- ── Upload area ──────────────────────────────────────────────────────── -->
    <section class="blm-section">
      <h3 class="blm-section-title">Upload a logo</h3>

      <div v-if="!pendingFile">
        <div
          class="blm-drop"
          :class="{ 'blm-drop--active': dropActive }"
          @dragover.prevent="dropActive = true"
          @dragleave="dropActive = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <svg class="blm-drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span class="blm-drop-label">Drop logo here or click to browse</span>
          <span class="blm-drop-hint">PNG, JPG, WebP, SVG — max 4 MB</span>
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            style="display:none"
            @change="onFileInput"
          />
        </div>
      </div>

      <!-- Pending upload form -->
      <div v-else class="blm-upload-form">
        <div class="blm-upload-preview-wrap">
          <img :src="pendingPreview!" :alt="pendingFile.name" class="blm-upload-preview" />
        </div>

        <div class="blm-upload-fields">
          <div class="blm-field">
            <label class="field-label">Label <span class="blm-optional">(optional)</span></label>
            <input v-model="uploadForm.label" class="field-input" placeholder="e.g. Primary full-colour" />
          </div>

          <div class="blm-field-row">
            <div class="blm-field">
              <label class="field-label">Variant</label>
              <select v-model="uploadForm.variant" class="field-input">
                <option v-for="(label, key) in LOGO_VARIANT_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
            <div class="blm-field">
              <label class="field-label">Background</label>
              <select v-model="uploadForm.background" class="field-input">
                <option v-for="(label, key) in LOGO_BACKGROUND_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
          </div>

          <div class="blm-field">
            <label class="field-label">Version label <span class="blm-optional">(optional)</span></label>
            <input v-model="uploadForm.version_label" class="field-input" placeholder="e.g. v2 2024" />
          </div>

          <div class="blm-upload-actions">
            <button type="button" class="btn-ghost" @click="cancelPending">Cancel</button>
            <button
              type="button"
              class="btn-primary"
              :disabled="upload.isPending.value"
              @click="doUpload"
            >
              {{ upload.isPending.value ? 'Uploading…' : 'Upload logo' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Logo grid ────────────────────────────────────────────────────────── -->
    <section class="blm-section">
      <h3 class="blm-section-title">
        Logos
        <span v-if="list.data.value" class="blm-count">{{ list.data.value.length }}</span>
      </h3>

      <div v-if="list.isPending.value" class="blm-loading">Loading logos…</div>
      <div v-else-if="list.isError.value" class="blm-error">Failed to load logos.</div>
      <div v-else-if="!list.data.value?.length" class="blm-empty">No logos uploaded yet.</div>

      <div v-else class="blm-grid">
        <div
          v-for="logo in list.data.value"
          :key="logo.id"
          class="blm-card"
          :class="{ 'blm-card--deprecated': logo.is_deprecated, 'blm-card--default': logo.is_default }"
        >
          <!-- Image preview -->
          <div class="blm-card-thumb">
            <img :src="logo.url" :alt="logo.label ?? logo.original_name" class="blm-card-img" />

            <!-- Badges -->
            <div class="blm-badges">
              <span v-if="logo.is_default" class="blm-badge blm-badge--default">
                <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                DEFAULT
              </span>
              <span v-if="logo.is_vector" class="blm-badge blm-badge--vector">SVG</span>
              <span v-if="logo.is_deprecated" class="blm-badge blm-badge--deprecated">DEPRECATED</span>
            </div>
          </div>

          <!-- Card body -->
          <div class="blm-card-body">
            <!-- Meta chips -->
            <div class="blm-chips">
              <span class="blm-chip">{{ LOGO_VARIANT_LABELS[logo.variant] }}</span>
              <span class="blm-chip">{{ LOGO_BACKGROUND_LABELS[logo.background] }}</span>
            </div>

            <!-- Label / version -->
            <p v-if="logo.label" class="blm-card-label">{{ logo.label }}</p>
            <p v-if="logo.version_label" class="blm-card-version">{{ logo.version_label }}</p>
            <p class="blm-card-filename">{{ logo.original_name }}</p>

            <!-- Dimensions + size -->
            <div class="blm-card-meta">
              <span>{{ formatDims(logo) }}</span>
              <span class="blm-meta-sep">·</span>
              <span>{{ formatBytes(logo.file_size) }}</span>
            </div>

            <!-- Actions -->
            <div v-if="confirmDeleteId !== logo.id" class="blm-card-actions">
              <button
                type="button"
                class="blm-action-btn blm-action-btn--star"
                :disabled="logo.is_default || logo.is_deprecated || setDefault.isPending.value"
                :title="logo.is_default ? 'Already default' : 'Set as default'"
                @click="doSetDefault(logo.id)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                Default
              </button>

              <button
                type="button"
                class="blm-action-btn"
                :class="logo.is_deprecated ? 'blm-action-btn--restore' : 'blm-action-btn--deprecate'"
                :disabled="isAnyUpdatePending(logo.id)"
                @click="toggleDeprecated(logo)"
              >
                {{ logo.is_deprecated ? 'Restore' : 'Deprecate' }}
              </button>

              <button
                type="button"
                class="blm-action-btn blm-action-btn--edit"
                :disabled="isAnyUpdatePending(logo.id)"
                @click="editingId === logo.id ? cancelEdit() : openEdit(logo)"
              >
                {{ editingId === logo.id ? 'Cancel' : 'Edit' }}
              </button>

              <button
                type="button"
                class="blm-action-btn blm-action-btn--delete"
                :disabled="remove.isPending.value"
                @click="askDelete(logo.id)"
              >
                Delete
              </button>
            </div>

            <!-- Delete confirm -->
            <div v-else class="blm-confirm-delete">
              <span class="blm-confirm-text">Delete this logo?</span>
              <button type="button" class="blm-action-btn blm-action-btn--delete" :disabled="remove.isPending.value" @click="doDelete(logo.id)">
                {{ remove.isPending.value ? 'Deleting…' : 'Yes, delete' }}
              </button>
              <button type="button" class="blm-action-btn" @click="cancelDelete">Cancel</button>
            </div>

            <!-- Inline edit form -->
            <div v-if="editingId === logo.id" class="blm-edit-form">
              <div class="blm-field">
                <label class="field-label">Label</label>
                <input v-model="editForm.label" class="field-input field-input--sm" placeholder="e.g. Primary full-colour" />
              </div>
              <div class="blm-field-row">
                <div class="blm-field">
                  <label class="field-label">Variant</label>
                  <select v-model="editForm.variant" class="field-input field-input--sm">
                    <option v-for="(lbl, key) in LOGO_VARIANT_LABELS" :key="key" :value="key">{{ lbl }}</option>
                  </select>
                </div>
                <div class="blm-field">
                  <label class="field-label">Background</label>
                  <select v-model="editForm.background" class="field-input field-input--sm">
                    <option v-for="(lbl, key) in LOGO_BACKGROUND_LABELS" :key="key" :value="key">{{ lbl }}</option>
                  </select>
                </div>
              </div>
              <div class="blm-field">
                <label class="field-label">Version label</label>
                <input v-model="editForm.version_label" class="field-input field-input--sm" placeholder="e.g. v2 2024" />
              </div>
              <div class="blm-field">
                <label class="field-label">Notes</label>
                <textarea v-model="editForm.notes" class="field-input field-input--sm" rows="2" placeholder="Internal notes…" />
              </div>
              <div class="blm-edit-actions">
                <button type="button" class="btn-ghost btn-ghost--sm" @click="cancelEdit">Cancel</button>
                <button type="button" class="btn-primary btn-primary--sm" :disabled="isAnyUpdatePending(logo.id)" @click="saveEdit(logo.id)">
                  {{ isAnyUpdatePending(logo.id) ? 'Saving…' : 'Save' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Context pins ─────────────────────────────────────────────────────── -->
    <section class="blm-section blm-pins-section">
      <h3 class="blm-section-title">Context-specific logo overrides</h3>
      <p class="blm-pins-hint">Each context falls back to the global default when not set.</p>

      <div class="blm-pins-list">
        <div class="blm-pin-row">
          <label class="blm-pin-label">EPK logo</label>
          <select v-model="pins.epk_logo_id" class="field-input blm-pin-select">
            <option :value="null">— Use default —</option>
            <option v-for="l in activeLogos" :key="l.id" :value="l.id">
              {{ l.label ?? l.original_name }}
              <template v-if="l.version_label"> · {{ l.version_label }}</template>
            </option>
          </select>
        </div>

        <div class="blm-pin-row">
          <label class="blm-pin-label">Tech Rider logo</label>
          <select v-model="pins.tech_rider_logo_id" class="field-input blm-pin-select">
            <option :value="null">— Use default —</option>
            <option v-for="l in activeLogos" :key="l.id" :value="l.id">
              {{ l.label ?? l.original_name }}
              <template v-if="l.version_label"> · {{ l.version_label }}</template>
            </option>
          </select>
        </div>

        <div class="blm-pin-row">
          <label class="blm-pin-label">Website logo</label>
          <select v-model="pins.website_logo_id" class="field-input blm-pin-select">
            <option :value="null">— Use default —</option>
            <option v-for="l in activeLogos" :key="l.id" :value="l.id">
              {{ l.label ?? l.original_name }}
              <template v-if="l.version_label"> · {{ l.version_label }}</template>
            </option>
          </select>
        </div>
      </div>

      <div class="blm-pins-footer">
        <button
          type="button"
          class="btn-primary"
          :disabled="savingPins"
          @click="savePins"
        >
          {{ savingPins ? 'Saving…' : 'Save pins' }}
        </button>
      </div>
    </section>

  </div>
</template>

<style scoped src="./form-styles.css" />
<style scoped>
/* ── Root wrapper ──────────────────────────────────────────── */
.blm {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* ── Section chrome ────────────────────────────────────────── */
.blm-section {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.blm-section-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.blm-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: #475569;
  background: #12122e;
  border: 1px solid #2a2a2a;
  border-radius: 9999px;
  padding: 0 0.45rem;
  line-height: 1.6;
}

/* ── Drop zone ─────────────────────────────────────────────── */
.blm-drop {
  border: 2px dashed #2a2a2a;
  border-radius: 0.625rem;
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  background: #0e0c2a;
  transition: border-color 150ms, background 150ms;
}
.blm-drop:hover,
.blm-drop--active {
  border-color: #888888;
  background: #100e30;
}

.blm-drop-icon {
  width: 2rem;
  height: 2rem;
  color: #888888;
  margin-bottom: 0.25rem;
}
.blm-drop-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #d0d0d0;
}
.blm-drop-hint {
  font-size: 0.7rem;
  color: #475569;
}

/* ── Upload form (pending preview) ────────────────────────── */
.blm-upload-form {
  display: flex;
  gap: 1.25rem;
  padding: 1rem;
  background: #111111;
  border: 1px solid #2a2a2a;
  border-radius: 0.625rem;
}
@media (max-width: 560px) {
  .blm-upload-form { flex-direction: column; }
}

.blm-upload-preview-wrap {
  flex-shrink: 0;
  width: 8rem;
  min-height: 6rem;
  background: #141230;
  border: 1px solid #2a2a2a;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.blm-upload-preview {
  max-width: 100%;
  max-height: 8rem;
  object-fit: contain;
  display: block;
}

.blm-upload-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-width: 0;
}

.blm-field {
  display: flex;
  flex-direction: column;
}

.blm-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
}

.blm-optional {
  font-size: 0.7rem;
  font-weight: 400;
  color: #475569;
}

.blm-upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

/* ── Logo grid ─────────────────────────────────────────────── */
.blm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.875rem;
}
@media (max-width: 640px) {
  .blm-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 360px) {
  .blm-grid { grid-template-columns: 1fr; }
}

/* ── Logo card ─────────────────────────────────────────────── */
.blm-card {
  background: #111111;
  border: 1px solid #222222;
  border-radius: 0.625rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 150ms;
}
.blm-card:hover { border-color: #333333; }
.blm-card--default { border-color: #78400a; box-shadow: 0 0 0 1px #92400e33; }
.blm-card--deprecated { opacity: 0.55; }

.blm-card-thumb {
  position: relative;
  background: #141230;
  border-bottom: 1px solid #222222;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 7rem;
}

.blm-card-img {
  max-width: 100%;
  max-height: 7rem;
  object-fit: contain;
  display: block;
}

/* ── Badges ────────────────────────────────────────────────── */
.blm-badges {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.blm-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  line-height: 1.4;
}

.blm-badge--default {
  background: #78350f;
  color: #fde68a;
  border: 1px solid #92400e;
}

.blm-badge--vector {
  background: #222222;
  color: #7dd3fc;
  border: 1px solid #444444;
}

.blm-badge--deprecated {
  background: #450a0a;
  color: #fca5a5;
  border: 1px solid #7f1d1d;
}

/* ── Card body ─────────────────────────────────────────────── */
.blm-card-body {
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
}

.blm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.1rem;
}

.blm-chip {
  font-size: 0.6rem;
  font-weight: 600;
  color: #888888;
  background: #1a1a1a;
  border: 1px solid #252470;
  border-radius: 0.25rem;
  padding: 0.1rem 0.375rem;
  letter-spacing: 0.02em;
}

.blm-card-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blm-card-version {
  font-size: 0.68rem;
  color: #c0c0c0;
  margin: 0;
}

.blm-card-filename {
  font-size: 0.65rem;
  color: #334155;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blm-card-meta {
  font-size: 0.65rem;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.blm-meta-sep { color: #2a2a2a; }

/* ── Card action buttons ───────────────────────────────────── */
.blm-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.375rem;
  padding-top: 0.375rem;
  border-top: 1px solid #141230;
}

.blm-action-btn {
  font-size: 0.68rem;
  font-weight: 500;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  cursor: pointer;
  background: #0e0c2a;
  border: 1px solid #2a2a2a;
  color: #64748b;
  transition: background 100ms, color 100ms, border-color 100ms;
  line-height: 1.4;
}
.blm-action-btn:hover:not(:disabled) {
  background: #141414;
  color: #94a3b8;
  border-color: #252468;
}
.blm-action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.blm-action-btn--star:hover:not(:disabled) {
  background: #2d1a08;
  color: #fbbf24;
  border-color: #78350f;
}
.blm-action-btn--star:disabled { color: #78350f; }

.blm-action-btn--deprecate:hover:not(:disabled) {
  background: #1a1210;
  color: #fb923c;
  border-color: #7c2d12;
}

.blm-action-btn--restore:hover:not(:disabled) {
  background: #0f2a1a;
  color: #4ade80;
  border-color: #166534;
}

.blm-action-btn--edit:hover:not(:disabled) {
  background: #2a2a2a;
  color: #d0d0d0;
  border-color: #444444;
}

.blm-action-btn--delete {
  color: #f87171;
  border-color: #3a1212;
}
.blm-action-btn--delete:hover:not(:disabled) {
  background: #3d1515;
  color: #fca5a5;
  border-color: #7f1d1d;
}

/* ── Delete confirm inline ─────────────────────────────────── */
.blm-confirm-delete {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-top: 0.375rem;
  padding-top: 0.375rem;
  border-top: 1px solid #141230;
}

.blm-confirm-text {
  font-size: 0.68rem;
  color: #f87171;
  flex: 1;
  min-width: 0;
}

/* ── Inline edit form ──────────────────────────────────────── */
.blm-edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #141230;
}

.blm-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
}

/* Smaller input variant used inside cards */
.field-input--sm {
  font-size: 0.78rem;
  padding: 0.375rem 0.625rem;
}

/* ── Context pins ──────────────────────────────────────────── */
.blm-pins-section {
  background: #111111;
  border: 1px solid #2a2a2a;
  border-radius: 0.625rem;
  padding: 1rem 1.25rem;
}

.blm-pins-hint {
  font-size: 0.73rem;
  color: #475569;
  margin: 0 0 0.75rem;
  line-height: 1.5;
}

.blm-pins-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.blm-pin-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}
@media (max-width: 480px) {
  .blm-pin-row { flex-direction: column; align-items: stretch; }
}

.blm-pin-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #7c8fa6;
  width: 8.5rem;
  flex-shrink: 0;
}

.blm-pin-select {
  flex: 1;
  min-width: 0;
}

.blm-pins-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.875rem;
}

/* ── States ────────────────────────────────────────────────── */
.blm-loading,
.blm-empty {
  font-size: 0.8rem;
  color: #475569;
  padding: 1rem 0;
  text-align: center;
}

.blm-error {
  font-size: 0.8rem;
  color: #f87171;
  padding: 1rem 0;
  text-align: center;
}

/* ── Button size overrides ─────────────────────────────────── */
.btn-primary--sm {
  padding: 0.3rem 0.75rem;
  font-size: 0.78rem;
}

.btn-ghost--sm {
  padding: 0.3rem 0.625rem;
  font-size: 0.78rem;
}
</style>
