export interface CheckoutPayload {
  currency: string
  customer: {
    name: string
    email: string
    shipping_address: {
      line1: string
      line2?: string
      city: string
      postal_code: string
      country: string
    }
  }
  items: {
    shop_item_id: number
    shop_item_variant_id: number | null
    quantity: number
  }[]
}
