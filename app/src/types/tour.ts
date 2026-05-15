export interface TourConcert {
  id: number
  date: string
  time: string | null
  venue_name: string | null
}

export interface TourImage {
  id: number
  url: string
  caption: string | null
  sort_order: number
}

export interface TourLink {
  id: number
  label: string
  url: string
}

export interface TourSummary {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  poster: string | null
  concerts_count: number
  created_at: string
  updated_at: string
}

export interface Tour extends TourSummary {
  description: string | null
  images: TourImage[]
  links: TourLink[]
  concerts: TourConcert[]
}

export interface TourImagePayload {
  url: string
  caption: string | null
  sort_order: number
}

export interface TourLinkPayload {
  label: string
  url: string
}

export interface TourPayload {
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  poster: string | null
  concert_ids: number[]
  images: TourImagePayload[]
  links: TourLinkPayload[]
}
