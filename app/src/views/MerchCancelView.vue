<script setup lang="ts">
</script>

<template>
  <div class="cancel-view">
    <div class="cancel-card">
      <div class="cancel-icon">✕</div>
      <h1 class="cancel-title">Payment cancelled</h1>
      <p class="cancel-sub">No worries — your cart is still saved. You can try again whenever you're ready.</p>
      <div class="cancel-actions">
        <RouterLink to="/cart" class="btn-cart">Return to cart</RouterLink>
        <RouterLink to="/merch" class="btn-merch">Continue shopping</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cancel-view {
  min-height: 60vh;
  display: flex; align-items: center; justify-content: center;
  padding: 2rem 1.5rem;
}
.cancel-card {
  max-width: 28rem; width: 100%;
  display: flex; flex-direction: column; align-items: center;
  gap: 1rem; text-align: center;
}
.cancel-icon {
  width: 4rem; height: 4rem; border-radius: 50%;
  background: #f5f5f5; border: 1px solid #e0e0e0;
  color: #aaa; font-size: 1.5rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.cancel-title { font-size: 1.5rem; font-weight: 700; color: #111; }
.cancel-sub { color: #555; font-size: 0.9rem; max-width: 22rem; }
.cancel-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem; }
.btn-cart {
  padding: 0.625rem 1.25rem; border-radius: 0.5rem;
  background: #111; color: #fff;
  font-size: 0.875rem; font-weight: 600;
  text-decoration: none; transition: background 120ms;
}
.btn-cart:hover { background: #333; }
.btn-merch {
  padding: 0.625rem 1.25rem; border-radius: 0.5rem;
  border: 1px solid #ddd; background: #fff; color: #555;
  font-size: 0.875rem; font-weight: 500;
  text-decoration: none; transition: background 120ms, color 120ms;
}
.btn-merch:hover { background: #f5f5f5; color: #111; }
</style>
