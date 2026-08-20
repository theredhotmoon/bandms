<script setup lang="ts">
import type { CartItem } from '@/types/cart'
import { itemKey } from '@/stores/cart'

const props = defineProps<{
  items: CartItem[]
  currency: string
  editable?: boolean
}>()

const emit = defineEmits<{
  remove: [key: string]
  updateQty: [key: string, qty: number]
}>()

function subtotal(): number {
  return props.items
    .filter(i => i.snapshot.currency === props.currency)
    .reduce((sum, i) => sum + i.snapshot.price * i.quantity, 0)
}
</script>

<template>
  <div class="cart-summary">
    <div v-if="!items.length" class="cart-empty">Your cart is empty.</div>
    <template v-else>
      <div v-for="item in items" :key="itemKey(item)" class="cart-line">
        <div v-if="item.type === 'ticket'" class="line-thumb line-thumb--ticket">🎟</div>
        <img
          v-else-if="item.snapshot.cover_photo"
          :src="item.snapshot.cover_photo"
          :alt="item.snapshot.name"
          class="line-thumb"
        />
        <div v-else class="line-thumb line-thumb--empty">🛍</div>

        <div class="line-meta">
          <div class="line-name">{{ item.snapshot.name }}</div>
          <div v-if="item.type === 'ticket'" class="line-variant line-ticket-badge">Ticket</div>
          <div v-else-if="item.snapshot.variant_label" class="line-variant">{{ item.snapshot.variant_label }}</div>
          <div class="line-unit-price">{{ item.snapshot.currency }} {{ Number(item.snapshot.price).toFixed(2) }}</div>
        </div>

        <div class="line-right">
          <template v-if="editable">
            <div v-if="item.type !== 'ticket'" class="qty-control">
              <button type="button" class="qty-btn" @click="emit('updateQty', itemKey(item), item.quantity - 1)">−</button>
              <span class="qty-val">{{ item.quantity }}</span>
              <button type="button" class="qty-btn" @click="emit('updateQty', itemKey(item), item.quantity + 1)">+</button>
            </div>
            <span v-else class="qty-static">× {{ item.quantity }}</span>
            <button type="button" class="remove-btn" @click="emit('remove', itemKey(item))">Remove</button>
          </template>
          <span v-else class="qty-static">× {{ item.quantity }}</span>

          <div class="line-total">
            {{ item.snapshot.currency }} {{ Number(item.snapshot.price * item.quantity).toFixed(2) }}
          </div>
        </div>
      </div>

      <div class="cart-subtotal">
        <span>Subtotal</span>
        <span>{{ currency }} {{ subtotal().toFixed(2) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cart-summary { display: flex; flex-direction: column; }
.cart-empty { color: #888; font-size: 0.875rem; padding: 1rem 0; }

.cart-line {
  display: flex; gap: 0.75rem; align-items: flex-start;
  padding: 0.75rem 0; border-bottom: 1px solid #f0f0f0;
}
.line-thumb {
  width: 3.25rem; height: 3.25rem; border-radius: 0.375rem;
  object-fit: cover; flex-shrink: 0; border: 1px solid #e5e5e5;
}
.line-thumb--empty {
  display: flex; align-items: center; justify-content: center;
  background: #f5f5f5; font-size: 1.25rem; color: #ccc;
}
.line-thumb--ticket {
  display: flex; align-items: center; justify-content: center;
  background: #fef3c7; font-size: 1.5rem;
  border: 1px solid #fde68a;
}
.line-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; }
.line-name { font-size: 0.875rem; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.line-variant { font-size: 0.75rem; color: #888; }
.line-ticket-badge {
  display: inline-flex; align-items: center;
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: #92400e; background: #fef3c7; border: 1px solid #fde68a;
  border-radius: 0.25rem; padding: 0 0.35rem; width: fit-content;
}
.line-unit-price { font-size: 0.78rem; color: #aaa; }

.line-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.375rem; flex-shrink: 0; }
.qty-control { display: flex; align-items: center; gap: 0.375rem; }
.qty-btn {
  width: 1.5rem; height: 1.5rem; border-radius: 0.25rem;
  border: 1px solid #ddd; background: #f5f5f5;
  font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 100ms;
}
.qty-btn:hover { background: #e5e5e5; }
.qty-val { font-size: 0.875rem; font-weight: 600; color: #111; min-width: 1.25rem; text-align: center; }
.remove-btn {
  font-size: 0.72rem; color: #aaa; background: none; border: none; cursor: pointer; padding: 0;
  transition: color 100ms;
}
.remove-btn:hover { color: #e53e3e; }
.qty-static { font-size: 0.875rem; color: #888; }
.line-total { font-size: 0.875rem; font-weight: 600; color: #111; }

.cart-subtotal {
  display: flex; justify-content: space-between;
  padding: 0.875rem 0 0;
  font-size: 0.9375rem; font-weight: 700; color: #111;
}
</style>
