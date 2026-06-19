<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '@nanostores/vue'
import { cartItems, cartOpen, removeFromCart, updateQuantity, cartTotal, formatPrice } from '@/stores/cart'
import type { CheckoutPayload } from '@/lib/checkout'

const open  = useStore(cartOpen)
const items = useStore(cartItems)

const itemList      = computed(() => Object.values(items.value))
const total         = computed(() => cartTotal(itemList.value))
const currency      = computed(() => itemList.value[0]?.price.currency ?? 'PLN')
const isEmpty       = computed(() => itemList.value.length === 0)
const formattedTotal = computed(() => formatPrice({ currency: currency.value, amount: total.value }))

function close() { cartOpen.set(false) }

async function checkout() {
  if (!itemList.value.length) return
  const payload: CheckoutPayload = {
    currency: currency.value,
    customer: { name: '', email: '', shipping_address: { line1: '', city: '', postal_code: '', country: 'PL' } },
    items: itemList.value.map(i => ({
      shop_item_id: i.shopItemId,
      shop_item_variant_id: i.variantId,
      quantity: i.quantity,
    })),
  }
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as { checkout_url?: string }
    if (data.checkout_url) window.location.href = data.checkout_url
  } catch {
    alert('Checkout failed. Please try again.')
  }
}
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="fixed inset-0 z-50 flex justify-end">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="close" />

      <!-- Panel -->
      <aside class="relative z-10 flex h-full w-full max-w-sm flex-col bg-surface shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 class="font-bold text-white">Cart</h2>
          <button type="button" class="text-zinc-500 hover:text-white transition-colors" aria-label="Close cart" @click="close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Items -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p v-if="isEmpty" class="text-zinc-500 text-sm text-center mt-8">Your cart is empty.</p>
          <div v-for="item in itemList" :key="`${item.shopItemId}-${item.variantId}`" class="flex gap-3">
            <img v-if="item.photo" :src="item.photo" :alt="item.name" class="w-16 h-16 rounded-lg object-cover bg-zinc-900 flex-none" loading="lazy" />
            <div v-else class="w-16 h-16 rounded-lg bg-zinc-900 flex-none" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white line-clamp-1">{{ item.name }}</p>
              <p v-if="item.variant" class="text-xs text-zinc-500">{{ item.variant }}</p>
              <p class="text-xs text-accent mt-0.5">{{ formatPrice(item.price) }}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <button type="button" class="w-6 h-6 rounded border border-border text-zinc-400 hover:text-white transition-colors flex items-center justify-center text-sm" @click="updateQuantity(item.shopItemId, item.variantId, item.quantity - 1)">−</button>
                <span class="text-sm text-white w-4 text-center">{{ item.quantity }}</span>
                <button type="button" class="w-6 h-6 rounded border border-border text-zinc-400 hover:text-white transition-colors flex items-center justify-center text-sm" @click="updateQuantity(item.shopItemId, item.variantId, item.quantity + 1)">+</button>
                <button type="button" class="ml-auto text-xs text-zinc-600 hover:text-red-400 transition-colors" @click="removeFromCart(item.shopItemId, item.variantId)">Remove</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="!isEmpty" class="border-t border-border px-5 py-4 space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-zinc-400">Total</span>
            <span class="font-bold text-white">{{ formattedTotal }}</span>
          </div>
          <button
            type="button"
            class="w-full rounded-lg bg-accent py-3 text-sm font-bold text-black hover:bg-accent-dark transition-colors"
            @click="checkout"
          >
            Checkout
          </button>
          <p class="text-[10px] text-zinc-600 text-center">Secure checkout via Stripe</p>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active { transition: opacity 0.2s ease; }
.drawer-enter-active aside,
.drawer-leave-active aside { transition: transform 0.25s ease; }
.drawer-enter-from,
.drawer-leave-to { opacity: 0; }
.drawer-enter-from aside,
.drawer-leave-to aside { transform: translateX(100%); }
</style>
