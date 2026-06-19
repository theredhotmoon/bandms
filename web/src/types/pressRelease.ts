import type { Tag } from './tag'

export interface PressReleaseSummary {
  id: number
  url: string
  og_title: string | null
  og_description: string | null
  og_image: string | null
  og_site_name: string | null
  published_at: string | null
  featured: boolean
  tags: Tag[]
  created_at: string
  updated_at: string
}
