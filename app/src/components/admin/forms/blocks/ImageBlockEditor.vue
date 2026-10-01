<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { uploadPostBlockImage } from '@/api/postBlocks'
import { useAuth } from '@/composables/useAuth'
import { useContentLocales } from '@/composables/useContentLocales'
import { shortLabel, type Lang } from '@/locales'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const { token } = useAuth()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const { order: contentLocales } = useContentLocales()

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
      <button type="button" class="btn-remove" @click="emit('update:payload', { ...payload, path: '', url: '' })" :title="$t('content.blocks.image.remove')">✕</button>
    </div>
    <div v-else class="siu-drop" @click="fileInput?.click()">
      <span class="siu-label">{{ uploading ? $t('content.blocks.image.uploading') : $t('content.blocks.image.upload') }}</span>
      <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFile" />
    </div>

    <div class="trans-group">
      <template v-for="key in BAG_KEYS" :key="key">
        <div v-for="l in contentLocales" :key="`${key}-${l}`" class="trans-row" :data-locale="l">
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
.img-preview-el { max-height: 10rem; border-radius: 0.375rem; display: block; }
.siu-drop {
  border: 2px dashed #3f3f46; border-radius: 0.375rem; padding: 1.25rem;
  text-align: center; cursor: pointer; color: #a1a1aa;
}
</style>
