<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import CartSummary from '@/components/merch/CartSummary.vue'

const cartStore = useCartStore()
const router = useRouter()

const currency = computed(() => cartStore.selectedCurrency ?? cartStore.currencies[0] ?? 'USD')
const total = computed(() => cartStore.total(currency.value))

function goToCheckout() { router.push('/checkout') }
</script>

<template>
  <div class="cart-view">
    <h1 class="cart-title">Your cart</h1>

    <template v-if="cartStore.isEmpty">
      <div class="cart-empty">
        <p>Your cart is empty.</p>
        <RouterLink to="/merch" class="btn-browse">Browse merch</RouterLink>
      </div>
    </template>
    <template v-else>
      <div class="cart-layout">
        <div class="cart-items">
          <CartSummary
            :items="cartStore.items"
            :currency="currency"
            :editable="true"
            @remove="(key) => cartStore.removeByKey(key)"
            @update-qty="(key, qty) => cartStore.updateQuantityByKey(key, qty)"
          />
        </div>

        <div class="cart-aside">
          <div v-if="cartStore.currencies.length > 1" class="currency-select">
            <label class="cur-label">Currency</label>
            <div class="cur-chips">
              <button
                v-for="c in cartStore.currencies"
                :key="c"
                type="button"
                class="cur-chip"
                :class="{ 'cur-chip--on': currency === c }"
                @click="cartStore.setCurrency(c)"
              >{{ c }}</button>
            </div>
          </div>

          <div class="order-summary">
            <div class="sum-row">
              <span>Subtotal</span>
              <span>{{ currency }} {{ total.toFixed(2) }}</span>
            </div>
            <p class="sum-hint">Taxes and shipping calculated at checkout</p>
          </div>

          <button class="btn-checkout" @click="goToCheckout">Proceed to checkout</button>
          <RouterLink to="/merch" class="btn-continue">Continue shopping</RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cart-view { max-width: 64rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
.cart-title { font-size: 1.75rem; font-weight: 700; color: #111; margin-bottom: 1.5rem; }

.cart-empty { text-align: center; padding: 4rem 0; color: #888; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.btn-browse {
  padding: 0.625rem 1.5rem; border-radius: 0.5rem;
  background: #111; color: #fff; text-decoration: none;
  font-size: 0.875rem; font-weight: 600; transition: background 120ms;
}
.btn-browse:hover { background: #333; }

.cart-layout { display: grid; grid-template-columns: 1fr 22rem; gap: 2.5rem; align-items: start; }

.order-summary {
  border: 1px solid #e5e5e5; border-radius: 0.75rem;
  padding: 1.25rem; margin-bottom: 0.75rem;
}
.sum-row {
  display: flex; justify-content: space-between;
  font-size: 1rem; font-weight: 700; color: #111; margin-bottom: 0.5rem;
}
.sum-hint { font-size: 0.78rem; color: #aaa; }

.currency-select { margin-bottom: 1rem; }
.cur-label { font-size: 0.78rem; font-weight: 600; color: #888; display: block; margin-bottom: 0.375rem; }
.cur-chips { display: flex; gap: 0.375rem; }
.cur-chip {
  padding: 0.25rem 0.625rem; border-radius: 9999px;
  border: 1px solid #ddd; background: #fff; color: #555;
  font-size: 0.78rem; font-weight: 600; cursor: pointer;
  transition: background 100ms, border-color 100ms;
}
.cur-chip--on { background: #111; border-color: #111; color: #fff; }

.btn-checkout {
  width: 100%; padding: 0.875rem; margin-bottom: 0.625rem;
  border-radius: 0.5rem; border: none;
  background: #111; color: #fff;
  font-size: 1rem; font-weight: 700; cursor: pointer;
  transition: background 120ms;
}
.btn-checkout:hover { background: #333; }

.btn-continue {
  display: block; text-align: center;
  padding: 0.625rem; border-radius: 0.5rem;
  border: 1px solid #ddd; background: #fff; color: #555;
  font-size: 0.875rem; font-weight: 500; text-decoration: none;
  transition: background 120ms, color 120ms;
}
.btn-continue:hover { background: #f5f5f5; color: #111; }

@media (max-width: 767px) {
  .cart-layout { grid-template-columns: 1fr; }
}
</style>
