/**
 * Every non-ok response goes through handleResponse(), like the rest of
 * src/api. It used to throw its own English — and saveErrorMessage returns
 * error.message ahead of the caller's fallback, so those strings beat the
 * translated text in MusicVideosAdminView and a Polish admin read
 * "Failed to update music video" regardless. Using the shared client also
 * brings the 401 redirect and 422 handling this file was skipping.
 */
import { assertSafeId, handleResponse } from './client'
import type { MusicVideo, MusicVideoPayload, VideoMetadata, YouTubeSyncResult } from '@/types/musicVideo'

const BASE = '/api/music-videos'

export async function fetchMusicVideos(): Promise<MusicVideo[]> {
  const res = await fetch(BASE)
  return handleResponse<{ data: MusicVideo[] }>(res).then(r => r.data)
}

export async function createMusicVideo(token: string, payload: MusicVideoPayload): Promise<MusicVideo> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  return handleResponse<{ data: MusicVideo }>(res).then(r => r.data)
}

export async function updateMusicVideo(token: string, id: number, payload: Partial<MusicVideoPayload>): Promise<MusicVideo> {
  assertSafeId(id)
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  return handleResponse<{ data: MusicVideo }>(res).then(r => r.data)
}

export async function deleteMusicVideo(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse<void>(res)
}

export async function syncYouTubeViews(token: string): Promise<YouTubeSyncResult> {
  const res = await fetch(`${BASE}/sync-views`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse<YouTubeSyncResult>(res)
}

export async function retrieveVideoMetadata(token: string, url: string): Promise<VideoMetadata> {
  const res = await fetch(`${BASE}/retrieve-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  })
  return handleResponse<VideoMetadata>(res)
}

export async function fetchMusicVideoPreview(token: string, id: number): Promise<MusicVideo> {
  assertSafeId(id)
  const res = await fetch(`${BASE}/${id}/fetch-preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse<{ data: MusicVideo }>(res).then(r => r.data)
}
