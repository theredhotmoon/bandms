import { API_BASE, handleResponse } from './client'

export interface UploadedBlockImage { path: string; url: string }

/** Multipart, so no Content-Type header — the browser sets the boundary. */
export async function uploadPostBlockImage(token: string, file: File): Promise<UploadedBlockImage> {
  const body = new FormData()
  body.append('image', file)

  const res = await fetch(`${API_BASE}/api/posts/blocks/image`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<UploadedBlockImage>(res)
}
