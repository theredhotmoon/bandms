<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CrawlRun } from '@/types/assistantCrawler'
import { sourceName } from '@/utils/crawlerSourceNames'

defineProps<{ runs: CrawlRun[] }>()

const { t } = useI18n()

function statusLabel(status: CrawlRun['status']): string {
  switch (status) {
    case 'capped': return t('more.assistant.runs.capped')
    case 'failed': return t('more.assistant.runs.failed')
    default:       return t('more.assistant.runs.ok')
  }
}
</script>

<template>
  <section class="rs" data-testid="run-status" :aria-label="$t('more.assistant.runs.title')">
    <span v-if="!runs.length" class="rs-empty">{{ $t('more.assistant.runs.never') }}</span>
    <span
      v-for="run in runs"
      :key="run.source"
      class="rs-item"
      :class="`rs-item--${run.status ?? 'ok'}`"
      :title="run.error ?? undefined"
    >
      <strong>{{ sourceName(run.source, t) }}</strong>
      {{ statusLabel(run.status) }} ·
      {{ $t('more.assistant.runs.summary', { queries: run.queries, new: run.new }) }}
    </span>
  </section>
</template>

<style scoped>
.rs { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; margin-bottom: 1rem; font-size: var(--fs-xs); color: var(--c-94a3b8); }
.rs-item strong { color: var(--c-e2e8f0); font-weight: 600; margin-right: 0.25rem; }
.rs-item--capped { color: var(--c-f59e0b); }
.rs-item--failed { color: var(--c-f87171); }
</style>
