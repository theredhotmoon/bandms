<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { fetchShopItemBySlug } from '@/api/shop'
import type { ShopItemVariant } from '@/types/shop'
import VariantSelector from '@/components/merch/VariantSelector.vue'
import { useCartStore } from '@/stores/cart'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { data: item, isPending, isError } = useQuery({
  queryKey: computed(() => ['shop-item-slug', slug.value]),
  queryFn: () => fetchShopItemBySlug(slug.value),
  staleTime: 5 * 60 * 1000,
})

const variantGroups = computed(() => {
  const variants = item.value?.variants ?? []
  if (!variants.length) return []
  const map = new Map<string, ShopItemVariant[]>()
  for (const v of variants) {
    if (!map.has(v.name)) map.set(v.name, [])
    map.get(v.name)!.push(v)
  }
  return Array.from(map.entries()).map(([name, variants]) => ({ name, variants }))
})

const selectedVariants = ref<Record<string, number>>({})

const allGroupsSelected = computed(() => {
  if (!variantGroups.value.length) return true
  return variantGroups.value.every(g => selectedVariants.value[g.name] != null)
})

const selectedVariantSoldOut = computed(() => {
  for (const group of variantGroups.value) {
    const selectedId = selectedVariants.value[group.name]
    if (selectedId == null) continue
    const variant = group.variants.find(v => v.id === selectedId)
    if (variant && variant.stock_quantity !== null && variant.stock_quantity === 0) return true
  }
  return false
})

const itemSoldOut = computed(() => {
  if (!item.value) return false
  if (variantGroups.value.length) {
    return item.value.variants.every(v => v.stock_quantity !== null && v.stock_quantity === 0)
  }
  return item.value.stock_quantity !== null && item.value.stock_quantity === 0
})

const canAddToCart = computed(() =>
  !itemSoldOut.value && allGroupsSelected.value && !selectedVariantSoldOut.value,
)

const selectedPhoto = ref<string | null>(null)
const displayPhoto = computed(() => selectedPhoto.value ?? item.value?.cover_photo ?? null)

const cartStore = useCartStore()

function addToCart() {
  if (!item.value || !canAddToCart.value) return

  // Resolve variant label and id
  let variantId: number | null = null
  let variantLabel: string | null = null
  const labelParts: string[] = []

  for (const group of variantGroups.value) {
    const selectedId = selectedVariants.value[group.name]
    if (selectedId == null) continue
    const variant = group.variants.find(v => v.id === selectedId)
    if (variant) {
      variantId = variant.id  // last group wins for variant_id (single variant support)
      labelParts.push(`${group.name}: ${variant.value}`)
    }
  }
  if (labelParts.length) variantLabel = labelParts.join(', ')

  // Use first price matching selectedCurrency, or first available price
  const currency = cartStore.selectedCurrency ?? item.value.prices[0]?.currency ?? 'USD'
  const priceObj = item.value.prices.find(p => p.currency === currency) ?? item.value.prices[0]
  if (!priceObj) return

  cartStore.addItem(item.value.id, variantId, {
    name:          item.value.name,
    variant_label: variantLabel,
    price:         priceObj.amount,
    currency:      priceObj.currency,
    cover_photo:   item.value.cover_photo,
  })
  cartStore.openDrawer()
}
</script>

