export interface ShopCategory {
  id: number
  name: string
  slug: string
  description: string | null
  sort_order: number
}

export type ShopItemType = 'record' | 'apparel' | 'accessory' | 'ticket' | 'bundle' | 'other'

export interface ShopItemPrice {
  currency: string
  amount: number
}

export interface ShopItemPhoto {
  id: number
  url: string
  alt_text: string | null
  sort_order: number
}

export interface ShopItemVariant {
  id: number
  name: string
  value: string
  stock_quantity: number | null
  sort_order: number
}

export interface ShopItemSummary {
  id: number
  name: string
  slug_en: string
  slug_pl: string | null
  type: ShopItemType
  is_available: boolean
  is_presale: boolean
  presale_ships_at: string | null
  stock_quantity: number | null
  purchase_url: string | null
  sort_order: number
  prices: ShopItemPrice[]
  cover_photo: string | null
  categories: { id: number; name: string }[]
  variants: ShopItemVariant[]
  created_at: string
  updated_at: string
}

export interface ShopItem extends ShopItemSummary {
  description: string | null
  photos: ShopItemPhoto[]
  tags: { id: number; name: string; slug: string }[]
}

export interface CartItem {
  shopItemId: number
  variantId: number | null
  quantity: number
  name: string
  price: ShopItemPrice
  photo: string | null
  variant: string | null
}
