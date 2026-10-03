<script setup lang="ts">
defineProps<{ percent: number }>()
</script>

<template>
  <div class="progress-wrap">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: percent + '%' }" />
    </div>
    <span class="progress-label">{{ $t('media.batchUpload.uploadingPct', { pct: percent }) }}</span>
  </div>
</template>

<style scoped>
.progress-wrap  { display: flex; flex-direction: column; gap: 0.35rem; }
.progress-bar   { height: 5px; background: var(--c-252525); border-radius: 9999px; overflow: hidden; }
.progress-fill  { height: 100%; background: var(--c-888888-line); border-radius: 9999px; transition: width 0.2s ease; }
.progress-label { font-size: var(--fs-xs); color: var(--c-94a3b8); text-align: center; }
</style>
