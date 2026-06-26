<script setup lang="ts">
const props = defineProps<{ uuid: string }>()
</script>

<template>
  <div class="tdc-card">
    <div class="tdc-qr-wrap">
      <img
        :src="`/api/tickets/${props.uuid}/qr`"
        :alt="`QR code for ticket ${props.uuid}`"
        class="tdc-qr"
        width="200"
        height="200"
      />
    </div>

    <p class="tdc-ref">Ticket <span class="tdc-uuid">{{ props.uuid.slice(0, 8) }}</span></p>

    <div class="tdc-links">
      <a
        :href="`/api/tickets/${props.uuid}/pdf`"
        target="_blank"
        rel="noopener noreferrer"
        class="tdc-btn"
      >Download PDF</a>

      <a
        :href="`/api/tickets/${props.uuid}/wallet/apple`"
        target="_blank"
        rel="noopener noreferrer"
        class="tdc-btn tdc-btn--outline"
      >Add to Apple Wallet</a>

      <a
        :href="`/api/tickets/${props.uuid}/wallet/google`"
        target="_blank"
        rel="noopener noreferrer"
        class="tdc-btn tdc-btn--outline"
      >Add to Google Wallet</a>
    </div>
  </div>
</template>

<style scoped>
.tdc-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid #e5e5e5;
  border-radius: 0.75rem;
  background: #fafafa;
}

.tdc-qr-wrap {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 0.5rem;
  padding: 0.5rem;
  line-height: 0;
}

.tdc-qr {
  display: block;
  width: 160px;
  height: 160px;
  object-fit: contain;
}

.tdc-ref {
  font-size: 0.75rem;
  color: #888;
  margin: 0;
}

.tdc-uuid {
  font-family: monospace;
  color: #555;
}

.tdc-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.tdc-btn {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  background: #111;
  color: #fff;
  transition: background 120ms;
}

.tdc-btn:hover {
  background: #333;
}

.tdc-btn--outline {
  background: #fff;
  color: #111;
  border: 1px solid #ddd;
}

.tdc-btn--outline:hover {
  background: #f5f5f5;
}
</style>
