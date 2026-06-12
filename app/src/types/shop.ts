export interface ShopCategory {
  id: number
  name: string
  slug: string
  description: string | null
  sort_order: number
}

export type ShopItemType = 'record' | 'apparel' | 'accessory' | 'ticket' | 'bundle' | 'other'

export const SHOP_ITEM_TYPE_LABELS: Record<ShopItemType, string> = {
  record:    'Record',
  apparel:   'Apparel',
  accessory: 'Accessory',
  ticket:    'Ticket',
  bundle:    'Bundle',
  other:     'Other',
}

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

export interface ShopItemSummary {
  id: number
  name: string
  slug: string
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
  created_at: string
  updated_at: string
}

export interface ShopItem extends ShopItemSummary {
  description: string | null
  photos: ShopItemPhoto[]
  tags: { id: number; name: string; slug: string }[]
  release_ids: number[]
  concert_ids: number[]
  post_ids: number[]
  video_ids: number[]
  category_ids: number[]
}

export interface ShopItemPayload {
  name: string
  type: ShopItemType
  description: string | null
  is_available: boolean
  is_presale: boolean
  presale_ships_at: string | null
  stock_quantity: number | null
  purchase_url: string | null
  sort_order: number
  prices: { currency: string; amount: number }[]
  tag_ids: number[]
  release_ids: number[]
  concert_ids: number[]
  post_ids: number[]
  video_ids: number[]
  category_ids: number[]
}
