import { useMutation } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { createCheckoutSession } from '@/api/shop'
import type { CheckoutPayload } from '@/api/shop'

export function useCheckout() {
  const checkout = useMutation({
    mutationFn: (payload: CheckoutPayload) => createCheckoutSession(payload),
    onSuccess: (data) => {
      window.location.href = data.checkout_url
    },
    onError: () => {
      toast.error('Checkout failed. Please try again.')
    },
  })

  return { checkout }
}
