<script setup lang="ts">
const search = defineModel<string>('search', { default: '' })

defineProps<{
  total: number
  showing: number
}>()
</script>

<template>
  <div class="toolbar">
    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
      </svg>
      <input
        v-model="search"
        class="search-input"
        type="search"
        placeholder="Search…"
        autocomplete="off"
        spellcheck="false"
        aria-label="Search"
      />
    </div>

    <slot name="filters" />

    <span v-if="total > 0" class="result-count" aria-live="polite">
      {{ showing === total ? total : `${showing} / ${total}` }}
    </span>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid #13132e;
  background: #09091e;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 20rem;
  flex: 1;
}

.search-icon {
  position: absolute;
  left: 0.5rem;
  width: 0.8125rem;
  height: 0.8125rem;
  color: #334155;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.3125rem 0.625rem 0.3125rem 1.75rem;
  background: #0d0d22;
  border: 1px solid #1e1c4a;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #e2e8f0;
  outline: none;
  transition: border-color 150ms;
}
.search-input::placeholder { color: #2d3b52; }
.search-input:focus { border-color: #4338ca; }
.search-input::-webkit-search-cancel-button { display: none; }

.result-count {
  margin-left: auto;
  font-size: 0.7rem;
  color: #334155;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
