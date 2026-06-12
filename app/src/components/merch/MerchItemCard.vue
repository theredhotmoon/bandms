<script setup lang="ts">
import { computed } from 'vue'
import type { ShopItemSummary } from '@/types/shop'

const props = defineProps<{ item: ShopItemSummary }>()

const primaryPrice = computed(() => {
  if (!props.item.prices.length) return null
  return props.item.prices[0]
})

const priceLabel = computed(() => {
  if (!primaryPrice.value) return null
  const prefix = props.item.prices.length > 1 ? 'from ' : ''
  return `${prefix}${primaryPrice.value.currency} ${Number(primaryPrice.value.amount).toFixed(2)}`
})

const isSoldOut = computed(() => {
  const { stock_quantity, variants } = props.item
  if (variants.length) {
    return variants.every(v => v.stock_quantity !== null && v.stock_quantity === 0)
  }
  return stock_quantity !== null && stock_quantity === 0
})
</script>

<template>
  <RouterLink :to="`/merch/${item.slug}`" class="merch-card">
    <div class="merch-thumb">
      <img v-if="item.cover_photo" :src="item.cover_photo" :alt="item.name" class="merch-img" />
      <div v-else class="merch-img-placeholder">🛍</div>

      <div v-if="isSoldOut" class="sold-out-overlay">Sold out</div>
      <div v-else-if="item.is_presale" class="presale-badge">Pre-sale</div>
    </div>

    <div class="merch-info">
      <div class="merch-name">{{ item.name }}</div>
      <div v-if="priceLabel" class="merch-price">{{ priceLabel }}</div>
      <div v-else class="merch-price merch-price--empty">—</div>
    </div>
  </RouterLink>
</template>

<style scoped>
.merch-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  border-radius: 0.625rem;
  overflow: hidden;
  border: 1px solid #e5e5e5;
  background: #fff;
  transition: box-shadow 150ms, transform 150ms;
}
.merch-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.09);
  transform: translateY(-2px);
}

.merch-thumb {
  position: relative;
  aspect-ratio: 1;
  background: #f5f5f5;
  overflow: hidden;
}
.merch-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 200ms ease;
}
.merch-card:hover .merch-img { transform: scale(1.03); }
.merch-img-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem; color: #ccc;
}

.sold-out-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 0.875rem; font-weight: 700;
  letter-spacing: 0.05em; text-transform: uppercase;
}

.presale-badge {
  position: absolute; top: 0.5rem; left: 0.5rem;
  background: #111; color: #fff;
  font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.07em; text-transform: uppercase;
  padding: 0.2rem 0.5rem; border-radius: 0.25rem;
}

.merch-info {
  padding: 0.75rem;
  display: flex; flex-direction: column; gap: 0.25rem;
}
.merch-name {
  font-size: 0.9rem; font-weight: 600; color: #111;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.merch-price { font-size: 0.8125rem; color: #555; }
.merch-price--empty { color: #bbb; }
</style>
