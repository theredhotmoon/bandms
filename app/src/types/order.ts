export interface OrderItem {
  id: number
  shop_item_id: number
  shop_item_variant_id: number | null
  name: string
  variant_label: string | null
  price: number
  currency: string
  quantity: number
}

export interface Order {
  id: number
  uuid: string
  email: string
  name: string
  status: 'pending' | 'paid' | 'shipped' | 'cancelled'
  currency: string
  total: number
  shipping_address: {
    line1: string
    line2?: string
    city: string
    postal_code: string
    country: string
  }
  items: OrderItem[]
  created_at: string
}
