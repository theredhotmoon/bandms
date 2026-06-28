export type CartItemType = 'shop' | 'ticket'

export interface CartItemSnapshot {
  name: string
  variant_label: string | null
  price: number
  currency: string
  cover_photo: string | null
}

export interface CartItem {
  type: CartItemType
  shop_item_id: number | null
  variant_id: number | null
  ticket_type_id: number | null
  ticket_price_tier_id: number | null
  quantity: number
  snapshot: CartItemSnapshot
}
