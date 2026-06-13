<script setup lang="ts">
import { useCartStore } from '@/stores/cart'

const cartStore = useCartStore()
</script>

<template>
  <button type="button" class="cart-badge-btn" :aria-label="`Cart (${cartStore.itemCount} items)`" @click="cartStore.openDrawer()">
    <svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
    <span v-if="cartStore.itemCount > 0" class="cart-count">{{ cartStore.itemCount }}</span>
  </button>
</template>

<style scoped>
.cart-badge-btn {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 2.25rem; height: 2.25rem;
  border-radius: 0.5rem;
  background: transparent; border: 1px solid transparent;
  cursor: pointer; color: #555;
  transition: background 120ms, color 120ms;
}
.cart-badge-btn:hover { background: #f0f0f0; color: #111; }
.cart-icon { width: 1.125rem; height: 1.125rem; }
.cart-count {
  position: absolute; top: 1px; right: 1px;
  min-width: 1rem; height: 1rem;
  border-radius: 9999px;
  background: #111; color: #fff;
  font-size: 0.6rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 0.2rem;
  line-height: 1;
}
</style>
