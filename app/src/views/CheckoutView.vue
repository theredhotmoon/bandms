<script setup lang="ts">
import { reactive, computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useCheckout } from '@/composables/useCheckout'
import CartSummary from '@/components/merch/CartSummary.vue'

const cartStore = useCartStore()
const router    = useRouter()
const { checkout } = useCheckout()

onMounted(() => {
  if (cartStore.isEmpty) router.replace('/merch')
})

const currency      = computed(() => cartStore.selectedCurrency ?? cartStore.currencies[0] ?? 'USD')
const total         = computed(() => cartStore.total(currency.value))
const checkoutItems = computed(() => cartStore.items.filter(i => i.snapshot.currency === currency.value))
const hasShopItems  = computed(() => checkoutItems.value.some(i => i.type === 'shop'))

const promoCode = ref('')
const promoError = ref('')

const form = reactive({
  name:         '',
  email:        '',
  line1:        '',
  line2:        '',
  city:         '',
  postal_code:  '',
  country:      'US',
})

const fieldErrors = reactive<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!form.name.trim())  e.name = 'Name is required'
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required'
  if (hasShopItems.value) {
    if (!form.line1.trim())       e.line1 = 'Address is required'
    if (!form.city.trim())        e.city = 'City is required'
    if (!form.postal_code.trim()) e.postal_code = 'Postal code is required'
    if (!form.country)            e.country = 'Country is required'
  }
  Object.assign(fieldErrors, e)
  return Object.keys(e).length === 0
}

async function handleCheckout() {
  Object.keys(fieldErrors).forEach(k => delete (fieldErrors as Record<string, string>)[k])
  promoError.value = ''
  if (!validate()) return

  const items = checkoutItems.value.map(i => {
    if (i.type === 'ticket') {
      return { ticket_type_id: i.ticket_type_id!, ticket_price_tier_id: i.ticket_price_tier_id!, quantity: i.quantity }
    }
    return { shop_item_id: i.shop_item_id!, shop_item_variant_id: i.variant_id, quantity: i.quantity }
  })

  if (!items.length) return

  const payload: Parameters<typeof checkout.mutateAsync>[0] = {
    currency: currency.value,
    customer: {
      name:  form.name,
      email: form.email,
      ...(hasShopItems.value && {
        shipping_address: {
          line1:       form.line1,
          line2:       form.line2 || undefined,
          city:        form.city,
          postal_code: form.postal_code,
          country:     form.country,
        },
      }),
    },
    items,
    ...(promoCode.value.trim() && { promo_code: promoCode.value.trim().toUpperCase() }),
  }

  try {
    await checkout.mutateAsync(payload)
  } catch {
    // onError in useCheckout shows the toast
  }
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'PL', name: 'Poland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
]
</script>

