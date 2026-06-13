<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { fetchOrder } from '@/api/shop'
import { useCartStore } from '@/stores/cart'

const route = useRoute()
const uuid = computed(() => {
  const v = route.query.order_uuid
  return typeof v === 'string' ? v : undefined
})

const cartStore = useCartStore()

const { data: order, isPending } = useQuery({
  queryKey: computed(() => ['order', uuid.value]),
  queryFn: () => fetchOrder(uuid.value!),
  enabled: computed(() => !!uuid.value),
})

// Clear cart only once we confirm the order exists on the backend
watch(order, (o) => {
  if (o) cartStore.clearCart()
}, { once: true })
</script>

<template>
  <div class="success-view">
    <div class="success-card">
      <div class="success-icon">✓</div>
      <h1 class="success-title">Payment confirmed!</h1>
      <p v-if="uuid" class="success-sub">Thanks for your order. We'll email you when it ships.</p>
      <p v-else class="success-sub">If your payment was successful, you'll receive a confirmation email shortly.</p>

      <template v-if="uuid && !isPending && order">
        <div class="order-ref">Order <span class="order-uuid">{{ order.uuid }}</span></div>
        <div v-if="order.items?.length" class="order-items">
          <div v-for="item in order.items" :key="item.id" class="order-line">
            <span class="line-name">{{ item.name }}<template v-if="item.variant_label"> — {{ item.variant_label }}</template></span>
            <span class="line-qty">× {{ item.quantity }}</span>
            <span class="line-price">{{ item.currency }} {{ Number(item.price * item.quantity).toFixed(2) }}</span>
          </div>
        </div>
      </template>

      <RouterLink to="/merch" class="btn-continue">Continue shopping</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.success-view {
  min-height: 60vh;
  display: flex; align-items: center; justify-content: center;
  padding: 2rem 1.5rem;
}
.success-card {
  max-width: 28rem;
  width: 100%;
  display: flex; flex-direction: column; align-items: center;
  gap: 1rem; text-align: center;
}
.success-icon {
  width: 4rem; height: 4rem; border-radius: 50%;
  background: #111; color: #fff;
  font-size: 1.75rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.success-title { font-size: 1.5rem; font-weight: 700; color: #111; }
.success-sub { color: #555; font-size: 0.9rem; }
.order-ref { font-size: 0.8rem; color: #888; }
.order-uuid { font-family: monospace; font-size: 0.78rem; color: #555; }
.order-items {
  width: 100%; border: 1px solid #e5e5e5; border-radius: 0.5rem;
  overflow: hidden; text-align: left;
}
.order-line {
  display: flex; gap: 0.5rem; padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f0f0f0; font-size: 0.8125rem; color: #333;
}
.order-line:last-child { border-bottom: none; }
.line-name { flex: 1; }
.line-qty { color: #888; }
.line-price { font-weight: 600; min-width: 4rem; text-align: right; }
.btn-continue {
  margin-top: 0.5rem;
  padding: 0.625rem 1.5rem;
  border-radius: 0.5rem;
  background: #111; color: #fff;
  font-size: 0.875rem; font-weight: 600;
  text-decoration: none;
  transition: background 120ms;
}
.btn-continue:hover { background: #333; }
</style>
