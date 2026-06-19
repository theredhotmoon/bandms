<script setup lang="ts">
import { ref, computed } from 'vue'
import { addToCart, preferredPrice, formatPrice } from '@/stores/cart'
import type { ShopItem, ShopItemVariant } from '@/types/shop'

const props = defineProps<{ item: ShopItem }>()

const selectedVariantId = ref<number | null>(
  props.item.variants.length === 1 ? (props.item.variants[0]?.id ?? null) : null
)
const added = ref(false)

const price = computed(() => preferredPrice(props.item.prices))

const selectedVariant = computed((): ShopItemVariant | null =>
  props.item.variants.find(v => v.id === selectedVariantId.value) ?? null
)

const inStock = computed(() => {
  if (!props.item.is_available) return false
  if (selectedVariant.value?.stock_quantity !== undefined && selectedVariant.value.stock_quantity !== null) {
    return selectedVariant.value.stock_quantity > 0
  }
  if (props.item.stock_quantity !== null) return props.item.stock_quantity > 0
  return true
})

const needsVariant = computed(() => props.item.variants.length > 0 && !selectedVariantId.value)

const presaleShipsAt = computed(() => {
  if (!props.item.presale_ships_at) return null
  return new Date(props.item.presale_ships_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})

function add() {
  if (!price.value || !inStock.value || needsVariant.value) return

  addToCart({
    shopItemId: props.item.id,
    variantId:  selectedVariantId.value,
    name:       props.item.name,
    price:      price.value,
    photo:      props.item.cover_photo,
    variant:    selectedVariant.value ? `${selectedVariant.value.name}: ${selectedVariant.value.value}` : null,
  })

  added.value = true
  setTimeout(() => { added.value = false }, 2000)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Price -->
    <div v-if="price" class="text-2xl font-black text-white">
      {{ formatPrice(price) }}
      <span v-if="item.is_presale" class="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-sm font-medium text-accent">
        Pre-sale
      </span>
    </div>

    <!-- Variants -->
    <div v-if="item.variants.length > 0">
      <p class="text-sm font-medium text-zinc-400 mb-2">
        {{ item.variants[0]?.name ?? 'Option' }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="v in item.variants"
          :key="v.id"
          type="button"
          :disabled="v.stock_quantity === 0"
          :class="[
            'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
            selectedVariantId === v.id
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border bg-surface-2 text-zinc-300 hover:border-zinc-600',
            v.stock_quantity === 0 && 'opacity-40 cursor-not-allowed line-through',
          ]"
          @click="selectedVariantId = v.id"
        >
          {{ v.value }}
        </button>
      </div>
    </div>

    <!-- CTA -->
    <div v-if="item.purchase_url">
      <a
        :href="item.purchase_url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex w-full items-center justify-center rounded-lg bg-accent py-3 font-bold text-black hover:bg-accent-dark transition-colors"
      >
        Buy Now
      </a>
    </div>

    <button
      v-else
      type="button"
      :disabled="!inStock || needsVariant || !price"
      class="w-full rounded-lg py-3 font-bold transition-colors"
      :class="[
        added
          ? 'bg-green-700 text-white'
          : inStock && !needsVariant
            ? 'bg-accent text-black hover:bg-accent-dark'
            : 'bg-surface-2 text-zinc-600 cursor-not-allowed',
      ]"
      @click="add"
    >
      <span v-if="added">Added to cart ✓</span>
      <span v-else-if="!inStock">Out of stock</span>
      <span v-else-if="needsVariant">Select an option</span>
      <span v-else>Add to Cart</span>
    </button>

    <p v-if="item.is_presale && presaleShipsAt" class="text-xs text-zinc-500">
      Ships {{ presaleShipsAt }}
    </p>
  </div>
</template>
