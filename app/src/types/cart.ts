export interface CartItemSnapshot {
  name: string
  variant_label: string | null
  price: number
  currency: string
  cover_photo: string | null
}

export interface CartItem {
  shop_item_id: number
  variant_id: number | null
  quantity: number
  snapshot: CartItemSnapshot
}
