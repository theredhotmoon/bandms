<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { usePublicShop } from '@/composables/usePublicShop'
import { useCartStore } from '@/stores/cart'
import { useLang } from '@/composables/useLang'
import SiteNav from '@/components/public/SiteNav.vue'
import SiteFooter from '@/components/public/SiteFooter.vue'
import CheckerStrip from '@/components/public/CheckerStrip.vue'
import type { ShopItemSummary, ShopItemVariant } from '@/types/shop'

const { lang } = useLang()
const { items: itemsQ, categories: catsQ } = usePublicShop()
const cart = useCartStore()

const items = computed(() => itemsQ.data.value ?? [])
const categories = computed(() => catsQ.data.value ?? [])

// Currency
const currency = ref<string>('PLN')
const availableCurrencies = computed(() => {
  const cs = new Set<string>()
  items.value.forEach(item => item.prices.forEach(p => cs.add(p.currency)))
  return [...cs]
})

function priceFor(item: ShopItemSummary): string {
  const p = item.prices.find(x => x.currency === currency.value) ?? item.prices[0]
  if (!p) return '—'
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: p.currency }).format(p.amount / 100)
}

// Category filter
const activeCategory = ref<number | null>(null)
const filteredItems = computed(() => {
  if (activeCategory.value === null) return items.value.filter(i => i.is_available)
  return items.value.filter(i => i.is_available && i.categories.some(c => c.id === activeCategory.value))
})

// Product modal
const modalItem = ref<ShopItemSummary | null>(null)
const selectedVariant = ref<ShopItemVariant | null>(null)
const modalEl = ref<HTMLElement>()
const modalCloseBtn = ref<HTMLButtonElement>()
let triggerEl: HTMLElement | null = null

function openModal(item: ShopItemSummary, trigger?: HTMLElement) {
  triggerEl = trigger ?? (document.activeElement as HTMLElement | null)
  modalItem.value = item
  selectedVariant.value = item.variants?.[0] ?? null
  requestAnimationFrame(() => modalCloseBtn.value?.focus())
}

function closeModal() {
  modalItem.value = null
  triggerEl?.focus()
  triggerEl = null
}

function onModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { closeModal(); return }
  if (e.key !== 'Tab' || !modalEl.value) return
  const focusable = modalEl.value.querySelectorAll<HTMLElement>(
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

function addToCart() {
  if (!modalItem.value) return
  const item = modalItem.value
  const p = item.prices.find(x => x.currency === currency.value) ?? item.prices[0]
  if (!p) return
  cart.addItem(item.id, selectedVariant.value?.id ?? null, {
    name: item.name,
    variant_label: selectedVariant.value ? selectedVariant.value.value : null,
    currency: p.currency,
    price: p.amount,
    cover_photo: item.cover_photo,
  })
  closeModal()
  cart.openDrawer()
}

const T = {
  en: {
    heroTitle: 'Merch',
    heroSub: 'Gear up with official Skanking Storks merch — records, tees, accessories.',
    all: 'All items',
    addToCart: 'Add to cart',
    outOfStock: 'Out of stock',
    presale: 'Pre-sale',
    cart: 'Cart',
    noItems: 'No items available right now.',
    select: 'Select',
    size: 'Size',
    loading: 'Loading…',
    close: 'Close',
    viewItem: 'View item',
  },
  pl: {
    heroTitle: 'Merch',
    heroSub: 'Oficjalne gadżety Skanking Storks — płyty, koszulki, akcesoria.',
    all: 'Wszystko',
    addToCart: 'Dodaj do koszyka',
    outOfStock: 'Brak w magazynie',
    presale: 'Pre-order',
    cart: 'Koszyk',
    noItems: 'Brak dostępnych produktów.',
    select: 'Wybierz',
    size: 'Rozmiar',
    loading: 'Ładowanie…',
    close: 'Zamknij',
    viewItem: 'Zobacz produkt',
  },
}
const t = computed(() => T[lang.value])
</script>

<template>
  <div class="merch-page">
    <SiteNav active="shop" />
    <main>
    <!-- HERO -->
    <section class="hero">
      <div class="hero-checker" />
      <div class="hero-inner">
        <div class="hero-text">
          <span class="hero-kicker">OFFICIAL STORE · MERCH</span>
          <h1 class="hero-title">{{ t.heroTitle }}</h1>
          <p class="hero-sub">{{ t.heroSub }}</p>
        </div>
        <div class="hero-controls">
          <!-- Currency toggle -->
          <div v-if="availableCurrencies.length > 1" class="currency-toggle">
            <button
              v-for="c in availableCurrencies"
              :key="c"
              class="currency-btn"
              :class="{ 'currency-btn--active': currency === c }"
              @click="currency = c"
            >{{ c }}</button>
          </div>
          <!-- Cart button -->
          <RouterLink to="/cart" class="cart-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            {{ t.cart }}
            <span v-if="cart.itemCount" class="cart-badge">{{ cart.itemCount }}</span>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- CATEGORY TABS -->
    <div class="category-tabs">
      <button
        class="cat-tab"
        :class="{ 'cat-tab--active': activeCategory === null }"
        @click="activeCategory = null"
      >{{ t.all }}</button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat-tab"
        :class="{ 'cat-tab--active': activeCategory === cat.id }"
        @click="activeCategory = cat.id"
      >{{ cat.name }}</button>
    </div>

    <!-- PRODUCTS GRID -->
    <section class="products-section">
      <div v-if="itemsQ.isPending.value" class="loading">{{ t.loading }}</div>
      <div v-else-if="filteredItems.length" class="products-grid">
        <button
          v-for="item in filteredItems"
          :key="item.id"
          type="button"
          class="product-card"
          :aria-label="`${item.name}, ${priceFor(item)}`"
          @click="openModal(item, $event.currentTarget as HTMLElement)"
        >
          <div class="product-img">
            <img
              v-if="item.cover_photo"
              :src="item.cover_photo"
              :alt="item.name"
              class="product-photo"
              loading="lazy"
            />
            <div v-else class="product-img-placeholder" />
            <span v-if="item.is_presale" class="stamp-presale">{{ t.presale }}</span>
          </div>
          <div class="product-body" aria-hidden="true">
            <div class="product-cats">{{ item.categories.map(c => c.name).join(' · ') }}</div>
            <div class="product-name">{{ item.name }}</div>
            <div class="product-price">{{ priceFor(item) }}</div>
            <div v-if="item.variants?.length" class="product-variants">
              <span v-for="v in item.variants.slice(0, 4)" :key="v.id" class="variant-chip">{{ v.value }}</span>
              <span v-if="item.variants.length > 4" class="variant-more">+{{ item.variants.length - 4 }}</span>
            </div>
          </div>
        </button>
      </div>
      <p v-else class="empty-text">{{ t.noItems }}</p>
    </section>

    <!-- PRODUCT MODAL -->
    <Teleport to="body">
      <div v-if="modalItem" class="modal-backdrop" @click.self="closeModal" @keydown.escape="closeModal">
        <div ref="modalEl" class="modal" role="dialog" aria-modal="true" :aria-label="modalItem.name" @keydown="onModalKeydown">
          <button ref="modalCloseBtn" class="modal-close" :aria-label="t.close" @click="closeModal">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div class="modal-inner">
            <div class="modal-img">
              <img
                v-if="modalItem.cover_photo"
                :src="modalItem.cover_photo"
                :alt="modalItem.name"
                class="modal-img-el"
              />
              <div v-else class="modal-img-placeholder" />
            </div>
            <div class="modal-body">
              <div class="modal-cats">{{ modalItem.categories.map(c => c.name).join(' · ') }}</div>
              <h2 class="modal-name">{{ modalItem.name }}</h2>
              <div class="modal-price">{{ priceFor(modalItem) }}</div>

              <!-- Variant picker -->
              <div v-if="modalItem.variants?.length" class="variant-picker">
                <div class="variant-label">{{ t.size }}</div>
                <div class="variant-options">
                  <button
                    v-for="v in modalItem.variants"
                    :key="v.id"
                    class="variant-option"
                    :class="{ 'variant-option--active': selectedVariant?.id === v.id, 'variant-option--oos': v.stock_quantity === 0 }"
                    :disabled="v.stock_quantity === 0"
                    @click="selectedVariant = v"
                  >{{ v.value }}</button>
                </div>
              </div>

              <div class="modal-actions">
                <button class="add-to-cart-btn" @click="addToCart">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                  {{ t.addToCart }}
                </button>
                <RouterLink v-if="modalItem.slug" :to="`/merch/${modalItem.slug}`" class="view-item-btn">
                  {{ t.viewItem }}
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <CheckerStrip :h="14" :size="28" color-a="var(--color-accent)" color-b="#EFE7D6" />
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.merch-page { background: #EFE7D6; color: #121212; font-family: 'Archivo', sans-serif; }

/* HERO */
.hero { background: #121212; color: #EFE7D6; position: relative; overflow: hidden; }
.hero-checker {
  position: absolute; inset: 0;
  background-image: repeating-conic-gradient(rgba(255,255,255,.04) 0% 25%, transparent 0% 50%);
  background-size: 36px 36px;
}
.hero-inner {
  position: relative; padding: 64px 90px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; flex-wrap: wrap;
}
.hero-kicker { font: 800 13px/1 'Archivo', sans-serif; letter-spacing: .28em; color: var(--color-accent); text-transform: uppercase; display: block; margin-bottom: 16px; }
.hero-title { font: 400 80px/.85 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 18px; }
.hero-sub { font: 500 18px/1.5 'Archivo', sans-serif; color: rgba(239,231,214,.75); max-width: 480px; margin: 0; }
.hero-controls { display: flex; flex-direction: column; align-items: flex-end; gap: 16px; flex-shrink: 0; }

.currency-toggle { display: flex; gap: 0; border: 3px solid rgba(239,231,214,.4); }
.currency-btn {
  background: transparent; color: rgba(239,231,214,.7); border: none;
  font: 700 14px/1 'Archivo', sans-serif; letter-spacing: .1em;
  padding: 10px 18px; cursor: pointer; transition: all 150ms;
}
.currency-btn--active { background: var(--color-accent); color: #fff; }

.cart-btn {
  display: inline-flex; align-items: center; gap: 10px; position: relative;
  background: var(--color-accent); color: #fff; text-decoration: none;
  font: 400 16px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 14px 20px; box-shadow: 5px 5px 0 rgba(239,231,214,.3);
  transition: opacity 150ms;
}
.cart-btn:hover { opacity: .9; }
.cart-badge {
  background: #fff; color: var(--color-accent);
  font: 800 12px/1 'Archivo', sans-serif;
  border-radius: 50%; width: 22px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
}

/* TABS */
.category-tabs {
  display: flex; gap: 0; flex-wrap: wrap;
  padding: 28px 90px 0;
  border-bottom: 3px solid #121212;
}
.cat-tab {
  border: none; border-bottom: 3px solid transparent; background: transparent; color: #888;
  font: 700 15px/1 'Archivo', sans-serif; letter-spacing: .06em; text-transform: uppercase;
  padding: 14px 22px; cursor: pointer; transition: all 150ms; margin-bottom: -3px;
}
.cat-tab:hover { color: #121212; }
.cat-tab--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }

/* PRODUCTS */
.products-section { padding: 36px 90px 56px; }
.loading { font: 500 16px/1 'Archivo', sans-serif; color: #777; padding: 32px 0; }
.empty-text { font: 500 16px/1.5 'Archivo', sans-serif; color: #777; padding: 32px 0; }
.products-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.product-card {
  background: #fff; border: 3px solid #121212; box-shadow: 5px 5px 0 #121212;
  cursor: pointer; transition: box-shadow 180ms;
  appearance: none; padding: 0; text-align: left; font: inherit; color: inherit;
}
.product-card:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
.product-card:hover { box-shadow: 8px 8px 0 var(--color-accent); }
.product-img { position: relative; aspect-ratio: 1; overflow: hidden; }
.product-photo { width: 100%; height: 100%; object-fit: cover; transition: transform 300ms; }
.product-card:hover .product-photo { transform: scale(1.04); }
.product-img-placeholder {
  width: 100%; height: 100%;
  background: repeating-linear-gradient(45deg, #c8c0b0, #c8c0b0 9px, #d6cebd 9px, #d6cebd 18px);
}
.stamp-presale {
  position: absolute; top: 12px; right: 12px;
  background: #121212; color: #EFE7D6;
  font: 800 11px/1 'Archivo', sans-serif; letter-spacing: .14em; text-transform: uppercase;
  padding: 6px 10px; transform: rotate(-3deg);
}
.product-body { padding: 16px 18px 20px; }
.product-cats { font: 700 11px/1 'Archivo', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 7px; }
.product-name { font: 400 22px/.95 'Anton', sans-serif; text-transform: uppercase; margin-bottom: 8px; }
.product-price { font: 800 18px/1 'Archivo', sans-serif; color: #121212; }
.product-variants { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; }
.variant-chip {
  border: 2px solid #121212; color: #121212;
  font: 700 11px/1 'Archivo', sans-serif; letter-spacing: .06em;
  padding: 5px 8px; border-radius: 2px;
}
.variant-more { font: 700 11px/1 'Archivo', sans-serif; color: #888; align-self: center; }

/* MODAL */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(18,18,18,.85);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  background: #EFE7D6; border: 3px solid #121212; box-shadow: 12px 12px 0 #121212;
  max-width: 860px; width: 100%; position: relative; max-height: 90vh; overflow-y: auto;
}
.modal-close {
  position: absolute; top: 14px; right: 16px; background: transparent; border: none; cursor: pointer;
  color: #121212; transition: color 150ms;
}
.modal-close:hover { color: var(--color-accent); }
.modal-inner { display: grid; grid-template-columns: 1fr 1fr; }
.modal-img { border-right: 3px solid #121212; overflow: hidden; }
.modal-img-el { width: 100%; height: 100%; min-height: 340px; object-fit: cover; }
.modal-img-placeholder {
  width: 100%; min-height: 340px;
  background: repeating-linear-gradient(45deg, #c8c0b0, #c8c0b0 9px, #d6cebd 9px, #d6cebd 18px);
}
.modal-body { padding: 36px 32px 36px; display: flex; flex-direction: column; }
.modal-cats { font: 700 12px/1 'Archivo', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 10px; }
.modal-name { font: 400 36px/.9 'Anton', sans-serif; text-transform: uppercase; margin: 0 0 12px; }
.modal-price { font: 800 24px/1 'Archivo', sans-serif; margin-bottom: 24px; }
.variant-picker { margin-bottom: 24px; }
.variant-label { font: 700 13px/1 'Archivo', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #666; margin-bottom: 10px; }
.variant-options { display: flex; gap: 8px; flex-wrap: wrap; }
.variant-option {
  border: 3px solid #121212; background: transparent; color: #121212;
  font: 700 14px/1 'Archivo', sans-serif; padding: 10px 14px; cursor: pointer;
  transition: all 150ms;
}
.variant-option:hover:not(:disabled) { background: #121212; color: #EFE7D6; }
.variant-option--active { background: var(--color-accent); border-color: var(--color-accent); color: #fff; box-shadow: 4px 4px 0 #121212; }
.variant-option--oos { opacity: .35; cursor: not-allowed; text-decoration: line-through; }
.modal-actions { display: flex; flex-direction: column; gap: 12px; margin-top: auto; }
.add-to-cart-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 12px;
  background: var(--color-accent); color: #fff; border: none;
  font: 400 18px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 18px 24px; cursor: pointer; box-shadow: 5px 5px 0 #121212; transition: opacity 150ms;
}
.add-to-cart-btn:hover { opacity: .9; }
.view-item-btn {
  display: inline-flex; align-items: center; justify-content: center;
  border: 3px solid #121212; background: transparent; color: #121212;
  font: 400 16px/1 'Anton', sans-serif; text-transform: uppercase;
  padding: 14px 20px; text-decoration: none; transition: background 150ms, color 150ms;
}
.view-item-btn:hover { background: #121212; color: #EFE7D6; }

@media (max-width: 1100px) {
  .hero-inner, .category-tabs, .products-section { padding-left: 40px; padding-right: 40px; }
  .products-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .hero-inner { padding: 40px 20px; }
  .hero-title { font-size: 56px; }
  .category-tabs, .products-section { padding-left: 20px; padding-right: 20px; }
  .products-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .modal-inner { grid-template-columns: 1fr; }
  .modal-img { border-right: none; border-bottom: 3px solid #121212; }
}
@media (max-width: 420px) {
  .products-grid { grid-template-columns: 1fr; }
}
</style>
