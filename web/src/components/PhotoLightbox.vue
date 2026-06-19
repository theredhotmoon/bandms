<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Photo { src: string; caption?: string | null }

const props = defineProps<{ photos: Photo[] }>()

const current = ref<number | null>(null)

function open(i: number) { current.value = i }
function close() { current.value = null }
function prev() { if (current.value !== null && current.value > 0) current.value-- }
function next() { if (current.value !== null && current.value < props.photos.length - 1) current.value++ }

function onKey(e: KeyboardEvent) {
  if (current.value === null) return
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- Grid -->
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
    <button
      v-for="(photo, i) in photos"
      :key="i"
      type="button"
      class="group relative aspect-square overflow-hidden rounded-lg bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
      :aria-label="`View photo ${i + 1}`"
      @click="open(i)"
    >
      <img
        :src="photo.src"
        :alt="photo.caption ?? `Photo ${i + 1}`"
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
    </button>
  </div>

  <!-- Lightbox -->
  <Transition name="fade">
    <div
      v-if="current !== null"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      @click.self="close"
    >
      <!-- Close -->
      <button
        type="button"
        class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors"
        aria-label="Close lightbox"
        @click="close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- Prev -->
      <button
        v-if="current > 0"
        type="button"
        class="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full text-zinc-400 hover:text-white bg-black/40 hover:bg-black/60 transition-colors"
        aria-label="Previous photo"
        @click="prev"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      <!-- Image -->
      <figure class="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3">
        <img
          :src="photos[current]!.src"
          :alt="photos[current]!.caption ?? ''"
          class="max-h-[80vh] max-w-full rounded-lg object-contain"
        />
        <figcaption v-if="photos[current]!.caption" class="text-sm text-zinc-400">
          {{ photos[current]!.caption }}
        </figcaption>
        <p class="text-xs text-zinc-600">{{ current + 1 }} / {{ photos.length }}</p>
      </figure>

      <!-- Next -->
      <button
        v-if="current < photos.length - 1"
        type="button"
        class="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full text-zinc-400 hover:text-white bg-black/40 hover:bg-black/60 transition-colors"
        aria-label="Next photo"
        @click="next"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
