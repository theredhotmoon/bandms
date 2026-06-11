import type { MusicVideo, MusicVideoPayload, VideoMetadata, YouTubeSyncResult } from '@/types/musicVideo'

const BASE = '/api/music-videos'

function assertSafeId(id: unknown): number {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) throw new Error('Invalid id')
  return n
}

export async function fetchMusicVideos(): Promise<MusicVideo[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to fetch music videos')
  const json = await res.json() as { data: MusicVideo[] }
  return json.data
}

export async function createMusicVideo(token: string, payload: MusicVideoPayload): Promise<MusicVideo> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to create music video')
  const json = await res.json() as { data: MusicVideo }
  return json.data
}

export async function updateMusicVideo(token: string, id: number, payload: Partial<MusicVideoPayload>): Promise<MusicVideo> {
  const safeId = assertSafeId(id)
  const res = await fetch(`${BASE}/${safeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to update music video')
  const json = await res.json() as { data: MusicVideo }
  return json.data
}

export async function deleteMusicVideo(token: string, id: number): Promise<void> {
  const safeId = assertSafeId(id)
  const res = await fetch(`${BASE}/${safeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to delete music video')
}

export async function syncYouTubeViews(token: string): Promise<YouTubeSyncResult> {
  const res = await fetch(`${BASE}/sync-views`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Failed to sync YouTube views')
  }
  return res.json() as Promise<YouTubeSyncResult>
}

export async function retrieveVideoMetadata(token: string, url: string): Promise<VideoMetadata> {
  const res = await fetch(`${BASE}/retrieve-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Could not retrieve metadata')
  }
  return res.json() as Promise<VideoMetadata>
}

export async function fetchMusicVideoPreview(token: string, id: number): Promise<MusicVideo> {
  const safeId = assertSafeId(id)
  const res = await fetch(`${BASE}/${safeId}/fetch-preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch preview')
  const json = await res.json() as { data: MusicVideo }
  return json.data
}
