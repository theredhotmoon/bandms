export type EpkVersionStatus = 'pending' | 'published' | 'archived'

export interface EpkVersion {
  id: number
  version_number: number
  release_reason: string | null
  status: EpkVersionStatus
  published_at: string | null
  created_at: string
}

export interface EpkVersionPayload {
  release_reason?: string | null
}
