<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import ClipCategoryPicker from '@/components/admin/forms/ClipCategoryPicker.vue'
import { useClips } from '@/composables/useClips'
import { detectProvider, providerLabel } from '@/utils/postBlocks'
import { presetMessageKey } from '@/utils/clipCategories'
import { reportSaveError } from '@/utils/formErrors'
import type { Clip, ClipOwnerType } from '@/types/clip'

const { t } = useI18n()

/**
 * The owner side of the clips library: what is attached to this record, a
 * quick-add that creates a clip already attached, and detach. Saves happen
 * immediately through the clips API rather than with the host form, because a
 * clip has a stable id other records (post blocks) may already point at.
 *
 * The list is read from the clips query, not from the host record: the host
 * form resets itself whenever its `initial` prop changes, so refreshing the
 * concert row after every add would wipe unsaved edits. The clips query is
 * invalidated by every clip mutation, so this field stays current on its own.
 */
const props = defineProps<{
  ownerType: ClipOwnerType
  /** null on a create form — the owner has no id to attach to yet. */
  ownerId: number | null
}>()

const { query, create, detach } = useClips()

const clips = computed<Clip[]>(() =>
  (query.data.value ?? []).filter(c =>
    c.owners.some(o => o.type === props.ownerType && o.id === props.ownerId),
  ),
)

const url = ref('')
const category = ref('live')

async function add() {
  if (!props.ownerId || !url.value.trim()) return
  try {
    await create.mutateAsync({
      url: url.value.trim(),
      category: category.value,
      attach: [{ type: props.ownerType, id: props.ownerId }],
    })
    url.value = ''
    toast.success(t('common.clips.added'))
  } catch (e) { reportSaveError(e, t('common.clips.addFailed')) }
}

async function remove(clip: Clip) {
  if (!props.ownerId) return
  try {
    await detach.mutateAsync({ id: clip.id, owner: { type: props.ownerType, id: props.ownerId } })
    toast.success(t('common.clips.detached'))
  } catch (e) { reportSaveError(e, t('common.clips.detachFailed')) }
}

// A custom category prints as the band typed it; only presets are translated.
function categoryLabel(value: string): string {
  const key = presetMessageKey(value)
  return key ? t(key) : value
}
</script>

<template>
  <div data-testid="attached-clips">
    <label class="field-label">{{ $t('common.clips.title') }}</label>

    <p v-if="!ownerId" class="text-xs" style="color:#475569;">{{ $t('common.clips.saveFirst') }}</p>
    <template v-else>
      <div v-if="clips.length" class="links-list">
        <div v-for="clip in clips" :key="clip.id" class="link-row" data-testid="attached-clip">
          <span class="link-label">{{ categoryLabel(clip.category) }} · {{ providerLabel(clip.provider, $t('common.link')) }}</span>
          <a :href="clip.url" target="_blank" rel="noopener" class="link-url">{{ clip.title ?? clip.url }}</a>
          <button type="button" class="remove-btn" :disabled="detach.isPending.value" :title="$t('common.clips.detach')" @click="remove(clip)">×</button>
        </div>
      </div>

      <ClipCategoryPicker v-model="category" />
      <div class="link-add-row mt-2">
        <input v-model="url" type="url" class="field-input link-url-input" :placeholder="$t('common.clips.urlPlaceholder')"
               data-testid="attached-clip-url" @keydown.enter.prevent="add" />
        <span v-if="url" class="provider-badge">{{ providerLabel(detectProvider(url), $t('common.link')) }}</span>
        <button type="button" class="btn-add-link" :disabled="create.isPending.value || !url.trim()" @click="add">{{ $t('common.clips.add') }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.links-list { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.5rem; }
.link-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; border-radius: 0.375rem; background: #141414; border: 1px solid #252525; font-size: 0.8125rem; }
.link-label { flex-shrink: 0; min-width: 7rem; color: #d0d0d0; font-weight: 500; }
.link-url { flex: 1; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; font-size: 0.75rem; }
.link-add-row { display: flex; gap: 0.5rem; align-items: center; }
.link-url-input { flex: 1; }
.btn-add-link { flex-shrink: 0; padding: 0.4rem 0.875rem; border-radius: 0.375rem; border: 1px solid #555555; background: #2a2a2a; color: #d0d0d0; font-size: 0.8125rem; cursor: pointer; }
.btn-add-link:disabled { opacity: .5; cursor: default; }
.provider-badge { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.25rem 0.5rem; border-radius: 0.25rem; flex-shrink: 0; background: #1e3a5f; color: #60a5fa; text-transform: uppercase; }
.remove-btn {
  flex-shrink: 0; width: 1.25rem; height: 1.25rem; display: flex; align-items: center; justify-content: center;
  border-radius: 0.25rem; border: none; background: transparent; color: #475569; font-size: 1rem; cursor: pointer; line-height: 1;
  transition: background 100ms, color 100ms;
}
.remove-btn:hover { background: #3b1212; color: #f87171; }
.remove-btn:disabled { opacity: .5; cursor: default; }
</style>
