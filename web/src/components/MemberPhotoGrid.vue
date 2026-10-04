<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ModalShell from '@/components/ModalShell.vue'
import type { MemberPhoto } from '@/types/bandMember'

/**
 * The photos a member is tagged in, as thumbnails that open full size in the
 * site's dialog frame (ModalShell), with previous/next and the arrow keys.
 *
 * Its own island rather than GalleryBrowser: that one browses albums and
 * always opens at an album's first photo, while here the visitor clicks the
 * photo they want.
 */
export interface MemberPhotoGridCopy {
  title: string
  close: string
  prev: string
  next: string
}

const props = defineProps<{ photos: readonly MemberPhoto[]; alt: string; copy: MemberPhotoGridCopy }>()

const index = ref<number | null>(null)
const photo = computed(() => (index.value === null ? null : props.photos[index.value] ?? null))
let opener: HTMLElement | null = null

function open(i: number, event: MouseEvent) {
  opener = event.currentTarget as HTMLElement
  index.value = i
  document.body.style.overflow = 'hidden'
}
function close() {
  index.value = null
  document.body.style.overflow = ''
  opener?.focus()
}
/** Wraps at both ends, like the gallery's lightbox. */
function step(delta: number) {
  if (index.value === null) return
  const n = props.photos.length
  index.value = (index.value + delta + n) % n
}
function onKeydown(event: KeyboardEvent) {
  if (index.value === null) return
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowRight') step(1)
  else if (event.key === 'ArrowLeft') step(-1)
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="mpg">
    <button
      v-for="(p, i) in photos"
      :key="p.id"
      type="button"
      class="mpg-thumb"
      :aria-label="p.caption || alt"
      data-testid="member-photo"
      @click="open(i, $event)"
    >
      <img :src="p.url" :alt="p.caption || alt" loading="lazy" />
    </button>

    <ModalShell :open="photo !== null" :title="photo?.caption || copy.title" :close-label="copy.close" :width="960" @close="close">
      <div v-if="photo" class="mpg-stage">
        <img :src="photo.url" :alt="photo.caption || alt" class="mpg-full" data-testid="member-photo-full" />
        <template v-if="photos.length > 1">
          <button type="button" class="mpg-nav mpg-nav--prev" :aria-label="copy.prev" @click="step(-1)">‹</button>
          <button type="button" class="mpg-nav mpg-nav--next" :aria-label="copy.next" @click="step(1)">›</button>
          <span class="mpg-count">{{ (index ?? 0) + 1 }} / {{ photos.length }}</span>
        </template>
      </div>
    </ModalShell>
  </div>
</template>

<style scoped>
.mpg { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.mpg-thumb {
  aspect-ratio: 1; padding: 0; border: none; overflow: hidden; cursor: zoom-in;
  border-radius: var(--radius-card); background: var(--color-surface-2);
}
.mpg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .25s ease; }
.mpg-thumb:hover img { transform: scale(1.04); }
.mpg-thumb:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 3px; }
.mpg-stage { position: relative; }
.mpg-full { display: block; width: 100%; max-height: 74vh; object-fit: contain; }
.mpg-nav {
  position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px;
  border: none; border-radius: var(--radius-pill); cursor: pointer;
  background: var(--color-inverse); color: var(--color-on-inverse); font-size: 26px; line-height: 1;
}
.mpg-nav--prev { left: 8px; }
.mpg-nav--next { right: 8px; }
.mpg-count { position: absolute; bottom: 8px; right: 12px; padding: 2px 8px; border-radius: var(--radius-pill); background: var(--color-inverse); color: var(--color-on-inverse); font: 700 12px/1.6 var(--font-body); }
@media (prefers-reduced-motion: reduce) { .mpg-thumb img { transition: none; } }
</style>
