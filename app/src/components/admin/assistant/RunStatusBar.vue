<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CrawlRun } from '@/types/assistantCrawler'
import { sourceName } from '@/utils/crawlerSourceNames'

const props = defineProps<{ runs: CrawlRun[]; running: boolean }>()
const emit = defineEmits<{ run: [] }>()

const { t } = useI18n()

/** Three failed runs in a row is not a blip — say so above everything else. */
const FAILING_BANNER_AT = 3
const failing = computed(() => props.runs.filter(r => (r.failing_runs ?? 0) >= FAILING_BANNER_AT))

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
    <p v-for="r in failing" :key="`banner-${r.source}`" class="rs-banner" role="alert" data-testid="run-failing-banner">
      {{ $t('more.assistant.runs.failingBanner', { source: sourceName(r.source, t), n: r.failing_runs }) }}
    </p>
    <div class="rs-row">
      <span v-if="!runs.length" class="rs-empty">{{ $t('more.assistant.runs.never') }}</span>
      <span
        v-for="run in runs"
        :key="run.source"
        class="rs-item"
        :class="`rs-item--${run.status ?? 'ok'}`"
        :data-source="run.source"
      >
        <strong>{{ sourceName(run.source, t) }}</strong>
        {{ statusLabel(run.status) }} ·
        {{ $t('more.assistant.runs.summary', { queries: run.queries, new: run.new }) }}
        <template v-if="run.remaining !== undefined"> · {{ $t('more.assistant.runs.remaining', { n: run.remaining }) }}</template>
        <span v-if="run.status === 'failed' && run.error" class="rs-error">{{ run.error }}</span>
      </span>
      <button type="button" class="btn-ghost rs-run" :disabled="running" data-testid="run-now" @click="emit('run')">
        {{ running ? $t('more.assistant.runs.running') : $t('more.assistant.runs.runNow') }}
      </button>
    </div>
  </section>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.rs { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; font-size: var(--fs-xs); color: var(--c-94a3b8); }
.rs-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.25rem; }
.rs-item strong { color: var(--c-e2e8f0); font-weight: 600; margin-right: 0.25rem; }
.rs-item--capped { color: var(--c-f59e0b); }
.rs-item--failed { color: var(--c-f87171); }
.rs-error { display: block; overflow-wrap: anywhere; }
.rs-banner { padding: 0.5rem 0.75rem; border: 1px solid var(--c-333333); border-radius: 0.5rem; color: var(--c-f87171); font-size: var(--fs-sm); }
.rs-run { margin-left: auto; }
</style>
