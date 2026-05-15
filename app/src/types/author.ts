export interface AuthorSummary {
  id: number
  name: string
  email: string | null
  facebook: string | null
  instagram: string | null
  whatsapp: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AuthorPressRelease {
  id: number
  url: string
  og_title: string | null
}

export interface AuthorConcert {
  id: number
  date: string
}

export interface AuthorTour {
  id: number
  name: string
}

export interface AuthorPhoto {
  id: number
  filename: string
}

export interface Author extends AuthorSummary {
  press_releases: AuthorPressRelease[]
  concerts: AuthorConcert[]
  tours: AuthorTour[]
  photos: AuthorPhoto[]
}

export interface AuthorPayload {
  name: string
  email: string | null
  facebook: string | null
  instagram: string | null
  whatsapp: string | null
  phone: string | null
  notes: string | null
  press_release_ids: number[]
  concert_ids: number[]
  tour_ids: number[]
  photo_ids: number[]
}