<template>
  <div class="item-view">
    <div v-if="isPending" class="item-loading">Loading…</div>
    <div v-else-if="isError" class="item-error">Item not found.</div>
    <template v-else-if="item">
      <RouterLink to="/merch" class="back-link">← Back to Merch</RouterLink>

      <div class="item-layout">
        <!-- Photo gallery -->
        <div class="item-gallery">
          <div class="item-main-photo">
            <img v-if="displayPhoto" :src="displayPhoto" :alt="item.name" class="main-photo-img" />
            <div v-else class="main-photo-placeholder">🛍</div>
          </div>
          <div v-if="item.photos.length > 1" class="item-thumbs">
            <button
              v-for="photo in item.photos"
              :key="photo.id"
              type="button"
              class="thumb-btn"
              :class="{ 'thumb-btn--active': displayPhoto === photo.url }"
              @click="selectedPhoto = photo.url"
            >
              <img :src="photo.url" :alt="photo.alt_text ?? ''" class="thumb-img" />
            </button>
          </div>
        </div>

        <!-- Details -->
        <div class="item-details">
          <h1 class="item-name">{{ item.name }}</h1>

          <div v-if="item.prices.length" class="item-prices">
            <span v-for="p in item.prices" :key="p.currency" class="price-tag">
              {{ p.currency }} {{ Number(p.amount).toFixed(2) }}
            </span>
          </div>

          <div v-if="item.is_presale" class="presale-note">
            Pre-sale{{ item.presale_ships_at ? ` — ships ${item.presale_ships_at}` : '' }}
          </div>

          <div v-if="item.description" class="item-desc">{{ item.description }}</div>

          <!-- Variants -->
          <div v-if="variantGroups.length" class="variant-groups">
            <VariantSelector
              v-for="group in variantGroups"
              :key="group.name"
              :group-name="group.name"
              :variants="group.variants"
              :selected="selectedVariants[group.name] ?? null"
              @update:selected="selectedVariants[group.name] = $event"
            />
          </div>

          <!-- Add to cart -->
          <div class="cart-actions">
            <button
              v-if="itemSoldOut"
              class="btn-soldout"
              disabled
            >Sold out</button>
            <template v-else>
              <button
                class="btn-cart"
                :disabled="!canAddToCart"
                :title="!allGroupsSelected ? 'Please select all options' : undefined"
                @click="addToCart"
              >Add to cart</button>
              <p v-if="variantGroups.length && !allGroupsSelected" class="selection-hint">
                Please select {{ variantGroups.filter(g => selectedVariants[g.name] == null).map(g => g.name).join(', ') }}
              </p>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.item-view {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 4rem;
}

.item-loading, .item-error {
  text-align: center;
  padding: 4rem 0;
  color: #888;
}
.item-error { color: #e53e3e; }

.back-link {
  display: inline-block;
  font-size: 0.8125rem;
  color: #888;
  text-decoration: none;
  margin-bottom: 1.5rem;
  transition: color 120ms;
}
.back-link:hover { color: #111; }

.item-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: start;
}

/* Gallery */
.item-gallery { display: flex; flex-direction: column; gap: 0.75rem; }
.item-main-photo {
  aspect-ratio: 1;
  border-radius: 0.75rem;
  overflow: hidden;
  background: #f5f5f5;
  border: 1px solid #e5e5e5;
}
.main-photo-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.main-photo-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 5rem; color: #ddd;
}
.item-thumbs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.thumb-btn {
  width: 4rem; height: 4rem; border-radius: 0.375rem;
  overflow: hidden; border: 2px solid transparent;
  cursor: pointer; padding: 0; background: none;
  transition: border-color 120ms;
}
.thumb-btn--active { border-color: #111; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Details */
.item-details { display: flex; flex-direction: column; gap: 1rem; }
.item-name { font-size: 1.5rem; font-weight: 700; color: #111; letter-spacing: -0.02em; }
.item-prices { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.price-tag { font-size: 1.125rem; font-weight: 600; color: #111; }

.presale-note {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #111;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.375rem;
  letter-spacing: 0.04em;
  align-self: flex-start;
}

.item-desc {
  font-size: 0.9rem;
  color: #555;
  line-height: 1.6;
  white-space: pre-line;
}

.variant-groups { display: flex; flex-direction: column; gap: 1rem; }

.cart-actions { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }

.btn-cart {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background: #111;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, opacity 120ms;
}
.btn-cart:hover:not(:disabled) { background: #333; }
.btn-cart:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-soldout {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #ddd;
  background: #f5f5f5;
  color: #aaa;
  font-size: 1rem;
  font-weight: 600;
  cursor: not-allowed;
}

.selection-hint { font-size: 0.8rem; color: #888; }

@media (max-width: 767px) {
  .item-layout { grid-template-columns: 1fr; gap: 1.5rem; }
}
</style>
