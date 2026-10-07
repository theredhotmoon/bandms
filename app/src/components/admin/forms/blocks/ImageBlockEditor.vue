<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, inject, ref } from 'vue'
import { uploadPostBlockImage } from '@/api/postBlocks'
import { useAuth } from '@/composables/useAuth'
import { useContentLocales } from '@/composables/useContentLocales'
import { shortLabel, type Lang } from '@/locales'
import { reportSaveError } from '@/utils/formErrors'
import { VISIBLE_LOCALES } from '@/utils/editorLocales'

const { t } = useI18n()

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const { token } = useAuth()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const { order } = useContentLocales()
const visible = inject(VISIBLE_LOCALES, null)
const locales = computed<Lang[]>(() => visible?.value ?? order.value)

type BagKey = 'alt' | 'caption'
const bag = (key: BagKey) => (props.payload[key] ?? {}) as Partial<Record<Lang, string>>

// All alt rows, then all caption rows — the grouping the editor always had.
// Sample text in the input's own language (see PostForm).
const placeholders: Record<BagKey, (l: Lang) => string> = {
  alt:     (l) => t('content.blocks.image.alt', {}, { locale: l }),
  caption: (l) => t('content.blocks.image.caption', {}, { locale: l }),
}
const BAG_KEYS: BagKey[] = ['alt', 'caption']

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const { path, url } = await uploadPostBlockImage(token.value!, file)
    // `url` is kept alongside `path` purely so the editor can show a preview
    // before the post is saved; only `path` is submitted.
    emit('update:payload', { ...props.payload, path, url })
  } catch (e) {
    reportSaveError(e, t('content.blocks.image.uploadFailed'))
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="payload.url || payload.path" class="img-preview">
      <img :src="(payload.url as string) ?? `/storage/${payload.path}`" alt="" class="img-preview-el" />
      <button type="button" class="btn-icon btn-icon--danger img-remove"
              :aria-label="$t('content.blocks.image.remove')" :title="$t('content.blocks.image.remove')"
              @click="emit('update:payload', { ...payload, path: '', url: '' })">
        <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <button v-else type="button" class="img-drop" :disabled="uploading" @click="fileInput?.click()">
      <svg class="img-drop-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span>{{ uploading ? $t('content.blocks.image.uploading') : $t('content.blocks.image.upload') }}</span>
    </button>
    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFile" />

    <div class="trans-group">
      <template v-for="key in BAG_KEYS" :key="key">
        <div v-for="l in locales" :key="`${key}-${l}`" class="trans-row" :data-locale="l">
          <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
          <input :value="bag(key)[l] ?? ''" @input="set(key, { ...bag(key), [l]: ($event.target as HTMLInputElement).value })"
                 class="field-input flex-1" :placeholder="placeholders[key](l)" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
<style scoped>
.img-preview { position: relative; display: inline-block; }
.img-preview-el { max-height: 10rem; border-radius: 0.375rem; display: block; border: 1px solid var(--c-2a2a2a); }
.img-remove { position: absolute; top: 0.375rem; right: 0.375rem; background: color-mix(in srgb, var(--c-141414) 85%, transparent); }
.img-drop {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; padding: 0.875rem 1rem;
  border: 2px dashed var(--c-2a2a2a); border-radius: 0.375rem;
  background: var(--c-141414); color: var(--c-d0d0d0);
  font: inherit; font-size: var(--fs-sm); font-weight: 500; cursor: pointer;
  transition: border-color 150ms, background 150ms;
}
.img-drop:hover:not(:disabled) { border-color: var(--c-888888-line); background: var(--c-1a1a1a); }
.img-drop:disabled { cursor: progress; opacity: 0.7; }
.img-drop-icon { width: 1.25rem; height: 1.25rem; color: var(--c-334155); flex-shrink: 0; }
</style>
