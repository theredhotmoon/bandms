<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSiteRebuild } from '@/composables/useSiteRebuild'
import { rebuildProgress } from '@/utils/rebuildProgress'

/**
 * A thin line along the bottom edge of the rebuild bar, on every admin page:
 * it grows while the public site rebuilds, fills green when it is done and
 * turns red when it fails. The bar's own "Rebuilding…" label carries the
 * words; this carries the progress, which had been invisible since #99.
 */
const { t } = useI18n()
const { statusQuery } = useSiteRebuild()
const status = computed(() => statusQuery.data.value)

// The finish is timed from when this page saw it, not the server's
// finishedAt: the two clocks can differ, and a page opened after the build
// should not flash a result nobody was waiting for.
const finishedSeenAt = ref<number | null>(null)
watch(() => status.value?.status, (next, prev) => {
  if (prev === 'building' && (next === 'done' || next === 'error')) finishedSeenAt.value = Date.now()
})

const now = ref(Date.now())
const progress = computed(() =>
  rebuildProgress(
    { status: status.value?.status ?? 'unknown', startedAt: status.value?.startedAt ?? null, finishedAt: finishedSeenAt.value },
    now.value,
  ),
)

// Tick only while there is something to animate.
let timer: ReturnType<typeof setInterval> | null = null
watch(
  () => status.value?.status === 'building' || finishedSeenAt.value !== null,
  (active) => {
    if (active && !timer) timer = setInterval(() => { now.value = Date.now() }, 500)
    if (!active && timer) { clearInterval(timer); timer = null }
  },
  { immediate: true },
)
watch(() => progress.value.visible, (visible) => {
  if (!visible && status.value?.status !== 'building') finishedSeenAt.value = null
})
onUnmounted(() => { if (timer) clearInterval(timer) })

const label = computed(() =>
  progress.value.tone === 'error' ? t('common.rebuild.progressFailed')
    : progress.value.tone === 'done' ? t('common.rebuild.progressDone')
      : t('common.rebuild.rebuilding'),
)
</script>

<template>
  <div
    v-if="progress.visible"
    class="rebuild-progress"
    :class="`rebuild-progress--${progress.tone}`"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(progress.percent)"
    data-testid="rebuild-progress"
  >
    <div class="rebuild-progress-fill" :style="{ transform: `scaleX(${progress.percent / 100})` }" />
  </div>
</template>

<style scoped>
.rebuild-progress {
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 3px;
  overflow: hidden;
  pointer-events: none;
}
.rebuild-progress-fill {
  height: 100%;
  transform-origin: left center;
  transition: transform 500ms linear, background-color 200ms;
  background: var(--c-14b8a6);
}
.rebuild-progress--done .rebuild-progress-fill { background: var(--c-4ade80); }
.rebuild-progress--error .rebuild-progress-fill { background: var(--c-f87171); }
@media (prefers-reduced-motion: reduce) {
  .rebuild-progress-fill { transition: none; }
}
</style>