<template>
  <div class="checkout-view">
    <h1 class="checkout-title">Checkout</h1>

    <div class="checkout-layout">
      <!-- Form -->
      <form class="checkout-form" @submit.prevent="handleCheckout">
        <div class="form-section-label">Contact</div>

        <div class="field">
          <label class="field-label">Full name *</label>
          <input v-model="form.name" type="text" class="field-input" :class="{ error: fieldErrors.name }" autocomplete="name" />
          <span v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</span>
        </div>

        <div class="field">
          <label class="field-label">Email *</label>
          <input v-model="form.email" type="email" class="field-input" :class="{ error: fieldErrors.email }" autocomplete="email" />
          <span v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</span>
        </div>

        <template v-if="hasShopItems">
          <div class="form-section-label">Shipping address</div>

          <div class="field">
            <label class="field-label">Address line 1 *</label>
            <input v-model="form.line1" type="text" class="field-input" :class="{ error: fieldErrors.line1 }" autocomplete="address-line1" />
            <span v-if="fieldErrors.line1" class="field-error">{{ fieldErrors.line1 }}</span>
          </div>

          <div class="field">
            <label class="field-label">Address line 2</label>
            <input v-model="form.line2" type="text" class="field-input" autocomplete="address-line2" />
          </div>

          <div class="form-row">
            <div class="field">
              <label class="field-label">City *</label>
              <input v-model="form.city" type="text" class="field-input" :class="{ error: fieldErrors.city }" autocomplete="address-level2" />
              <span v-if="fieldErrors.city" class="field-error">{{ fieldErrors.city }}</span>
            </div>
            <div class="field" style="max-width: 10rem;">
              <label class="field-label">Postal code *</label>
              <input v-model="form.postal_code" type="text" class="field-input" :class="{ error: fieldErrors.postal_code }" autocomplete="postal-code" />
              <span v-if="fieldErrors.postal_code" class="field-error">{{ fieldErrors.postal_code }}</span>
            </div>
          </div>

          <div class="field">
            <label class="field-label">Country *</label>
            <select v-model="form.country" class="field-input" :class="{ error: fieldErrors.country }" autocomplete="country">
              <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">{{ c.name }}</option>
            </select>
            <span v-if="fieldErrors.country" class="field-error">{{ fieldErrors.country }}</span>
          </div>
        </template>

        <div class="form-section-label">Promo code</div>

        <div class="promo-row">
          <input
            v-model="promoCode"
            type="text"
            class="field-input promo-input"
            :class="{ error: promoError }"
            placeholder="Enter code (optional)"
            autocomplete="off"
            style="text-transform: uppercase;"
          />
          <span v-if="promoError" class="field-error">{{ promoError }}</span>
        </div>

        <button type="submit" class="btn-pay" :disabled="checkout.isPending.value">
          {{ checkout.isPending.value ? 'Redirecting to Stripe…' : `Pay ${currency} ${total.toFixed(2)}` }}
        </button>
        <p class="secure-note">You'll be redirected to Stripe's secure payment page.</p>
      </form>

      <!-- Order summary -->
      <div class="checkout-summary">
        <div class="form-section-label">Order summary</div>
        <CartSummary
          :items="checkoutItems"
          :currency="currency"
          :editable="false"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.checkout-view { max-width: 64rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
.checkout-title { font-size: 1.75rem; font-weight: 700; color: #111; margin-bottom: 1.5rem; }

.checkout-layout { display: grid; grid-template-columns: 1fr 22rem; gap: 3rem; align-items: start; }

.checkout-form { display: flex; flex-direction: column; gap: 0.875rem; }

.form-section-label {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: #888;
  border-top: 1px solid #e5e5e5; padding-top: 1rem; margin-top: 0.25rem;
}
.checkout-form > .form-section-label:first-child { border-top: none; margin-top: 0; padding-top: 0; }

.field { display: flex; flex-direction: column; gap: 0.25rem; }
.field-label { font-size: 0.8125rem; font-weight: 500; color: #555; }
.field-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd; border-radius: 0.375rem;
  font-size: 0.875rem; color: #111; background: #fff;
  outline: none; transition: border-color 120ms;
  width: 100%;
}
.field-input:focus { border-color: #aaa; }
.field-input.error { border-color: #e53e3e; }
.field-error { font-size: 0.75rem; color: #e53e3e; }

.form-row { display: flex; gap: 0.75rem; }
.form-row .field { flex: 1; }

.promo-row { display: flex; flex-direction: column; gap: 0.25rem; }
.promo-input { font-family: monospace; letter-spacing: 0.05em; }

.btn-pay {
  margin-top: 0.5rem;
  padding: 0.875rem;
  border-radius: 0.5rem;
  border: none; background: #111; color: #fff;
  font-size: 1rem; font-weight: 700; cursor: pointer;
  transition: background 120ms, opacity 120ms;
}
.btn-pay:hover:not(:disabled) { background: #333; }
.btn-pay:disabled { opacity: 0.5; cursor: not-allowed; }
.secure-note { font-size: 0.75rem; color: #aaa; text-align: center; }

.checkout-summary { position: sticky; top: 5rem; }

@media (max-width: 767px) {
  .checkout-layout { grid-template-columns: 1fr; }
  .checkout-summary { position: static; }
}
</style>
