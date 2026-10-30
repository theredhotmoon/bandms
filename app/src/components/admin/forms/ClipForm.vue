<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useDirtyGuard, useModalGuard } from '@/composables/useDirtyGuard'
import EmbedBlockEditor from '@/components/admin/forms/blocks/EmbedBlockEditor.vue'
import ClipCategoryPicker from '@/components/admin/forms/ClipCategoryPicker.vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import { LOCALES, emptyBag } from '@/locales'
import type { Clip, ClipAttach, ClipPayload } from '@/types/clip'
import type { Concert } from '@/types/concert'
import type { ReleaseSummary } from '@/types/release'
import type { ShopItemSummary } from '@/types/shop'

const props = defineProps<{
  initial?: Clip | null
  concerts: Concert[]
  releases: ReleaseSummary[]
  shopItems: ShopItemSummary[]
  members?: readonly { id: number; first_name: string; last_name: string }[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [ClipPayload]; cancel: [] }>()

const form = reactive({
  url: '',
  title: emptyBag(),
  category: 'live',
  recorded_on: '',
  show_in_epk: false,
  concertIds: [] as number[],
  releaseIds: [] as number[],
  shopItemIds: [] as number[],
  memberIds: [] as number[],
})

const { isDirty, markClean } = useDirtyGuard(() => form)
const { cancel } = useModalGuard(isDirty, () => emit('cancel'))

watch(() => props.initial, (val) => {
  form.url = val?.url ?? ''
  for (const l of LOCALES) form.title[l] = val?.translations?.title?.[l] ?? ''
  form.category = val?.category ?? 'live'
  form.recorded_on = val?.recorded_on ?? ''
  form.show_in_epk = val?.show_in_epk ?? false
  form.concertIds  = val?.owners.filter(o => o.type === 'concert').map(o => o.id) ?? []
  form.releaseIds  = val?.owners.filter(o => o.type === 'release').map(o => o.id) ?? []
  form.shopItemIds = val?.owners.filter(o => o.type === 'shop_item').map(o => o.id) ?? []
  form.memberIds   = val?.member_ids ? [...val.member_ids] : []
  markClean()
}, { immediate: true })

// EmbedBlockEditor speaks payload objects; only `url` matters here — the clip
// has its own title, so the editor's link-label inputs are hidden via a prop.
const embedPayload = computed(() => ({ url: form.url }))

function submit() {
  const attach: ClipAttach[] = [
    ...form.concertIds.map(id => ({ type: 'concert' as const, id })),
    ...form.releaseIds.map(id => ({ type: 'release' as const, id })),
    ...form.shopItemIds.map(id => ({ type: 'shop_item' as const, id })),
  ]
  emit('submit', {
    url: form.url.trim(),
    title: Object.fromEntries(LOCALES.map(l => [l, form.title[l].trim() || null])),
    category: form.category,
    recorded_on: form.recorded_on || null,
    show_in_epk: form.show_in_epk,
    member_ids: form.memberIds,
    attach,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4" data-testid="clip-form">
    <div>
      <label class="field-label">{{ $t('band.clips.form.url') }} <span style="color:var(--c-f87171);">*</span></label>
      <EmbedBlockEditor :payload="embedPayload" hide-label @update:payload="form.url = String($event.url ?? '')" />
      <p v-if="errors?.url" class="field-error">{{ errors.url[0] }}</p>
    </div>

    <div>
      <label class="field-label">{{ $t('common.fields.title') }}</label>
      <TranslatedField
        v-model="form.title"
        kind="input"
        field-key="clip.title"
        :label="$t('common.fields.title')"
        :placeholders="Object.fromEntries(LOCALES.map(l => [l, $t('band.clips.form.titlePlaceholder', {}, { locale: l })]))"
      />
    </div>

    <div>
      <label class="field-label">{{ $t('band.clips.columns.category') }}</label>
      <ClipCategoryPicker v-model="form.category" />
      <p v-if="errors?.category" class="field-error">{{ errors.category[0] }}</p>
    </div>

    <div class="flex gap-4 items-end">
      <div>
        <label class="field-label">{{ $t('band.clips.form.recordedOn') }}</label>
        <input v-model="form.recorded_on" type="date" class="field-input" />
      </div>
      <label class="flex items-center gap-2 pb-2" style="color:var(--c-d0d0d0); font-size:var(--fs-base);">
        <input v-model="form.show_in_epk" type="checkbox" /> {{ $t('band.clips.form.showInEpk') }}
      </label>
    </div>

    <EntityRelationsPanel
      :concerts="concerts" :releases="releases" :shop-items="shopItems" :members="members"
      v-model:concert-ids="form.concertIds" v-model:release-ids="form.releaseIds" v-model:shop-item-ids="form.shopItemIds"
      v-model:member-ids="form.memberIds"
    />

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="cancel()" class="btn-ghost">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : (initial ? $t('common.actions.update') : $t('common.actions.create')) }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
