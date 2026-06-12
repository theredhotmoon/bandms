<script setup lang="ts">
import NewsletterSignup from '@/components/NewsletterSignup.vue'
</script>

<template>
  <main class="nl-page">
    <div class="nl-container">
      <header class="nl-page-header">
        <h1 class="nl-page-title">Newsletter</h1>
        <p class="nl-page-desc">
          Stay up to date with new shows, releases, and news. We send only what matters — no spam.
        </p>
      </header>

      <NewsletterSignup
        source="newsletter-page"
        title="Stay in the loop"
        subtitle="Get notified about new shows, releases and news directly to your inbox."
      />
    </div>
  </main>
</template>

<style scoped>
.nl-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
}

.nl-container {
  width: 100%;
  max-width: 480px;
}

.nl-page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.nl-page-title {
  font-size: 2rem;
  font-weight: 800;
  color: #111;
  margin-bottom: 0.5rem;
  letter-spacing: -0.03em;
}

.nl-page-desc {
  font-size: 0.9375rem;
  color: #555;
  line-height: 1.6;
  margin: 0;
}
</style>
