<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePublicShop } from '@/composables/usePublicShop'
import MerchItemCard from '@/components/merch/MerchItemCard.vue'
import CategoryFilter from '@/components/merch/CategoryFilter.vue'

const { items, categories } = usePublicShop()

const selectedCategory = ref<number | null>(null)

const filteredItems = computed(() => {
  const all = items.data.value ?? []
  if (selectedCategory.value === null) return all
  return all.filter(item => item.categories.some(c => c.id === selectedCategory.value))
})
</script>

<template>
  <div class="merch-view">
    <div class="merch-header">
      <h1 class="merch-title">Merch</h1>
      <CategoryFilter
        v-if="categories.data.value?.length"
        :categories="categories.data.value"
        :selected="selectedCategory"
        @update:selected="selectedCategory = $event"
      />
    </div>

    <div v-if="items.isPending.value" class="merch-loading">Loading…</div>
    <div v-else-if="items.isError.value" class="merch-error">Failed to load items. Please refresh.</div>
    <template v-else>
      <div v-if="!filteredItems.length" class="merch-empty">
        {{ selectedCategory !== null ? 'No items in this category.' : 'No items yet. Check back soon!' }}
      </div>
      <div v-else class="merch-grid">
        <MerchItemCard v-for="item in filteredItems" :key="item.id" :item="item" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.merch-view {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.merch-header {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.merch-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111;
  letter-spacing: -0.02em;
}

.merch-loading,
.merch-error,
.merch-empty {
  text-align: center;
  padding: 4rem 0;
  color: #888;
  font-size: 0.9rem;
}
.merch-error { color: #e53e3e; }

.merch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
}

@media (max-width: 640px) {
  .merch-grid { grid-template-columns: repeat(2, 1fr); gap: 0.875rem; }
}
</style>
