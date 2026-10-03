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

// A build is tracked across polls rather than read off one poll's status: a
// single 'unknown' (the API failing to reach the webhook) mid-build would
// otherwise hide the line and, worse, lose the building → done step, so the
// result would never show. `unknown` changes nothing; `idle` ends a build
// that the webhook has forgotten (it restarted).
//
// The finish is timed from when this page saw it, not the server's
// finishedAt, so a page opened after the build does not flash an old result.
const now = ref(Date.now())
const inBuild = ref(false)
// The last start time a 'building' poll reported. An 'unknown' poll carries
// none, and reading it off that poll would drop the line back to 0%.
const buildStartedAt = ref<number | null>(null)
const finishedSeenAt = ref<number | null>(null)
const finishedTone = ref<'done' | 'error'>('done')
watch(() => status.value?.status, (next) => {
  if (next === 'building') {
    inBuild.value = true
    finishedSeenAt.value = null
    buildStartedAt.value = status.value?.startedAt ?? buildStartedAt.value
  } else if ((next === 'done' || next === 'error') && inBuild.value) {
    inBuild.value = false
    finishedTone.value = next
    // Advance `now` in the same step: left at the last tick it would sit just
    // before the finish, the elapsed time would be negative and the result
    // would never show.
    finishedSeenAt.value = Date.now()
    now.value = finishedSeenAt.value
  } else if (next === 'idle') {
    inBuild.value = false
  }
}, { immediate: true })

// A start time can arrive on a later 'building' poll than the first one.
watch(() => status.value?.startedAt, (startedAt) => {
  if (startedAt != null && status.value?.status === 'building') buildStartedAt.value = startedAt
})

const progress = computed(() => {
  const s = status.value
  // Server time, so the browser's clock cannot skew the estimate.
  const serverNow = now.value + (s?.clockOffset ?? 0)
  if (inBuild.value) {
    return rebuildProgress({ status: 'building', startedAt: buildStartedAt.value, finishedAt: null }, serverNow)
  }
  return rebuildProgress({ status: finishedSeenAt.value ? finishedTone.value : 'idle', startedAt: null, finishedAt: finishedSeenAt.value }, now.value)
})

// Tick only while there is something to animate.
let timer: ReturnType<typeof setInterval> | null = null
watch(
  () => inBuild.value || finishedSeenAt.value !== null,
  (active) => {
    if (active && !timer) timer = setInterval(() => { now.value = Date.now() }, 500)
    if (!active && timer) { clearInterval(timer); timer = null }
  },
  { immediate: true },
)
watch(() => progress.value.visible, (visible) => {
  if (!visible && !inBuild.value) finishedSeenAt.value = null
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
