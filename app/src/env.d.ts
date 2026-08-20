/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// BarcodeDetector — available in Chromium-based browsers (not yet in TypeScript lib)
interface BarcodeDetectorOptions {
  formats?: string[]
}
interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRect
  cornerPoints: Array<{ x: number; y: number }>
}
declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
  static getSupportedFormats(): Promise<string[]>
}
