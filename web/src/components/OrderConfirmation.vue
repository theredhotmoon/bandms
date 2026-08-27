<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { clearCart } from '@/stores/cart'

interface OrderItem {
  id: number
  name: string
  variant_label: string | null
  price: number
  currency: string
  quantity: number
  concert_ticket_type_id: number | null
  ticket_uuids?: string[]
}

interface Order {
  uuid: string
  status: string
  currency: string
  total: number
  items?: OrderItem[]
}

const status = ref<'loading' | 'found' | 'missing' | 'error'>('loading')
const order  = ref<Order | null>(null)

onMounted(async () => {
  const uuid = new URLSearchParams(window.location.search).get('order_uuid')

  if (!uuid) {
    status.value = 'missing'
    return
  }

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(uuid)}`, {
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      status.value = 'error'
      return
    }

    order.value  = (await res.json()).data as Order
    status.value = 'found'

    // Clear only after the backend confirms the order exists. Stripe redirects
    // here before the webhook has necessarily landed, so the order may still be
    // "pending" — but it exists, which is enough to know the cart was consumed.
    // Clearing optimistically on page load instead would wipe the cart of
    // anyone who merely opens this URL with a bad uuid.
    clearCart()
  } catch {
    status.value = 'error'
  }
})

function money(amount: number, currency: string): string {
  return `${currency.toUpperCase()} ${amount.toFixed(2)}`
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface p-8 sm:p-10">
    <p v-if="status === 'loading'" class="text-muted">Confirming your order…</p>

    <template v-else>
      <div class="mb-6 flex items-center gap-3">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-pill bg-accent/15 text-xl text-accent"
          aria-hidden="true"
        >✓</span>
        <h1 class="text-2xl font-black text-body sm:text-3xl">Payment confirmed</h1>
      </div>

      <p v-if="status !== 'found'" class="text-muted">
        If your payment went through you'll receive a confirmation email shortly.
        Nothing has been charged twice.
      </p>

      <template v-else-if="order">
        <p class="text-muted">Thanks for your order — we'll email you when it ships.</p>

        <p class="mt-6 text-sm text-muted">
          Order <span class="font-mono text-body">{{ order.uuid }}</span>
        </p>

        <ul v-if="order.items?.length" class="mt-4 divide-y divide-border border-t border-border">
          <li
            v-for="item in order.items"
            :key="item.id"
            class="flex flex-wrap items-baseline gap-x-3 py-3 text-sm"
          >
            <span class="flex-1 text-body">
              {{ item.name }}<template v-if="item.variant_label"> — {{ item.variant_label }}</template>
            </span>
            <span class="text-muted">× {{ item.quantity }}</span>
            <span class="text-body">{{ money(item.price * item.quantity, item.currency) }}</span>

            <!-- Tickets are downloadable straight away; merch is not. -->
            <span v-if="item.ticket_uuids?.length" class="w-full pt-2">
              <a
                v-for="uuid in item.ticket_uuids"
                :key="uuid"
                :href="`/api/tickets/${uuid}/pdf`"
                class="mr-3 inline-block text-accent hover:underline"
              >Download ticket →</a>
            </span>
          </li>
        </ul>

        <p class="mt-4 border-t border-border pt-4 text-right text-sm text-body">
          Total <span class="font-bold">{{ money(order.total, order.currency) }}</span>
        </p>
      </template>

      <a href="/merch" class="mt-8 inline-block text-sm text-accent hover:underline">← Back to merch</a>
    </template>
  </div>
</template>
