<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useWelcomeSettings } from '@/composables/useWelcomeSettings'
import { useSiteRebuild } from '@/composables/useSiteRebuild'
import { saveErrorMessage } from '@/api/client'
import { BLOCKS, moveBlock, toForm, toInput, toggleBlock, type WelcomeForm } from '@/utils/welcomeSettings'
import type { WelcomeBlock } from '@/types/welcome'

/**
 * The welcome screen's settings: which blocks, in what order, how often it
 * returns, and the optional "only for people near a show" rule. The bounds
 * mirror the API (concert_count 1-3, reshow_days 1-365, radius_km 10-1000).
 */
const { t, locale } = useI18n()
const { query, save, stampCampaign } = useWelcomeSettings()
const { autoRebuild } = useSiteRebuild()

const form = reactive<WelcomeForm>(toForm({
  blocks: [...BLOCKS], concert_count: 2, frequency: 'interval', reshow_days: 90,
  campaign: 0, geo_available: true, geo: { enabled: false, radius_km: 100, far_visitors: 'hide_gigs' },
}))
const dirty = computed(() => {
  const saved = query.data.value
  return !!saved && JSON.stringify(toInput(form)) !== JSON.stringify(toInput(toForm(saved)))
})
// Re-sync from the server only while nothing is unsaved: a refetch or a
// campaign stamp must not wipe what the band has typed.
let loaded = false
watch(() => query.data.value, (data) => {
  if (!data) return
  // The first answer always fills the form (it starts as placeholder defaults).
  if (!loaded || !dirty.value) Object.assign(form, toForm(data))
  loaded = true
}, { immediate: true })

function onToggle(key: WelcomeBlock): void {
  form.enabled = toggleBlock(form.enabled, form.order, key)
}
function onMove(key: WelcomeBlock, dir: -1 | 1): void {
  form.order = moveBlock(form.order, key, dir)
}

const lastCampaign = computed(() => {
  const stamp = query.data.value?.campaign ?? 0
  return stamp === 0 ? t('pages.modules.welcome.campaignNever') : new Date(stamp * 1000).toLocaleDateString(locale.value)
})
const geoStatus = computed(() =>
  query.data.value?.geo_available === false
    ? t('pages.modules.welcome.geoInactive')
    : t('pages.modules.welcome.geoActive'))

/** Resolves true when saved (or nothing to save), false when the save failed. */
async function submit(): Promise<boolean> {
  try {
    await save.mutateAsync(toInput(form))
    toast.success(t('pages.modules.welcome.saved'))
    return true
  } catch (e) {
    toast.error(saveErrorMessage(e, t('pages.modules.welcome.failed')))
    return false
  }
}

// The module row's Save/Cancel live in the parent view: it reads `dirty` to
// know there is something to keep, and calls `save()` before closing the editor.
defineExpose({ dirty, save: submit })

