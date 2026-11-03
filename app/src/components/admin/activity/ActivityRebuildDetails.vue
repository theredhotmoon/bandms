<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ActivityChange } from '@/types/activity'
import { parseRebuildDiff } from '@/utils/activityRebuild'
import { humanizeType } from '@/utils/activityFilters'
import { rebuildAreaMessageKey } from '@/config/rebuildAreas'
import { useUiLang } from '@/composables/useUiLang'

const props = defineProps<{ change: ActivityChange }>()

const { t } = useI18n()
const { uiLang } = useUiLang()

const details = computed(() => parseRebuildDiff(props.change.diff))

// An area with no catalogue entry prints its raw key — see rebuildAreaMessageKey.
function areaLabel(area: string): string {
  const key = rebuildAreaMessageKey(area)
  return key ? t(key) : area
}

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(uiLang.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="ar" data-testid="activity-rebuild">
    <p class="ar-trigger" :data-trigger="details.trigger">
      {{ details.trigger === 'auto' ? $t('more.activity.rebuild.auto') : $t('more.activity.rebuild.manual') }}
    </p>

    <div class="ar-block">
      <h4 class="ar-head">{{ $t('more.activity.rebuild.areas') }}</h4>
      <ul v-if="details.areas.length" class="ar-areas">
        <li v-for="area in details.areas" :key="area" class="ar-area" data-testid="activity-rebuild-area">{{ areaLabel(area) }}</li>
      </ul>
      <p v-else class="ar-none">{{ $t('more.activity.rebuild.noAreas') }}</p>
    </div>

    <div v-if="details.changes" class="ar-block">
      <h4 class="ar-head">{{ $t('more.activity.rebuild.included', details.changesTotal) }}</h4>
      <p v-if="details.changesTotal > details.changes.length" class="ar-none" data-testid="activity-rebuild-capped">
        {{ $t('more.activity.rebuild.capped', { n: details.changes.length }) }}
      </p>
      <ul v-if="details.changes.length" class="ar-changes">
        <li v-for="c in details.changes" :key="c.log_id" class="ar-change" data-testid="activity-rebuild-change">
          <span class="ar-when">{{ when(c.at) }}</span>
          <span class="ar-who">{{ c.user ?? $t('more.activity.system') }}</span>
          <span class="ar-action">{{ $t(`more.activity.events.${c.action}`) }}</span>
          <span v-if="c.subject_type" class="ar-type">{{ humanizeType(c.subject_type) }}</span>
          <span v-if="c.subject_label" class="ar-label">{{ c.subject_label }}</span>
        </li>
      </ul>
      <p v-else class="ar-none">{{ $t('more.activity.rebuild.noneIncluded') }}</p>
    </div>
  </div>
</template>

<style scoped>
.ar { display: flex; flex-direction: column; gap: 0.6rem; font-size: var(--fs-xs); }
.ar-trigger { margin: 0; color: var(--c-94a3b8); }
.ar-block { display: flex; flex-direction: column; gap: 0.3rem; }
.ar-head { margin: 0; font-size: var(--fs-xs); font-weight: 600; color: var(--c-64748b); }
.ar-areas { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.ar-area {
  padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid var(--c-334155-line);
  color: var(--c-e2e8f0);
}
.ar-changes { margin: 0; padding: 0; list-style: none; }
.ar-change {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem;
  padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--c-1f1f1f);
}
.ar-change:last-child { border-bottom: none; }
.ar-when   { color: var(--c-64748b); white-space: nowrap; }
.ar-who    { color: var(--c-e2e8f0); font-weight: 600; }
.ar-action { color: var(--c-94a3b8); text-transform: lowercase; }
.ar-type   { color: var(--c-94a3b8); }
.ar-label  { color: var(--c-e2e8f0); }
.ar-none   { margin: 0; color: var(--c-64748b); }
</style>
