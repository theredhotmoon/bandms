<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { cartCount, cartOpen } from '@/stores/cart'

const count = useStore(cartCount)
</script>

<template>
  <button
    type="button"
    class="relative flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-2 transition-colors"
    aria-label="Open cart"
    @click="cartOpen.set(true)"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
    <span
      v-if="count > 0"
      class="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-accent text-black text-[10px] font-bold flex items-center justify-center px-0.5"
    >
      {{ count }}
    </span>
  </button>
</template>