const confirming = ref(false)
async function stamp(): Promise<void> {
  try {
    await stampCampaign.mutateAsync()
    toast.success(t('pages.modules.welcome.campaignDone'))
  } catch (e) {
    toast.error(saveErrorMessage(e, t('pages.modules.welcome.failed')))
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="welcome-settings">
    <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.modules.welcome.title') }}</span>
    <p class="text-xs text-zinc-500">{{ $t('pages.modules.welcome.lead') }}</p>
    <p v-if="query.isError.value" class="text-xs" style="color:var(--c-f87171);">{{ $t('pages.modules.welcome.loadFailed') }}</p>

    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <fieldset class="flex flex-col gap-1.5 border-0 p-0 m-0">
        <legend class="text-sm text-zinc-300 mb-1">{{ $t('pages.modules.welcome.blocks') }}</legend>
        <ul class="flex flex-col gap-1 list-none p-0 m-0">
          <li
            v-for="(key, i) in form.order" :key="key"
            class="flex items-center gap-2 rounded-card border border-zinc-800 bg-zinc-900/40 px-3 py-1.5"
          >
            <label class="flex items-center gap-2 flex-1 text-sm text-zinc-300">
              <input
                type="checkbox" :checked="form.enabled.includes(key)"
                :data-testid="`welcome-block-${key}`" @change="onToggle(key)"
              />
              {{ $t(`pages.modules.welcome.block.${key}`) }}
            </label>
            <button
              type="button" class="px-2 text-zinc-400 disabled:opacity-30" :disabled="i === 0"
              :aria-label="$t('pages.modules.welcome.moveUp', { name: $t(`pages.modules.welcome.block.${key}`) })"
              :data-testid="`welcome-block-up-${key}`" @click="onMove(key, -1)"
            >&uarr;</button> <!-- i18n-ignore: arrow glyph -->
            <button
              type="button" class="px-2 text-zinc-400 disabled:opacity-30" :disabled="i === form.order.length - 1"
              :aria-label="$t('pages.modules.welcome.moveDown', { name: $t(`pages.modules.welcome.block.${key}`) })"
              :data-testid="`welcome-block-down-${key}`" @click="onMove(key, 1)"
            >&darr;</button> <!-- i18n-ignore: arrow glyph -->
          </li>
        </ul>
        <p class="text-xs text-zinc-600">{{ $t('pages.modules.welcome.blocksHint') }}</p>
      </fieldset>

      <label class="flex items-center gap-2 text-sm text-zinc-300">
        {{ $t('pages.modules.welcome.concertCount') }}
        <select v-model.number="form.concert_count" class="welcome-input" data-testid="welcome-concert-count">
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
        </select>
      </label>

      <fieldset class="flex flex-col gap-1.5 border-0 p-0 m-0">
        <legend class="text-sm text-zinc-300 mb-1">{{ $t('pages.modules.welcome.frequency') }}</legend>
        <label class="flex items-center gap-2 text-sm text-zinc-300">
          <input v-model="form.frequency" type="radio" value="interval" data-testid="welcome-frequency-interval" />
          <i18n-t keypath="pages.modules.welcome.frequencyInterval" tag="span" scope="global">
            <template #days>
              <input
                v-model.number="form.reshow_days" type="number" min="1" max="365" step="1" required class="welcome-input w-20"
                :aria-label="$t('pages.modules.welcome.reshowDays')" data-testid="welcome-reshow-days"
                :disabled="form.frequency !== 'interval'"
              />
            </template>
          </i18n-t>
        </label>
        <label class="flex items-center gap-2 text-sm text-zinc-300">
          <input v-model="form.frequency" type="radio" value="once" data-testid="welcome-frequency-once" />
          {{ $t('pages.modules.welcome.frequencyOnce') }}
        </label>
      </fieldset>

      <div class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="!confirming" type="button" class="welcome-btn" data-testid="welcome-campaign"
            @click="confirming = true"
          >{{ $t('pages.modules.welcome.campaign') }}</button>
          <template v-else>
            <span class="text-sm text-zinc-300">{{ $t('pages.modules.welcome.campaignAsk') }}</span>
            <button
              type="button" class="welcome-btn" data-testid="welcome-campaign-confirm"
              :disabled="stampCampaign.isPending.value" @click="stamp"
            >{{ $t('pages.modules.welcome.confirm') }}</button>
            <button type="button" class="welcome-btn-quiet" data-testid="welcome-campaign-cancel" @click="confirming = false">
              {{ $t('pages.modules.welcome.cancel') }}
            </button>
          </template>
          <span class="text-xs text-zinc-500">
            {{ $t('pages.modules.welcome.campaignLast') }}
            <span data-testid="welcome-campaign-last">{{ lastCampaign }}</span>
          </span>
        </div>
        <p class="text-xs text-zinc-600">{{ $t('pages.modules.welcome.campaignHint') }}</p>
        <p v-if="!autoRebuild" class="text-xs text-zinc-600">{{ $t('pages.modules.welcome.campaignRebuild') }}</p>
      </div>

      <fieldset class="flex flex-col gap-2 border-0 p-0 m-0">
        <legend class="text-sm text-zinc-300 mb-1">{{ $t('pages.modules.welcome.geo') }}</legend>
        <label class="flex items-center gap-2 text-sm text-zinc-300">
          <input v-model="form.geo.enabled" type="checkbox" data-testid="welcome-geo-enabled" />
          {{ $t('pages.modules.welcome.geoEnabled') }}
        </label>
        <label class="flex items-center gap-2 text-sm text-zinc-300">
          {{ $t('pages.modules.welcome.geoRadius') }}
          <input
            v-model.number="form.geo.radius_km" type="number" min="10" max="1000" step="1" required class="welcome-input w-24"
            data-testid="welcome-geo-radius"
          />
        </label>
        <label class="flex items-center gap-2 text-sm text-zinc-300">
          <input v-model="form.geo.far_visitors" type="radio" value="hide_gigs" data-testid="welcome-geo-far-hide_gigs" />
          {{ $t('pages.modules.welcome.farHideGigs') }}
        </label>
        <label class="flex items-center gap-2 text-sm text-zinc-300">
          <input v-model="form.geo.far_visitors" type="radio" value="no_screen" data-testid="welcome-geo-far-no_screen" />
          {{ $t('pages.modules.welcome.farNoScreen') }}
        </label>
        <p class="text-xs text-zinc-500" data-testid="welcome-geo-status">{{ geoStatus }}</p>
      </fieldset>

      <div>
        <button type="submit" class="welcome-btn" :disabled="!dirty || save.isPending.value" data-testid="welcome-save">
          {{ $t('pages.modules.welcome.save') }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.welcome-input {
  padding: 0.3rem 0.5rem; border-radius: 0.375rem;
  border: 1px solid var(--c-334155-line); background: var(--c-0d0d0d);
  color: var(--c-e2e8f0); font-size: var(--fs-sm); font-variant-numeric: tabular-nums;
}
.welcome-btn {
  padding: 0.35rem 0.85rem; border-radius: 0.375rem; border: none;
  background: var(--c-e8e8e8); color: var(--c-111111); font-size: var(--fs-sm); font-weight: 600; cursor: pointer;
}
.welcome-btn:disabled { cursor: not-allowed; background: var(--c-2a2a2a); color: var(--c-6b6b6b); }
.welcome-btn-quiet {
  padding: 0.35rem 0.85rem; border-radius: 0.375rem; background: transparent;
  border: 1px solid var(--c-334155-line); color: var(--c-d0d0d0); font-size: var(--fs-sm); cursor: pointer;
}
</style>
