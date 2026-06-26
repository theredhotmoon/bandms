<script setup lang="ts">
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useFanAccount } from '@/composables/useFanAccount'
import { fetchFanOrders } from '@/api/fan'
import { API_BASE } from '@/api/client'

const { token } = useFanAccount()
const { data: orders, isPending, isError } = useQuery({
  queryKey: ['fan', 'orders'],
  queryFn: () => fetchFanOrders(token.value!),
  enabled: computed(() => !!token.value),
})
</script>

<template>
  <section class="fol-section">
    <p v-if="isPending" class="fol-state">Loading orders…</p>
    <p v-else-if="isError" class="fol-state fol-state--error" role="alert">Failed to load orders.</p>
    <p v-else-if="!orders || orders.length === 0" class="fol-state">No orders yet.</p>
    <ul v-else class="fol-list">
      <li v-for="order in orders" :key="order.uuid" class="fol-item">
        <div class="fol-header">
          <time class="fol-date" :datetime="order.created_at">
            {{ new Date(order.created_at).toLocaleDateString() }}
          </time>
          <span class="fol-status">{{ order.status }}</span>
          <span class="fol-total">{{ order.currency }} {{ Number(order.total).toFixed(2) }}</span>
        </div>
        <ul class="fol-items">
          <li v-for="(item, idx) in order.items" :key="idx" class="fol-item-row">
            <span class="fol-item-name">{{ item.name }}</span>
            <span class="fol-item-qty">×{{ item.quantity }}</span>
            <span class="fol-item-price">{{ Number(item.price).toFixed(2) }}</span>
            <template v-if="item.ticket_uuids && item.ticket_uuids.length">
              <a
                v-for="uuid in item.ticket_uuids"
                :key="uuid"
                :href="`${API_BASE}/tickets/${uuid}/pdf`"
                class="fol-pdf-link"
                target="_blank"
                rel="noopener"
              >PDF</a>
            </template>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
