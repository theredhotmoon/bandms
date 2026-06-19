<script setup lang="ts">
import { ref } from 'vue'

interface NavLink { href: string; label: string }

const props = defineProps<{ links: NavLink[] }>()
const open = ref(false)

function toggle() { open.value = !open.value }
function close()  { open.value = false }
</script>

<template>
  <div class="lg:hidden">
    <!-- Hamburger -->
    <button
      type="button"
      class="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-2 transition-colors"
      :aria-label="open ? 'Close menu' : 'Open menu'"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg v-if="!open" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Overlay -->
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/95 flex flex-col"
        @click.self="close"
      >
        <!-- Close button -->
        <div class="flex justify-end p-4">
          <button
            type="button"
            class="flex items-center justify-center w-10 h-10 rounded-lg text-zinc-400 hover:text-white transition-colors"
            aria-label="Close menu"
            @click="close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Links -->
        <nav class="flex-1 flex flex-col items-center justify-center gap-6" aria-label="Mobile navigation">
          <a
            v-for="link in props.links"
            :key="link.href"
            :href="link.href"
            class="text-2xl font-bold text-zinc-300 hover:text-white transition-colors"
            @click="close"
          >
            {{ link.label }}
          </a>
        </nav>

        <!-- Brand -->
        <div class="text-center pb-8 text-zinc-700 font-black text-sm">
          Skanking Storks
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
