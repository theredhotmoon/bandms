<script setup lang="ts">
import { nextTick, watch } from 'vue'
import ModalShell from '@/components/ModalShell.vue'
import { useModalTrigger } from '@/composables/useModalTrigger'

/**
 * The concert poster at full size. Opened by any `[data-open-poster]` element
 * on the page — the poster itself — through the same delegation as the
 * calendar and the EPK, inside the same ModalShell frame, so this is not a
 * third lightbox but another use of the site's dialog.
 */
export interface PosterModalCopy {
  title: string
  close: string
}

defineProps<{ src: string; alt: string; copy: PosterModalCopy }>()

const { isOpen, close } = useModalTrigger('data-open-poster')

// Hand focus back to the poster on close, so a keyboard user carries on from
// where they opened it instead of from the top of the page.
watch(isOpen, (open) => {
  if (!open) void nextTick(() => document.querySelector<HTMLElement>('[data-open-poster]')?.focus())
})
</script>

<template>
  <ModalShell :open="isOpen" :title="copy.title" :close-label="copy.close" :width="880" @close="close">
    <img :src="src" :alt="alt" class="pm-img" data-testid="poster-full" />
  </ModalShell>
</template>

<style scoped>
.pm-img {
  display: block;
  width: 100%;
  max-height: 78vh;
  object-fit: contain;
}
</style>
