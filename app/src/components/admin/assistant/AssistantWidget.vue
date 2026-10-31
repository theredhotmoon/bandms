<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAssistantSummary } from '@/composables/useAssistantFindings'
import { adminUrl } from '@/config/admin'
import { formatShortDate } from '@/utils/formatDate'
import { useUiLang } from '@/composables/useUiLang'

/** The dashboard's line about the assistant: what is new, and when it last ran. */
const { t } = useI18n()
const { uiLang } = useUiLang()
const summary = useAssistantSummary()

const lastRun = computed(() => {
  const at = summary.data.value?.last_run_at
  return at ? t('dashboard.assistant.lastRun', { when: formatShortDate(at, uiLang.value, 'instant') }) : t('dashboard.assistant.never')
})
</script>

<template>
  <section v-if="summary.data.value" class="aw" data-testid="assistant-widget">
    <div class="aw-title">{{ $t('dashboard.assistant.title') }}</div>
    <p class="aw-counts">
      <span data-testid="assistant-widget-leads">{{ $t('dashboard.assistant.leads', { n: summary.data.value.new.lead }) }}</span>
      · <span>{{ $t('dashboard.assistant.mentions', { n: summary.data.value.new.mention }) }}</span>
      · <span>{{ $t('dashboard.assistant.news', { n: summary.data.value.new.news }) }}</span>
    </p>
    <p class="aw-meta">
      {{ lastRun }}
      <span v-if="summary.data.value.failing_sources" class="aw-failing">
        · {{ $t('dashboard.assistant.failing', { n: summary.data.value.failing_sources }) }}
      </span>
    </p>
    <RouterLink :to="adminUrl('assistant')" class="aw-link">{{ $t('dashboard.assistant.open') }}</RouterLink>
  </section>
</template>

<style scoped>
.aw { display: flex; flex-direction: column; gap: 0.3rem; padding: 1rem 1.25rem; border: 1px solid var(--c-333333); border-radius: var(--radius-card); background: var(--c-141414); }
.aw-title { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-94a3b8); }
.aw-counts { font-size: var(--fs-sm); color: var(--c-e2e8f0); }
.aw-meta { font-size: var(--fs-xs); color: var(--c-94a3b8); }
.aw-failing { color: var(--c-f87171); }
.aw-link { align-self: flex-start; font-size: var(--fs-sm); color: var(--c-e2e8f0); text-decoration: underline; }
</style>
