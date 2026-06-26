export interface PresaleCode {
  id: number
  code: string
  concert_id: number | null
  description: string
  used_count: number
  max_uses: number | null
  valid_from: string | null
  valid_until: string | null
  tier_ids: number[]
}
