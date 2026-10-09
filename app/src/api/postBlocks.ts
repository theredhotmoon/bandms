import { uploadImage, type UploadedImage } from './client'

/** A picture block's file, uploaded ahead of the post it will sit in. */
export function uploadPostBlockImage(token: string, file: File): Promise<UploadedImage> {
  return uploadImage(token, '/api/posts/blocks/image', file)
}
