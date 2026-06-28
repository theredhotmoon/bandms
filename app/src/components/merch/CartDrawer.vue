<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import CartSummary from './CartSummary.vue'

const cartStore = useCartStore()
const router = useRouter()

const currency = computed(() => cartStore.selectedCurrency ?? cartStore.currencies[0] ?? 'USD')
const drawerEl = ref<HTMLElement>()
const closeBtn = ref<HTMLButtonElement>()

function goToCart() {
  cartStore.closeDrawer()
  router.push('/cart')
}

function goToCheckout() {
  cartStore.closeDrawer()
  router.push('/checkout')
}

function browseMerch() {
  cartStore.closeDrawer()
  router.push('/merch')
}

// Move focus to close button when drawer opens; trap focus inside; close on Esc
watch(() => cartStore.isDrawerOpen, (open) => {
  if (open) {
    requestAnimationFrame(() => closeBtn.value?.focus())
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { cartStore.closeDrawer(); return }
  if (e.key !== 'Tab' || !drawerEl.value) return
  const focusable = drawerEl.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="cartStore.isDrawerOpen" class="drawer-backdrop" @click="cartStore.closeDrawer()" />
    </Transition>

    <Transition name="slide-right">
      <div v-if="cartStore.isDrawerOpen" ref="drawerEl" class="cart-drawer" role="dialog" aria-modal="true" aria-label="Cart" @keydown="onKeydown">
        <div class="drawer-header">
          <span class="drawer-title">Your cart</span>
          <button ref="closeBtn" type="button" class="drawer-close" aria-label="Close cart" @click="cartStore.closeDrawer()">✕</button>
        </div>

        <div class="drawer-body">
          <template v-if="cartStore.isEmpty">
            <div class="drawer-empty">
              <div class="empty-icon">🛍</div>
              <p class="empty-text">Your cart is empty</p>
              <button type="button" class="btn-browse" @click="browseMerch()">
                Browse merch
              </button>
            </div>
          </template>
          <template v-else>
            <CartSummary
              :items="cartStore.items"
              :currency="currency"
              :editable="true"
              @remove="(key) => cartStore.removeByKey(key)"
              @update-qty="(key, qty) => cartStore.updateQuantityByKey(key, qty)"
            />
          </template>
        </div>

        <div v-if="!cartStore.isEmpty" class="drawer-footer">
          <button type="button" class="btn-view-cart" @click="goToCart">View cart</button>
          <button type="button" class="btn-checkout" @click="goToCheckout">Checkout</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed; inset: 0; z-index: 59;
  background: rgba(0,0,0,0.35);
}

.cart-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 60;
  width: min(24rem, 100vw);
  background: #fff;
  border-left: 1px solid #e0e0e0;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,0.08);
}

.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e5e5;
  flex-shrink: 0;
}
.drawer-title { font-size: 1rem; font-weight: 700; color: #111; }
.drawer-close {
  width: 2rem; height: 2rem; border-radius: 0.375rem;
  border: none; background: transparent; color: #888;
  font-size: 0.875rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 120ms, color 120ms;
}
.drawer-close:hover { background: #f0f0f0; color: #111; }

.drawer-body { flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem; }

.drawer-empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem 0;
}
.empty-icon { font-size: 3rem; }
.empty-text { color: #888; font-size: 0.875rem; }
.btn-browse {
  padding: 0.5rem 1.25rem; border-radius: 0.5rem;
  background: #111; color: #fff;
  font-size: 0.875rem; font-weight: 600;
  border: none; cursor: pointer;
  transition: background 120ms;
}
.btn-browse:hover { background: #333; }

.drawer-footer {
  padding: 0.875rem 1.25rem;
  border-top: 1px solid #e5e5e5;
  display: flex; flex-direction: column; gap: 0.5rem;
  flex-shrink: 0;
}
.btn-view-cart {
  width: 100%; padding: 0.625rem;
  border-radius: 0.5rem;
  border: 1px solid #ddd; background: #fff; color: #555;
  font-size: 0.875rem; font-weight: 500; cursor: pointer;
  transition: background 120ms;
}
.btn-view-cart:hover { background: #f5f5f5; color: #111; }
.btn-checkout {
  width: 100%; padding: 0.75rem;
  border-radius: 0.5rem;
  border: none; background: #111; color: #fff;
  font-size: 0.9375rem; font-weight: 700; cursor: pointer;
  transition: background 120ms;
}
.btn-checkout:hover { background: #333; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 200ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-right-enter-active, .slide-right-leave-active { transition: transform 250ms ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }
</style>
