export interface Venue {
  id: number
  name: string
  street: string | null
  street_number: string | null
  city: string | null
  postcode: string | null
  additional_info: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}
