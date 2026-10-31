<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import AuthorQuickAdd from '@/components/admin/forms/AuthorQuickAdd.vue'
import BandQuickAdd from '@/components/admin/forms/BandQuickAdd.vue'
import VenueQuickAdd from '@/components/admin/forms/VenueQuickAdd.vue'
import type { Finding } from '@/types/assistantCrawler'
import type { AuthorPayload } from '@/types/author'
import type { BandPayload } from '@/types/band'
import type { VenuePayload } from '@/types/venue'
import { defaultSaveTarget, prefillFor, type SaveTarget } from '@/utils/findingPrefill'

/**
 * Save as… on a lead: opens the usual create form for a venue, a band
 * (promoter, festival) or a contact, prefilled from the finding. The record
 * is created through its own endpoint — a duplicate name shows that form's
 * 422 and nothing else changes — and only once it exists is `saved` emitted
 * for the caller to link the finding.
 */
const props = defineProps<{ finding: Finding }>()
const emit = defineEmits<{ saved: [link: { type: 'venue' | 'band' | 'author'; id: number }] }>()

const OPTIONS: SaveTarget[] = [
  { type: 'venue' },
  { type: 'band', kind: 'band' },
  { type: 'band', kind: 'promoter' },
  { type: 'band', kind: 'festival' },
  { type: 'author' },
]
const suggested = computed(() => defaultSaveTarget(props.finding.lead_type))
const same = (a: SaveTarget, b: SaveTarget) => a.type === b.type && (a.type !== 'band' || (b.type === 'band' && a.kind === b.kind))

const menu = ref<HTMLDetailsElement | null>(null)
const venue = ref<InstanceType<typeof VenueQuickAdd> | null>(null)
const band = ref<InstanceType<typeof BandQuickAdd> | null>(null)
const author = ref<InstanceType<typeof AuthorQuickAdd> | null>(null)
const venuePrefill = ref<Partial<VenuePayload> | null>(null)
const bandPrefill = ref<Partial<BandPayload> | null>(null)
const authorPrefill = ref<Partial<AuthorPayload> | null>(null)

async function choose(target: SaveTarget) {
  if (menu.value) menu.value.open = false
  const prefill = prefillFor(props.finding, target)
  if (target.type === 'venue') venuePrefill.value = prefill as Partial<VenuePayload>
  else if (target.type === 'band') bandPrefill.value = prefill as Partial<BandPayload>
  else authorPrefill.value = prefill as Partial<AuthorPayload>
  await nextTick() // the form takes the prefill before it opens
  ;(target.type === 'venue' ? venue : target.type === 'band' ? band : author).value?.open()
}
</script>

<template>
  <details ref="menu" class="sa" data-testid="save-as">
    <summary class="btn-ghost">{{ $t('more.assistant.saveAs.button') }}</summary>
    <div class="sa-list" role="menu">
      <button
        v-for="o in OPTIONS"
        :key="o.type === 'band' ? o.kind : o.type"
        type="button"
        role="menuitem"
        class="sa-item"
        :class="{ 'sa-item--suggested': same(o, suggested) }"
        :data-target="o.type === 'band' ? o.kind : o.type"
        @click="choose(o)"
      >
        <template v-if="o.type === 'venue'">{{ $t('more.assistant.saveAs.venue') }}</template>
        <template v-else-if="o.type === 'author'">{{ $t('more.assistant.saveAs.author') }}</template>
        <template v-else-if="o.kind === 'promoter'">{{ $t('more.assistant.saveAs.promoter') }}</template>
        <template v-else-if="o.kind === 'festival'">{{ $t('more.assistant.saveAs.festival') }}</template>
        <template v-else>{{ $t('more.assistant.saveAs.band') }}</template>
      </button>
    </div>
  </details>

  <VenueQuickAdd ref="venue" hide-button :tags="[]" :prefill="venuePrefill" @created="emit('saved', { type: 'venue', id: $event.id })" />
  <BandQuickAdd ref="band" hide-button :prefill="bandPrefill" @created="emit('saved', { type: 'band', id: $event.id })" />
  <AuthorQuickAdd ref="author" hide-button :prefill="authorPrefill" @created="emit('saved', { type: 'author', id: $event.id })" />
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.sa { position: relative; }
.sa > summary { list-style: none; cursor: pointer; }
.sa > summary::-webkit-details-marker { display: none; }
.sa-list {
  position: absolute; right: 0; z-index: 10; margin-top: 0.25rem; min-width: 11rem;
  display: flex; flex-direction: column; padding: 0.25rem;
  border: 1px solid var(--c-333333); border-radius: 0.5rem; background: var(--c-141414);
}
.sa-item {
  text-align: left; padding: 0.35rem 0.6rem; border: none; border-radius: 0.375rem;
  background: none; color: var(--c-e2e8f0); font-size: var(--fs-sm); cursor: pointer;
}
.sa-item:hover, .sa-item:focus-visible { background: var(--c-2a2a2a); }
.sa-item--suggested { font-weight: 600; }
</style>
